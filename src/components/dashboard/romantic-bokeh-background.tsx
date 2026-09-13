"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export interface RomanticBokehBackgroundProps {
  /** Total number of floating bokeh sprites (default 32, recommended 25–40) */
  count?: number;
  /** Whether the bokeh layer is visible (toggleable) */
  enabled?: boolean;
  /** Global drift and sway speed multiplier (default 1) */
  speed?: number;
  /** Honor accessibility reduced motion setting */
  reducedMotion?: boolean;
  /** Dark mode adjustment for blending & luminance */
  darkMode?: boolean;
}

interface BokehParticle {
  // Spatial coordinates
  baseX: number;
  baseZ: number;
  y: number;
  radius: number;
  theta: number;

  // Visual sizing & transparency
  scale: number;
  baseOpacity: number;
  color: string;

  // Dynamic animation parameters
  speedY: number;
  swaySpeedX: number;
  swaySpeedZ: number;
  swayAmpX: number;
  swayAmpZ: number;
  phaseX: number;
  phaseZ: number;
  pulseSpeed: number;
  phaseP: number;
}

// ─── Warm Romantic Color Palette (Matching Pink / Maroon Theme) ───────────────
const BOKEH_PALETTE = [
  "#f472b6", // Soft romantic pink
  "#fda4af", // Light blush rose
  "#fb7185", // Radiant rose
  "#f43f5e", // Romantic maroon-rose accent
  "#fbcfe8", // Pastel fairy pink
  "#fbbf24", // Warm champagne gold
  "#f59e0b", // Deep amber gold
  "#fef08a", // Soft candlelight gold
  "#fff1f2", // Warm glowing white
  "#ffffff", // Crisp fairy twinkle white
];

// ─── Runtime Canvas Texture Generator (Zero External Assets) ─────────────────
function createBokehTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;

  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.48;

  // Soft luminous core with realistic photographic falloff
  const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerR);
  coreGrad.addColorStop(0, "rgba(255, 255, 255, 1.0)");
  coreGrad.addColorStop(0.2, "rgba(255, 255, 255, 0.88)");
  coreGrad.addColorStop(0.45, "rgba(255, 255, 255, 0.48)");
  coreGrad.addColorStop(0.72, "rgba(255, 255, 255, 0.16)");
  coreGrad.addColorStop(0.9, "rgba(255, 255, 255, 0.03)");
  coreGrad.addColorStop(1, "rgba(255, 255, 255, 0.0)");

  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fill();

  // Gentle lens aperture bokeh rim for genuine photographic depth
  const rimGrad = ctx.createRadialGradient(cx, cy, outerR * 0.62, cx, cy, outerR);
  rimGrad.addColorStop(0, "rgba(255, 255, 255, 0.0)");
  rimGrad.addColorStop(0.85, "rgba(255, 255, 255, 0.2)");
  rimGrad.addColorStop(1, "rgba(255, 255, 255, 0.0)");

  ctx.fillStyle = rimGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * RomanticBokehBackground
 *
 * Renders a 3D surrounding shell of floating, warm, luminous bokeh lights
 * around and behind the couple. Never obscures the subjects, preserves 360°
 * drag-to-rotate depth, and incurs zero network or image asset costs.
 */
export function RomanticBokehBackground({
  count = 32,
  enabled = true,
  speed = 1.0,
  reducedMotion = false,
  darkMode = true,
}: RomanticBokehBackgroundProps) {
  const spritesGroupRef = useRef<THREE.Group>(null);
  const spritesRef = useRef<THREE.Sprite[]>([]);

  // Bounding vertical loop boundaries
  const yMin = -0.4;
  const yMax = 1.65;
  const ySpan = yMax - yMin;

  // 1. Generate runtime canvas bokeh texture once
  const bokehTexture = useMemo(() => createBokehTexture(), []);

  // Dispose texture on unmount
  useEffect(() => {
    return () => {
      bokehTexture?.dispose();
    };
  }, [bokehTexture]);

  // 2. Generate initial particle data distributed in a 3D loose ring/torus shell around subjects
  const particles = useMemo<BokehParticle[]>(() => {
    const list: BokehParticle[] = [];

    for (let i = 0; i < count; i++) {
      // Loose surrounding shell: radius 0.95m to 2.35m away from origin
      // Distribute evenly with jitter to form a loose natural ring/sphere around the couple
      const angleFraction = i / count;
      const theta = angleFraction * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
      const radius = 0.95 + Math.random() * 1.35;

      const baseX = Math.cos(theta) * radius;
      const baseZ = Math.sin(theta) * radius;
      const y = yMin + Math.random() * ySpan;

      // Realistic photographic depth-of-field variation:
      // Smaller particles (farther/sharper) vs larger particles (closer/softer blur)
      const depthFactor = (radius - 0.95) / 1.35; // 0 = closer, 1 = farther
      const scale = 0.14 + (1 - depthFactor * 0.5) * (0.12 + Math.random() * 0.16);

      // Opacity tuned between 0.20 and 0.58 so subjects remain primary
      const baseOpacity = 0.22 + Math.random() * 0.34;

      // Color selection from romantic warm palette
      const color = BOKEH_PALETTE[i % BOKEH_PALETTE.length];

      list.push({
        baseX,
        baseZ,
        y,
        radius,
        theta,
        scale,
        baseOpacity,
        color,
        // Individualized animation parameters for organic, non-synced drift
        speedY: 0.035 + Math.random() * 0.045,
        swaySpeedX: 0.45 + Math.random() * 0.65,
        swaySpeedZ: 0.4 + Math.random() * 0.6,
        swayAmpX: 0.07 + Math.random() * 0.12,
        swayAmpZ: 0.07 + Math.random() * 0.12,
        phaseX: Math.random() * Math.PI * 2,
        phaseZ: Math.random() * Math.PI * 2,
        pulseSpeed: 0.8 + Math.random() * 1.4,
        phaseP: Math.random() * Math.PI * 2,
      });
    }

    return list;
  }, [count, yMin, ySpan]);

  // 3. Create sprite instances and materials
  useEffect(() => {
    if (!spritesGroupRef.current || !bokehTexture) return;

    const group = spritesGroupRef.current;
    // Clear old children if any
    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Sprite;
      group.remove(child);
      if (child.material) {
        child.material.dispose();
      }
    }

    spritesRef.current = [];

    particles.forEach((p) => {
      const material = new THREE.SpriteMaterial({
        map: bokehTexture,
        color: new THREE.Color(p.color),
        transparent: true,
        opacity: p.baseOpacity,
        // Critical: depthTest true allows couple to occlude sprites behind them
        depthTest: true,
        // depthWrite false prevents sprites from masking each other or scene elements
        depthWrite: false,
        // Additive blending creates luminous light orbs that match photography bokeh
        blending: THREE.AdditiveBlending,
      });

      const sprite = new THREE.Sprite(material);
      sprite.scale.set(p.scale, p.scale, 1);
      sprite.position.set(p.baseX, p.y, p.baseZ);
      // Ensure background bokeh renders softly behind opaque subjects
      sprite.renderOrder = -1;

      group.add(sprite);
      spritesRef.current.push(sprite);
    });

    return () => {
      spritesRef.current.forEach((s) => s.material.dispose());
      spritesRef.current = [];
    };
  }, [particles, bokehTexture]);

  // 4. Per-frame organic floating drift, horizontal sway & camera occlusion guard
  useFrame((state, delta) => {
    if (!enabled || reducedMotion || spritesRef.current.length === 0) return;

    // Safety cap delta to prevent sudden position leap when waking from background tab
    const dt = Math.min(delta, 0.08);
    const time = state.clock.getElapsedTime();
    const camPos = state.camera.position;

    // Camera vector in XZ plane for foreground occlusion prevention
    const camDistXZ = Math.sqrt(camPos.x * camPos.x + camPos.z * camPos.z) || 1;
    const camDirX = camPos.x / camDistXZ;
    const camDirZ = camPos.z / camDistXZ;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const sprite = spritesRef.current[i];
      if (!sprite) continue;

      // Gentle upward drift
      p.y += p.speedY * dt * speed;
      if (p.y > yMax) {
        p.y = yMin + (p.y - yMax);
      }

      // Smooth horizontal sway with individual phase offsets
      const currX = p.baseX + Math.sin(time * p.swaySpeedX + p.phaseX) * p.swayAmpX;
      const currZ = p.baseZ + Math.cos(time * p.swaySpeedZ + p.phaseZ) * p.swayAmpZ;
      const currY = p.y;

      sprite.position.set(currX, currY, currZ);

      // Smooth vertical edge fading at top and bottom boundaries (no popping)
      const normY = (currY - yMin) / ySpan;
      let vertFade = 1.0;
      if (normY < 0.15) {
        vertFade = normY / 0.15;
      } else if (normY > 0.85) {
        vertFade = Math.max(0, (1.0 - normY) / 0.15);
      }

      // Delicate subtle luminous twinkle/breathing
      const pulse = 1.0 + 0.14 * Math.sin(time * p.pulseSpeed + p.phaseP);

      // ─── Foreground Occlusion Guard ─────────────────────────────────────────
      // Project sprite position onto camera line-of-sight vector
      const dotCam = currX * camDirX + currZ * camDirZ;

      // Perpendicular distance to the line between origin and camera in XZ
      const perpDist = Math.abs(currX * camDirZ - currZ * camDirX);

      // If a light happens to drift into the foreground between camera and couple,
      // smoothly fade it down so the couple & bouquet are NEVER obscured.
      let foregroundFade = 1.0;
      if (dotCam > 0.25) {
        // Light is on the camera side of the subjects
        if (perpDist < 0.6) {
          foregroundFade = Math.max(0, (perpDist - 0.25) / 0.35);
        }
      }

      const finalOpacity = THREE.MathUtils.clamp(
        p.baseOpacity * vertFade * pulse * foregroundFade,
        0,
        0.8
      );

      sprite.material.opacity = finalOpacity;
    }
  });

  if (!enabled) return null;

  return <group ref={spritesGroupRef} name="romantic-bokeh-background" />;
}

export default RomanticBokehBackground;
