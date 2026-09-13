"use client";

import React, { Suspense, useRef, useEffect, useState, useCallback, Component, ErrorInfo, ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useTexture, OrbitControls, Center, ContactShadows, useProgress } from "@react-three/drei";
import * as THREE from "three";

// ─── Detect mobile once ────────────────────────────────────────────────────────
function getIsMobile() {
  if (typeof window === "undefined") return false;
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;
}

export type CameraPreset = "overview" | "bouquet" | "ring" | "karu" | "full";

interface Love3DSceneProps {
  darkMode?: boolean;
  cameraPreset?: CameraPreset;
  isZoomed?: boolean;
  autoRotate?: boolean;
  onLoaded?: () => void;
  className?: string;
}

// Romantic Progress Indicator
export function SceneLoadingIndicator() {
  const { progress } = useProgress();
  const roundedProgress = Math.round(progress);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 p-6 text-center bg-background/60 backdrop-blur-sm">
      <div className="relative mb-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-rose-500/20 via-pink-500/20 to-amber-500/20 backdrop-blur-md border border-rose-500/30 flex items-center justify-center text-xl shadow-inner heart-gentle-pulse">
          💖
        </div>
      </div>
      <p className="text-sm font-semibold text-foreground tracking-wide mb-1">
        Loading our proposal in real colors...
      </p>
      <p className="text-xs text-muted-foreground mb-3">
        Karu&apos;s maroon floral dress &amp; Nabin&apos;s outfit
      </p>
      {roundedProgress > 0 && (
        <div className="w-48 max-w-full bg-rose-500/10 rounded-full h-1.5 overflow-hidden border border-rose-500/20 shadow-xs">
          <div
            className="h-full bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.max(10, roundedProgress)}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ─── 3D Proposal Model ────────────────────────────────────────────────────────
function ProposalModel({ onLoaded, isMobile }: { onLoaded?: () => void; isMobile: boolean }) {
  const { scene } = useGLTF("/models/proposal.glb");
  const baseColorTexture = useTexture("/textures/proposal_base_color.jpg");

  useEffect(() => {
    if (!baseColorTexture) return;
    baseColorTexture.colorSpace = THREE.SRGBColorSpace;
    baseColorTexture.flipY = false;
    baseColorTexture.wrapS = THREE.RepeatWrapping;
    baseColorTexture.wrapT = THREE.RepeatWrapping;
    // Mobile: skip mipmaps — faster GPU texture upload
    if (isMobile) {
      baseColorTexture.minFilter = THREE.LinearFilter;
      baseColorTexture.generateMipmaps = false;
    } else {
      baseColorTexture.minFilter = THREE.LinearMipmapLinearFilter;
      baseColorTexture.generateMipmaps = true;
    }
    baseColorTexture.magFilter = THREE.LinearFilter;
    baseColorTexture.needsUpdate = true;
  }, [baseColorTexture, isMobile]);

  useEffect(() => {
    if (!scene || !baseColorTexture) return;
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        // Shadows only on desktop — shadow maps are very expensive on mobile
        mesh.castShadow = !isMobile;
        mesh.receiveShadow = !isMobile;

        const mat = (mesh.material as THREE.MeshStandardMaterial) || new THREE.MeshStandardMaterial();
        mat.color.setRGB(1, 1, 1);
        mat.map = baseColorTexture;
        mat.roughness = 0.68;
        mat.metalness = 0.04;
        // Disable envMap on mobile to save shader instructions
        if (isMobile) mat.envMapIntensity = 0;
        mat.needsUpdate = true;
      }
    });
    onLoaded?.();
  }, [scene, baseColorTexture, onLoaded, isMobile]);

  return (
    <Center>
      <primitive object={scene} />
    </Center>
  );
}

// ─── Demand Renderer: pause frames when scene is idle ─────────────────────────
// Biggest single mobile perf win: stops burning GPU at 60fps when nothing moves.
function DemandRenderer({ shouldDrive }: { shouldDrive: boolean }) {
  const { invalidate } = useThree();
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!shouldDrive) return;
    let running = true;
    const loop = () => {
      if (!running) return;
      invalidate();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [shouldDrive, invalidate]);

  return null;
}

// Target camera positions for each preset (centered at origin)
const CAMERA_PRESETS: Record<CameraPreset, { pos: [number, number, number]; lookAt: [number, number, number] }> = {
  overview: { pos: [0, 0.05, 2.1], lookAt: [0, 0, 0] },
  bouquet: { pos: [0, 0.04, 1.35], lookAt: [0, 0.02, 0] },
  ring: { pos: [0, 0.04, 1.35], lookAt: [0, 0.02, 0] },
  karu: { pos: [0.28, 0.22, 1.5], lookAt: [0.12, 0.18, 0] },
  full: { pos: [0, 0.05, 2.65], lookAt: [0, 0, 0] },
};

// ─── Smooth Orbit Viewer ──────────────────────────────────────────────────────
function SmoothOrbitViewer({
  preset = "overview",
  autoRotate = true,
  reducedMotion = false,
  darkMode = true,
  isMobile = false,
  onLoaded,
}: {
  preset: CameraPreset;
  autoRotate?: boolean;
  reducedMotion?: boolean;
  darkMode?: boolean;
  isMobile?: boolean;
  onLoaded?: () => void;
}) {
  const controlsRef = useRef<any>(null);
  const isAnimatingPreset = useRef(false);
  const targetCamPos = useRef(new THREE.Vector3(0, 0.05, 2.1));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const [userInteracting, setUserInteracting] = useState(false);
  const userInteractingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prevPreset = useRef(preset);
  useEffect(() => {
    if (prevPreset.current !== preset) {
      prevPreset.current = preset;
      const config = CAMERA_PRESETS[preset] || CAMERA_PRESETS.overview;
      targetCamPos.current.set(...config.pos);
      targetLookAt.current.set(...config.lookAt);
      isAnimatingPreset.current = true;
    }
  }, [preset]);

  // Lerp camera to preset — runs only while animating
  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls || !isAnimatingPreset.current || userInteracting) return;
    const cam = controls.object as THREE.PerspectiveCamera;
    const factor = Math.min(1, delta * (isMobile ? 3.5 : 4.5));
    cam.position.lerp(targetCamPos.current, factor);
    controls.target.lerp(targetLookAt.current, factor);
    controls.update();
    if (
      cam.position.distanceTo(targetCamPos.current) < 0.01 &&
      controls.target.distanceTo(targetLookAt.current) < 0.01
    ) {
      cam.position.copy(targetCamPos.current);
      controls.target.copy(targetLookAt.current);
      isAnimatingPreset.current = false;
    }
  });

  const handleStart = useCallback(() => {
    isAnimatingPreset.current = false;
    setUserInteracting(true);
    if (userInteractingTimer.current) clearTimeout(userInteractingTimer.current);
  }, []);

  const handleEnd = useCallback(() => {
    if (userInteractingTimer.current) clearTimeout(userInteractingTimer.current);
    userInteractingTimer.current = setTimeout(() => setUserInteracting(false), 2500);
  }, []);

  const shouldDrive = (autoRotate && !userInteracting && !reducedMotion) || userInteracting || isAnimatingPreset.current;

  return (
    <>
      <ProposalModel onLoaded={onLoaded} isMobile={isMobile} />

      {/* Lighter shadow on mobile, skip expensive blur */}
      {isMobile ? (
        <ContactShadows
          position={[0, -0.48, 0]}
          opacity={0.18}
          scale={2.5}
          blur={1.2}
          far={1.0}
          frames={1}
          color="#0f070b"
        />
      ) : (
        <ContactShadows
          position={[0, -0.48, 0]}
          opacity={darkMode ? 0.45 : 0.25}
          scale={3.6}
          blur={2.4}
          far={1.6}
          color="#0f070b"
        />
      )}

      {/* Demand renderer — stops burning GPU when idle */}
      <DemandRenderer shouldDrive={shouldDrive} />

      <OrbitControls
        ref={controlsRef}
        target={[0, 0, 0]}
        enablePan={false}
        enableZoom={true}
        zoomSpeed={isMobile ? 0.7 : 0.95}
        enableRotate={true}
        rotateSpeed={isMobile ? 0.6 : 0.85}
        enableDamping={true}
        dampingFactor={isMobile ? 0.14 : 0.075}
        minDistance={0.6}
        maxDistance={4.2}
        minPolarAngle={0.08}
        maxPolarAngle={Math.PI - 0.08}
        autoRotate={autoRotate && !userInteracting && !reducedMotion}
        autoRotateSpeed={isMobile ? 0.45 : 0.65}
        onStart={handleStart}
        onEnd={handleEnd}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
      />
    </>
  );
}

// Error Boundary for WebGL Fallback
interface ErrorBoundaryState {
  hasError: boolean;
}

export class WebGLSceneErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("WebGL Scene Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="w-full h-full min-h-[360px] flex flex-col items-center justify-center p-6 text-center bg-rose-500/5 rounded-3xl border border-rose-500/20">
            <span className="text-4xl mb-3 animate-bounce">💍</span>
            <h4 className="text-lg font-bold text-foreground">Our Special Moment</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Your device will reveal this private moment whenever 3D WebGL rendering is ready.
            </p>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

// ─── Main Canvas ──────────────────────────────────────────────────────────────
export default function Love3DScene({
  darkMode = true,
  cameraPreset = "overview",
  isZoomed = false,
  autoRotate = true,
  onLoaded,
  className = "",
}: Love3DSceneProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const effectivePreset: CameraPreset = cameraPreset || (isZoomed ? "ring" : "overview");

  useEffect(() => {
    setIsMobile(getIsMobile());
    if (typeof window !== "undefined" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReducedMotion(mq.matches);
      const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    }
  }, []);

  // Mobile GL: no antialias, no stencil, demand-driven frames
  const glConfig = isMobile
    ? {
        antialias: false,
        powerPreference: "high-performance" as const,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
        outputColorSpace: THREE.SRGBColorSpace,
        stencil: false,
        alpha: false,
      }
    : {
        antialias: true,
        powerPreference: "high-performance" as const,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
        outputColorSpace: THREE.SRGBColorSpace,
      };

  return (
    <WebGLSceneErrorBoundary>
      <div className={`relative w-full h-full select-none ${className}`}>
        <Suspense fallback={<SceneLoadingIndicator />}>
          <Canvas
            camera={{ position: [0, 0.05, 2.1], fov: 38 }}
            dpr={isMobile ? [1, 1.5] : [1, 2]}
            gl={glConfig}
            frameloop="demand"
            aria-label="3D Proposal Scene: Nabin & Karu"
            className="w-full h-full cursor-grab active:cursor-grabbing focus:outline-none touch-none"
            style={{ touchAction: "none" }}
          >
            {/* ════ LIGHTING — streamlined for mobile ════ */}
            {/* Ambient — brighter on mobile to compensate for fewer fill lights */}
            <ambientLight intensity={isMobile ? 1.1 : 0.85} color="#ffffff" />

            {/* Main key light — shadows only on desktop */}
            <directionalLight
              position={[3, 4.5, 3.5]}
              intensity={isMobile ? 1.6 : 1.4}
              color="#fffcf5"
              castShadow={!isMobile}
              shadow-mapSize={[512, 512]}
              shadow-bias={-0.0001}
            />

            {/* Sky fill — both platforms */}
            <directionalLight
              position={[-3.5, 2.5, 2]}
              intensity={isMobile ? 0.6 : 0.8}
              color="#f4f7fc"
            />

            {/* Backlight — desktop only */}
            {!isMobile && (
              <directionalLight position={[0, 3.5, -3]} intensity={0.55} color="#ffffff" />
            )}

            {/* Front point — both platforms */}
            <pointLight
              position={[0, 0.5, 2]}
              intensity={isMobile ? 0.35 : 0.5}
              color="#fffcf5"
              distance={6}
            />

            {/* Underside fill — desktop only */}
            {!isMobile && (
              <pointLight position={[0, -1.2, 0]} intensity={0.55} color="#f8f4ef" distance={5} />
            )}

            {/* Low back fill — desktop only */}
            {!isMobile && (
              <directionalLight position={[0, -3, -2]} intensity={0.35} color="#ffffff" />
            )}

            <SmoothOrbitViewer
              preset={effectivePreset}
              autoRotate={autoRotate}
              reducedMotion={reducedMotion}
              darkMode={darkMode}
              isMobile={isMobile}
              onLoaded={onLoaded}
            />
          </Canvas>
        </Suspense>
      </div>
    </WebGLSceneErrorBoundary>
  );
}

// Preload the GLB model and texture
useGLTF.preload("/models/proposal.glb");
useTexture.preload("/textures/proposal_base_color.jpg");
