"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface WallpaperTransformState {
  positionX: number; // 0 to 100
  positionY: number; // 0 to 100
  zoom: number;      // 100 to 250
}

export interface UseWallpaperTransformOptions {
  positionX: number;
  positionY: number;
  zoom: number;
  fit?: "smart" | "cover" | "contain";
  imageSrc?: string;
  minZoom?: number;
  maxZoom?: number;
  onChange: (updates: { positionX?: number; positionY?: number; zoom?: number }) => void;
}

export function useWallpaperTransform({
  positionX,
  positionY,
  zoom,
  fit = "smart",
  imageSrc,
  minZoom = 100,
  maxZoom = 250,
  onChange,
}: UseWallpaperTransformOptions) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const [naturalAspect, setNaturalAspect] = useState<number>(9 / 16); // sensible default portrait aspect

  // Keep latest props in refs for 60fps event loop
  const stateRef = useRef({ positionX, positionY, zoom, fit });
  stateRef.current = { positionX, positionY, zoom, fit };

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Active pointers map (for multi-touch pinch)
  const pointersRef = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());

  // Drag tracking
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initX: number;
    initY: number;
  } | null>(null);

  // Pinch tracking
  const pinchStartRef = useRef<{
    initialDist: number;
    initialZoom: number;
    initialMidX: number;
    initialMidY: number;
    initX: number;
    initY: number;
  } | null>(null);

  // Double tap / click detection
  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });

  // Animation frame request ID
  const rafRef = useRef<number | null>(null);

  // Load natural image dimensions for accurate bounding box math
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.src = imageSrc;
    if (img.complete && img.naturalWidth > 0) {
      setNaturalAspect(img.naturalWidth / img.naturalHeight);
    } else {
      img.onload = () => {
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          setNaturalAspect(img.naturalWidth / img.naturalHeight);
        }
      };
    }
  }, [imageSrc]);

  // Reset to ideal defaults
  const handleReset = useCallback(() => {
    onChangeRef.current({
      positionX: 50,
      positionY: 35,
      zoom: 100,
    });
  }, []);

  // Double-click / double-tap toggle between default and comfortable zoom
  const handleToggleZoom = useCallback(() => {
    const currentZ = stateRef.current.zoom;
    if (currentZ > 115) {
      onChangeRef.current({ zoom: 100 });
    } else {
      onChangeRef.current({ zoom: 155 });
    }
  }, []);

  // Wheel zoom with passive: false for desktop mouse / trackpad pinch
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const currentZ = stateRef.current.zoom;
      // Normal wheel or trackpad pinch (ctrlKey is set during pinch gestures on trackpads)
      const delta = -e.deltaY;
      const step = e.ctrlKey ? delta * 1.5 : (delta > 0 ? 10 : -10);
      const nextZoom = Math.max(minZoom, Math.min(maxZoom, Math.round(currentZ + step)));

      if (nextZoom !== currentZ) {
        onChangeRef.current({ zoom: nextZoom });
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, [minZoom, maxZoom]);

  // Pointer Down (Mouse or Touch)
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only handle primary mouse click or touch pointers
    if (e.button !== 0 && e.pointerType === "mouse") return;

    const target = e.currentTarget;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // safe fallback
    }

    const map = pointersRef.current;
    map.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    const now = Date.now();
    const lastTap = lastTapRef.current;
    const isDoubleTap =
      now - lastTap.time < 320 &&
      Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 20;

    if (isDoubleTap && map.size === 1) {
      handleToggleZoom();
      lastTapRef.current = { time: 0, x: 0, y: 0 };
      return;
    }
    lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };

    setIsInteracting(true);

    if (map.size === 1) {
      // Single finger or mouse drag
      dragStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initX: stateRef.current.positionX,
        initY: stateRef.current.positionY,
      };
      pinchStartRef.current = null;
    } else if (map.size === 2) {
      // 2 fingers: pinch start
      const points = Array.from(map.values());
      const dist = Math.hypot(points[0].clientX - points[1].clientX, points[0].clientY - points[1].clientY);
      const midX = (points[0].clientX + points[1].clientX) / 2;
      const midY = (points[0].clientY + points[1].clientY) / 2;

      pinchStartRef.current = {
        initialDist: Math.max(dist, 1),
        initialZoom: stateRef.current.zoom,
        initialMidX: midX,
        initialMidY: midY,
        initX: stateRef.current.positionX,
        initY: stateRef.current.positionY,
      };
      dragStartRef.current = null;
    }
  }, [handleToggleZoom]);

  // Pointer Move (Mouse drag or touch pinch/drag)
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const map = pointersRef.current;
    if (!map.has(e.pointerId)) return;

    map.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    const el = viewportRef.current;
    if (!el) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const cWidth = rect.width;
      const cHeight = rect.height;
      if (cWidth <= 0 || cHeight <= 0) return;

      const cAspect = cWidth / cHeight;
      const aspect = naturalAspect || cAspect;
      const currentFit = stateRef.current.fit;

      let baseW = cWidth;
      let baseH = cHeight;

      if (currentFit === "contain") {
        if (aspect > cAspect) {
          baseW = cWidth;
          baseH = cWidth / aspect;
        } else {
          baseH = cHeight;
          baseW = cHeight * aspect;
        }
      } else {
        if (aspect > cAspect) {
          baseH = cHeight;
          baseW = cHeight * aspect;
        } else {
          baseW = cWidth;
          baseH = cWidth / aspect;
        }
      }

      // Handle 2-finger pinch
      if (map.size >= 2 && pinchStartRef.current) {
        const points = Array.from(map.values());
        const p1 = points[0];
        const p2 = points[1];
        const dist = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
        const ratio = dist / pinchStartRef.current.initialDist;

        const nextZoom = Math.max(
          minZoom,
          Math.min(maxZoom, Math.round(pinchStartRef.current.initialZoom * ratio))
        );

        // Also track translation while pinching
        const midX = (p1.clientX + p2.clientX) / 2;
        const midY = (p1.clientY + p2.clientY) / 2;
        const dMidX = midX - pinchStartRef.current.initialMidX;
        const dMidY = midY - pinchStartRef.current.initialMidY;

        const renderedW = baseW * (nextZoom / 100);
        const renderedH = baseH * (nextZoom / 100);
        const panXRange = Math.max(0, renderedW - cWidth);
        const panYRange = Math.max(0, renderedH - cHeight);

        let nextX = pinchStartRef.current.initX;
        let nextY = pinchStartRef.current.initY;

        if (panXRange > 0) {
          nextX = Math.max(0, Math.min(100, Math.round(pinchStartRef.current.initX - (dMidX / panXRange) * 100)));
        }
        if (panYRange > 0) {
          nextY = Math.max(0, Math.min(100, Math.round(pinchStartRef.current.initY - (dMidY / panYRange) * 100)));
        }

        onChangeRef.current({
          zoom: nextZoom,
          positionX: nextX,
          positionY: nextY,
        });
        return;
      }

      // Handle 1-finger / mouse drag
      if (dragStartRef.current) {
        const dx = e.clientX - dragStartRef.current.startX;
        const dy = e.clientY - dragStartRef.current.startY;

        const currentZ = stateRef.current.zoom;
        const renderedW = baseW * (currentZ / 100);
        const renderedH = baseH * (currentZ / 100);

        const panXRange = Math.max(0, renderedW - cWidth);
        const panYRange = Math.max(0, renderedH - cHeight);

        let newX = dragStartRef.current.initX;
        let newY = dragStartRef.current.initY;

        if (panXRange > 0) {
          const deltaX = - (dx / panXRange) * 100;
          newX = Math.max(0, Math.min(100, Math.round(dragStartRef.current.initX + deltaX)));
        } else {
          // If image width matches container, keep centered
          newX = 50;
        }

        if (panYRange > 0) {
          const deltaY = - (dy / panYRange) * 100;
          newY = Math.max(0, Math.min(100, Math.round(dragStartRef.current.initY + deltaY)));
        } else {
          // If image height matches container, keep standard subject position
          newY = Math.max(0, Math.min(100, dragStartRef.current.initY));
        }

        onChangeRef.current({
          positionX: newX,
          positionY: newY,
        });
      }
    });
  }, [minZoom, maxZoom, naturalAspect]);

  // Pointer Up or Cancel
  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // safe fallback
    }

    const map = pointersRef.current;
    map.delete(e.pointerId);

    if (map.size === 0) {
      setIsInteracting(false);
      dragStartRef.current = null;
      pinchStartRef.current = null;
    } else if (map.size === 1) {
      // Switch to remaining pointer as new drag anchor
      const remaining = Array.from(map.entries())[0];
      dragStartRef.current = {
        startX: remaining[1].clientX,
        startY: remaining[1].clientY,
        initX: stateRef.current.positionX,
        initY: stateRef.current.positionY,
      };
      pinchStartRef.current = null;
    }
  }, []);

  return {
    viewportRef,
    isInteracting,
    handleReset,
    handleToggleZoom,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    zoom,
    positionX,
    positionY,
  };
}
