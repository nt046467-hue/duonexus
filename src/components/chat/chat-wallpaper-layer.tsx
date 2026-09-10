"useclient";

import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { cn } from "@/lib/utils";

export interface ChatWallpaperLayerProps {
  src: string;
  positionX?: number; // 0 (left) to 100 (right), default 50
  positionY?: number; // 0 (top) to 100 (bottom), default 35
  zoom?: number;      // 100 to 250, default 100
  fit?: "smart" | "cover" | "contain";
  opacity?: number;   // 20 to 100, default 85
  isDark?: boolean;
  className?: string;
  interactiveRef?: React.RefObject<HTMLDivElement | null>;
}

export function ChatWallpaperLayer({
  src,
  positionX = 50,
  positionY = 35,
  zoom = 100,
  fit = "smart",
  opacity = 85,
  isDark = true,
  className,
  interactiveRef,
}: ChatWallpaperLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  // Measure container size with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerSize({ width, height });
        }
      }
    });

    ro.observe(el);
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setContainerSize({ width: rect.width, height: rect.height });
    }

    return () => ro.disconnect();
  }, []);

  // Preload and get natural aspect ratio
  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.src = src;
    if (img.complete && img.naturalWidth > 0) {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    } else {
      img.onload = () => {
        setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      };
    }
  }, [src]);

  const opacityVal = (opacity ?? 85) / 100;
  const currentScale = Math.max(1, (zoom ?? 100) / 100);

  // Geometric calculations to cover/contain without distortion
  let transformStyle: React.CSSProperties = {};
  if (containerSize && naturalSize && naturalSize.width > 0 && naturalSize.height > 0) {
    const cWidth = containerSize.width;
    const cHeight = containerSize.height;
    const imgAspect = naturalSize.width / naturalSize.height;
    const cAspect = cWidth / cHeight;

    let baseW = cWidth;
    let baseH = cHeight;

    if (fit === "contain") {
      if (imgAspect > cAspect) {
        baseW = cWidth;
        baseH = cWidth / imgAspect;
      } else {
        baseH = cHeight;
        baseW = cHeight * imgAspect;
      }
    } else {
      // "cover" and "smart" fill screen
      if (imgAspect > cAspect) {
        baseH = cHeight;
        baseW = cHeight * imgAspect;
      } else {
        baseW = cWidth;
        baseH = cWidth / imgAspect;
      }
    }

    const renderedW = baseW * currentScale;
    const renderedH = baseH * currentScale;

    const panXRange = Math.max(0, renderedW - cWidth);
    const panYRange = Math.max(0, renderedH - cHeight);

    const clampedX = Math.max(0, Math.min(100, positionX ?? 50));
    const clampedY = Math.max(0, Math.min(100, positionY ?? 35));

    const shiftX = (0.5 - clampedX / 100) * panXRange;
    const shiftY = (0.5 - clampedY / 100) * panYRange;

    transformStyle = {
      width: `${baseW}px`,
      height: `${baseH}px`,
      position: "absolute",
      left: "50%",
      top: "50%",
      transform: `translate(-50%, -50%) translate3d(${shiftX}px, ${shiftY}px, 0) scale(${currentScale})`,
      transformOrigin: "center center",
      objectFit: "cover",
      willChange: "transform",
      opacity: opacityVal,
      transition: "opacity 0.2s ease-out",
    };
  } else {
    // Fallback before container / image dimensions are ready
    transformStyle = {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: fit === "contain" ? "contain" : "cover",
      objectPosition: `${positionX ?? 50}% ${positionY ?? 35}%`,
      transform: currentScale > 1 ? `scale(${currentScale})` : "none",
      transformOrigin: "center center",
      opacity: opacityVal,
    };
  }

  return (
    <div
      ref={containerRef}
      className={cn("absolute inset-0 pointer-events-none select-none overflow-hidden", className)}
      aria-hidden="true"
    >
      {/* Layer 1: Ambient atmosphere backdrop blur */}
      <div
        suppressHydrationWarning
        className="absolute inset-0 transition-opacity duration-500 pointer-events-none"
        style={{
          backgroundImage: `url("${src}")`,
          backgroundPosition: "center center",
          backgroundSize: "cover",
          filter: "blur(36px) saturate(1.35) brightness(0.8)",
          transform: "scale(1.2)",
          opacity: Math.max(0.3, opacityVal * 0.8),
        }}
      />

      {/* Layer 2: Crisp Wallpaper with accurate scale & transform */}
      <div
        ref={interactiveRef}
        className="absolute inset-0 pointer-events-none overflow-hidden"
      >
        {src && (
          <img
            src={src}
            alt=""
            draggable={false}
            className="pointer-events-none select-none"
            style={transformStyle}
          />
        )}
      </div>

      {/* Layer 3: Gentle ambient readability wash */}
      <div
        className="absolute inset-0 pointer-events-none transition-colors duration-300"
        style={{
          background: isDark
            ? "linear-gradient(to bottom, rgba(10,10,14,0.3) 0%, rgba(10,10,14,0.05) 30%, rgba(10,10,14,0.1) 70%, rgba(10,10,14,0.45) 100%)"
            : "linear-gradient(to bottom, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.05) 30%, rgba(255,255,255,0.1) 70%, rgba(255,255,255,0.35) 100%)",
        }}
      />
    </div>
  );
}
