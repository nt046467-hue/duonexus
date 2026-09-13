"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvatarCropModalProps {
  open: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onCropComplete: (croppedBase64: string) => void;
  isDark?: boolean;
}

interface Point {
  x: number;
  y: number;
}

export function AvatarCropModal({
  open,
  imageSrc,
  onClose,
  onCropComplete,
  isDark = true,
}: AvatarCropModalProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState<number>(260);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Active pointers tracker for multi-touch (pinch-zoom + pan)
  const pointersRef = useRef<Map<number, Point>>(new Map());
  // Track previous positions for reliable delta computation on mobile
  const prevPositionsRef = useRef<Map<number, Point>>(new Map());
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);
  const lastPanRef = useRef<Point>({ x: 0, y: 0 });
  const lastMidpointRef = useRef<Point | null>(null);

  // Measure crop viewport diameter dynamically
  useEffect(() => {
    if (!open || !viewportRef.current) return;
    const updateSize = () => {
      if (viewportRef.current) {
        const rect = viewportRef.current.getBoundingClientRect();
        if (rect.width > 0) {
          setViewportSize(rect.width);
        }
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(viewportRef.current);
    return () => ro.disconnect();
  }, [open]);

  // Load natural image dimensions when imageSrc changes
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.onload = () => {
      setImgSize({ width: img.naturalWidth, height: img.naturalHeight });
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      pointersRef.current.clear();
      prevPositionsRef.current.clear();
      pinchStartDistRef.current = null;
      lastMidpointRef.current = null;
    }
  }, [open]);

  // Helper to clamp pan boundaries so image NEVER reveals gaps or edges
  const clampPan = useCallback(
    (p: Point, currentZoom: number, d = viewportSize, size = imgSize): Point => {
      if (!size.width || !size.height || d <= 0) return { x: 0, y: 0 };
      const cover = Math.max(d / size.width, d / size.height);
      const renderedW = size.width * cover * currentZoom;
      const renderedH = size.height * cover * currentZoom;
      const maxX = Math.max(0, (renderedW - d) / 2);
      const maxY = Math.max(0, (renderedH - d) / 2);
      return {
        x: Math.max(-maxX, Math.min(maxX, p.x)),
        y: Math.max(-maxY, Math.min(maxY, p.y)),
      };
    },
    [viewportSize, imgSize]
  );

  // Wheel zoom listener (Desktop / Trackpad)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !open) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomDelta = -e.deltaY * 0.002;
      setZoom((prevZoom) => {
        const nextZoom = Math.max(1.0, Math.min(3.5, prevZoom + zoomDelta));
        setPan((prevPan) => clampPan(prevPan, nextZoom));
        return nextZoom;
      });
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [open, clampPan]);

  // Calculate distance between two touch points
  const getPointersDistance = (p1: Point, p2: Point) => {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  };

  // Calculate midpoint between two touch points
  const getPointersMidpoint = (p1: Point, p2: Point): Point => {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };
  };

  // Pointer Down (Mouse or 1/2 Fingers Touch)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const target = e.currentTarget;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {}

    const pt = { x: e.clientX, y: e.clientY };
    pointersRef.current.set(e.pointerId, pt);
    prevPositionsRef.current.set(e.pointerId, pt);

    const pts = Array.from(pointersRef.current.values());
    if (pts.length === 1) {
      lastPanRef.current = { ...pan };
    } else if (pts.length === 2) {
      pinchStartDistRef.current = getPointersDistance(pts[0], pts[1]);
      pinchStartZoomRef.current = zoom;
      lastMidpointRef.current = getPointersMidpoint(pts[0], pts[1]);
      lastPanRef.current = { ...pan };
    }
  };

  // Pointer Move (Drag or Pinch)
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;

    const currentPt = { x: e.clientX, y: e.clientY };
    const prevPt = prevPositionsRef.current.get(e.pointerId) ?? currentPt;

    pointersRef.current.set(e.pointerId, currentPt);
    prevPositionsRef.current.set(e.pointerId, currentPt);

    const pts = Array.from(pointersRef.current.values());

    if (pts.length === 1) {
      // 1-finger / Mouse drag to pan — delta from last known position (works on touch too)
      const dx = currentPt.x - prevPt.x;
      const dy = currentPt.y - prevPt.y;

      setPan((prevPan) => {
        const nextPan = { x: prevPan.x + dx, y: prevPan.y + dy };
        return clampPan(nextPan, zoom);
      });
    } else if (pts.length >= 2 && pinchStartDistRef.current !== null) {
      // 2-finger Pinch to Zoom & Pan simultaneously
      const newDist = getPointersDistance(pts[0], pts[1]);
      const currentMid = getPointersMidpoint(pts[0], pts[1]);

      const scaleRatio = newDist / (pinchStartDistRef.current || 1);
      const nextZoom = Math.max(1.0, Math.min(3.5, pinchStartZoomRef.current * scaleRatio));

      let nextPan = { ...pan };
      if (lastMidpointRef.current) {
        const dx = currentMid.x - lastMidpointRef.current.x;
        const dy = currentMid.y - lastMidpointRef.current.y;
        nextPan = { x: pan.x + dx, y: pan.y + dy };
      }
      lastMidpointRef.current = currentMid;

      setZoom(nextZoom);
      setPan(clampPan(nextPan, nextZoom));
    }
  };

  // Pointer Up / Cancel
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    prevPositionsRef.current.delete(e.pointerId);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const remaining = Array.from(pointersRef.current.values());
    if (remaining.length === 1) {
      // Transitioning from 2-touch to 1-touch: reinitialize single drag tracking
      pinchStartDistRef.current = null;
      lastMidpointRef.current = null;
      lastPanRef.current = { ...pan };
      // Re-register prev positions for remaining pointer so next move has a valid prev
      pointersRef.current.forEach((pt, id) => {
        prevPositionsRef.current.set(id, pt);
      });
    } else if (remaining.length === 0) {
      pinchStartDistRef.current = null;
      lastMidpointRef.current = null;
    }
  };

  // Double tap / double click to toggle zoom
  const handleDoubleClick = () => {
    if (zoom > 1.15) {
      setZoom(1.0);
      setPan({ x: 0, y: 0 });
    } else {
      const targetZoom = 1.6;
      setZoom(targetZoom);
      setPan((prev) => clampPan(prev, targetZoom));
    }
  };

  // Render cropped circular image to canvas and export base64
  const handleSaveCrop = useCallback(() => {
    if (!imageRef.current || !imgSize.width || !imgSize.height) return;
    setIsSubmitting(true);

    try {
      const CROP_SIZE = 512; // Crisp, high resolution 512x512 square
      const canvas = document.createElement("canvas");
      canvas.width = CROP_SIZE;
      canvas.height = CROP_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const d = viewportSize > 0 ? viewportSize : 260;
      const scaleFactor = CROP_SIZE / d;

      // Fill background
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, CROP_SIZE, CROP_SIZE);

      ctx.save();
      // Center canvas for transforms
      ctx.translate(CROP_SIZE / 2, CROP_SIZE / 2);

      // Apply pan scaled up to output resolution
      ctx.translate(pan.x * scaleFactor, pan.y * scaleFactor);

      // Apply zoom
      ctx.scale(zoom, zoom);

      // Calculate base cover dimensions
      const cover = Math.max(d / imgSize.width, d / imgSize.height);
      const drawW = imgSize.width * cover * scaleFactor;
      const drawH = imgSize.height * cover * scaleFactor;

      ctx.drawImage(imageRef.current, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      onCropComplete(dataUrl);
      onClose();
    } catch (err) {
      console.error("Failed to crop image:", err);
    } finally {
      setIsSubmitting(false);
    }
  }, [pan, zoom, imgSize, viewportSize, onCropComplete, onClose]);

  if (!open || !imageSrc) return null;

  // Calculate base display dimensions covering the circular viewport
  const coverRatio =
    imgSize.width && imgSize.height && viewportSize > 0
      ? Math.max(viewportSize / imgSize.width, viewportSize / imgSize.height)
      : 1;
  const baseWidth = imgSize.width ? imgSize.width * coverRatio : viewportSize;
  const baseHeight = imgSize.height ? imgSize.height * coverRatio : viewportSize;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        hideCloseButton={true}
        className={cn(
          "max-w-md w-[92vw] sm:w-full rounded-3xl p-5 sm:p-6 border shadow-2xl select-none z-[130] focus:outline-none",
          isDark
            ? "bg-[#141416] text-white border-zinc-800"
            : "bg-white text-gray-900 border-gray-200"
        )}
      >
        {/* Header: Title + SINGLE clean accessible close button */}
        <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-white/10 dark:border-zinc-800/80">
          <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight">
            Adjust Profile Picture
          </DialogTitle>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>

        {/* Viewport Mask Zone (Modern Gesture Cropper) */}
        <div className="flex flex-col items-center justify-center my-3 sm:my-4">
          <div
            ref={viewportRef}
            className="relative w-[min(72vw,280px)] h-[min(72vw,280px)] rounded-full overflow-hidden shadow-2xl border-4 border-emerald-500/80 cursor-grab active:cursor-grabbing touch-none select-none bg-black flex items-center justify-center"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onDoubleClick={handleDoubleClick}
            role="region"
            aria-label="Profile photo crop area. Drag to reposition, pinch or scroll to zoom."
          >
            {/* Image being manipulated */}
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Crop target"
              draggable={false}
              className="absolute pointer-events-none max-w-none will-change-transform select-none"
              style={{
                width: `${baseWidth}px`,
                height: `${baseHeight}px`,
                left: "50%",
                top: "50%",
                marginLeft: `-${baseWidth / 2}px`,
                marginTop: `-${baseHeight / 2}px`,
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                transformOrigin: "center center",
              }}
            />

            {/* Subtle alignment crosshair overlay */}
            <div className="absolute inset-0 pointer-events-none border border-white/20 rounded-full" />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-25">
              <div className="w-full h-px bg-white/40" />
              <div className="absolute h-full w-px bg-white/40" />
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-3 text-center">
            Drag to reposition · Pinch or scroll to zoom
          </p>
        </div>

        {/* Action Buttons: Cancel and Set Photo */}
        <div className="flex items-center gap-3 pt-3 border-t border-white/10 dark:border-zinc-800/80">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className={cn(
              "flex-1 rounded-2xl h-11 text-sm font-semibold transition-all",
              isDark
                ? "border-zinc-700 text-gray-300 hover:bg-zinc-800"
                : "border-gray-200 text-gray-700 hover:bg-gray-100"
            )}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSaveCrop}
            disabled={isSubmitting}
            className="flex-1 rounded-2xl h-11 text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Set Photo</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
