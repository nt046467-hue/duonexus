"use client";

import React, { Suspense, useRef, useEffect, useState, Component, ErrorInfo, ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useTexture, OrbitControls, Center, ContactShadows, useProgress } from "@react-three/drei";
import * as THREE from "three";

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
        <div className="w-14 h-14 rounded-full bg-rose-500/15 animate-ping absolute inset-0 opacity-70" />
        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-rose-500/20 via-pink-500/20 to-amber-500/20 backdrop-blur-md border border-rose-500/30 flex items-center justify-center text-xl shadow-inner">
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

// 3D Proposal Model with Real Texture Preservation & Correct PBR Materials
function ProposalModel({ onLoaded }: { onLoaded?: () => void }) {
  // Load the exact GLB model
  const { scene } = useGLTF("/b36171aa7181067d1a2dd85d645122bd.glb");
  
  // Explicitly load the authentic base color texture to guarantee 100% color accuracy
  const baseColorTexture = useTexture("/textures/proposal_base_color.jpg");

  useEffect(() => {
    if (baseColorTexture) {
      baseColorTexture.colorSpace = THREE.SRGBColorSpace;
      baseColorTexture.flipY = false;
      baseColorTexture.wrapS = THREE.RepeatWrapping;
      baseColorTexture.wrapT = THREE.RepeatWrapping;
      baseColorTexture.minFilter = THREE.LinearMipmapLinearFilter;
      baseColorTexture.magFilter = THREE.LinearFilter;
      baseColorTexture.generateMipmaps = true;
      baseColorTexture.needsUpdate = true;
    }
  }, [baseColorTexture]);

  useEffect(() => {
    if (scene && baseColorTexture) {
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          const mat = (mesh.material as THREE.MeshStandardMaterial) || new THREE.MeshStandardMaterial();
          
          // Pure white diffuse multiplier so the authentic texture colors show cleanly
          mat.color.setRGB(1, 1, 1);
          
          // Bind the high-resolution texture map
          mat.map = baseColorTexture;

          // Natural fabric roughness and low metalness (real clothes & skin)
          mat.roughness = 0.68;
          mat.metalness = 0.04;

          // Gentle dielectric specular reflection
          if ((mat as any).specularColor) {
            (mat as any).specularColor.setRGB(0.18, 0.18, 0.18);
          }
          if (typeof (mat as any).specularIntensity !== "undefined") {
            (mat as any).specularIntensity = 0.25;
          }

          mat.needsUpdate = true;
        }
      });

      if (onLoaded) {
        onLoaded();
      }
    }
  }, [scene, baseColorTexture, onLoaded]);

  return (
    <Center>
      <primitive object={scene} />
    </Center>
  );
}

// Target camera positions for each preset (centered at origin)
const CAMERA_PRESETS: Record<CameraPreset, { pos: [number, number, number]; lookAt: [number, number, number] }> = {
  overview: { pos: [0, 0.05, 2.1], lookAt: [0, 0, 0] },
  bouquet: { pos: [0, 0.04, 1.35], lookAt: [0, 0.02, 0] },
  ring: { pos: [0, 0.04, 1.35], lookAt: [0, 0.02, 0] },
  karu: { pos: [0.28, 0.22, 1.5], lookAt: [0.12, 0.18, 0] },
  full: { pos: [0, 0.05, 2.65], lookAt: [0, 0, 0] },
};

// Smooth Orbit Viewer with Real Touch/Mouse Controls that never fight the user
function SmoothOrbitViewer({
  preset = "overview",
  autoRotate = true,
  reducedMotion = false,
  darkMode = true,
  onLoaded,
}: {
  preset: CameraPreset;
  autoRotate?: boolean;
  reducedMotion?: boolean;
  darkMode?: boolean;
  onLoaded?: () => void;
}) {
  const controlsRef = useRef<any>(null);
  const isAnimatingPreset = useRef(false);
  const targetCamPos = useRef(new THREE.Vector3(0, 0.05, 2.1));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const [userInteracting, setUserInteracting] = useState(false);
  const userInteractingTimer = useRef<NodeJS.Timeout | null>(null);

  // When preset prop changes, trigger smooth camera animation to target
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

  // Frame loop: smooth preset animation ONLY when triggered, instantly stops when user touches
  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (isAnimatingPreset.current && !userInteracting) {
      const cam = controls.object as THREE.PerspectiveCamera;
      const factor = Math.min(1, delta * 4.5);
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
    }
  });

  // User begins dragging / touching: cancel preset animation immediately
  const handleStart = () => {
    isAnimatingPreset.current = false;
    setUserInteracting(true);
    if (userInteractingTimer.current) {
      clearTimeout(userInteractingTimer.current);
    }
  };

  // User releases touch / mouse: resume gentle auto-rotate after 2.5s
  const handleEnd = () => {
    if (userInteractingTimer.current) {
      clearTimeout(userInteractingTimer.current);
    }
    userInteractingTimer.current = setTimeout(() => {
      setUserInteracting(false);
    }, 2500);
  };

  return (
    <>
      {/* 3D Model Centered at Origin */}
      <ProposalModel onLoaded={onLoaded} />

      {/* Floor Contact Shadow under feet */}
      <ContactShadows
        position={[0, -0.48, 0]}
        opacity={darkMode ? 0.45 : 0.25}
        scale={3.6}
        blur={2.4}
        far={1.6}
        color="#0f070b"
      />

      {/* Real Full 360° Orbit Controls — NO polar restrictions, full top-to-bottom freedom */}
      <OrbitControls
        ref={controlsRef}
        target={[0, 0, 0]}
        enablePan={true}
        panSpeed={0.8}
        enableZoom={true}
        zoomSpeed={0.95}
        enableRotate={true}
        rotateSpeed={0.85}
        enableDamping={true}
        dampingFactor={0.075}
        minDistance={0.6}
        maxDistance={4.2}
        minPolarAngle={0.08}
        maxPolarAngle={Math.PI - 0.08}
        autoRotate={autoRotate && !userInteracting && !reducedMotion && !isAnimatingPreset.current}
        autoRotateSpeed={0.65}
        onStart={handleStart}
        onEnd={handleEnd}
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

// Main 3D Canvas Scene with Natural Realistic Romantic Studio Lighting & Real Touch Controls
export default function Love3DScene({
  darkMode = true,
  cameraPreset = "overview",
  isZoomed = false,
  autoRotate = true,
  onLoaded,
  className = "",
}: Love3DSceneProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const effectivePreset: CameraPreset = cameraPreset || (isZoomed ? "ring" : "overview");

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReducedMotion(mediaQuery.matches);
      const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    }
  }, []);

  return (
    <WebGLSceneErrorBoundary>
      <div className={`relative w-full h-full select-none touch-none ${className}`}>
        <Suspense fallback={<SceneLoadingIndicator />}>
          <Canvas
            camera={{ position: [0, 0.05, 2.1], fov: 38 }}
            dpr={[1, 2]}
            gl={{
              antialias: true,
              powerPreference: "high-performance",
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 1.05,
              outputColorSpace: THREE.SRGBColorSpace,
            }}
            aria-label="3D Proposal Scene: Nabin & Karu"
            className="w-full h-full cursor-grab active:cursor-grabbing focus:outline-none"
          >
            {/* ════ NATURAL REALISTIC STUDIO LIGHTING ════ */}
            {/* 1. Neutral balanced ambient light — reveals authentic fabric, hair and skin colors */}
            <ambientLight intensity={0.85} color="#ffffff" />

            {/* 2. Main Key Light — Soft warm daylight coming from upper right */}
            <directionalLight
              position={[3, 4.5, 3.5]}
              intensity={1.4}
              color="#fffcf5"
              castShadow
              shadow-mapSize={[1024, 1024]}
              shadow-bias={-0.0001}
            />

            {/* 3. Soft Sky Fill Light from upper left — lifts shadows without color wash */}
            <directionalLight
              position={[-3.5, 2.5, 2]}
              intensity={0.8}
              color="#f4f7fc"
            />

            {/* 4. Clean Backlight for silhouette depth */}
            <directionalLight
              position={[0, 3.5, -3]}
              intensity={0.55}
              color="#ffffff"
            />

            {/* 5. Gentle Front Light — brings out the red roses and bouquet */}
            <pointLight
              position={[0, 0.5, 2]}
              intensity={0.5}
              color="#fffcf5"
              distance={6}
            />

            {/* 6. Underside fill light — illuminates model when viewed from below */}
            <pointLight
              position={[0, -1.2, 0]}
              intensity={0.55}
              color="#f8f4ef"
              distance={5}
            />

            {/* 7. Low back fill — prevents pure black underside */}
            <directionalLight
              position={[0, -3, -2]}
              intensity={0.35}
              color="#ffffff"
            />

            {/* Real Interactive Orbit Controller */}
            <SmoothOrbitViewer
              preset={effectivePreset}
              autoRotate={autoRotate}
              reducedMotion={reducedMotion}
              darkMode={darkMode}
              onLoaded={onLoaded}
            />
          </Canvas>
        </Suspense>
      </div>
    </WebGLSceneErrorBoundary>
  );
}

// Preload the GLB model and texture
useGLTF.preload("/b36171aa7181067d1a2dd85d645122bd.glb");
useTexture.preload("/textures/proposal_base_color.jpg");
