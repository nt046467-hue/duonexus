"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RotateCw, ZoomIn, Check, X, Undo } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvatarCropModalProps {
  open: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onCropComplete: (croppedBase64: string) => void;
  isDark?: boolean;
}

export function AvatarCropModal({
  open,
  imageSrc,
  onClose,
  onCropComplete,
  isDark = true,
}: AvatarCropModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [angle, setAngle] = useState(0); // -45 to +45 subtle angle tilt
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Reset controls when a new image is loaded
  useEffect(() => {
    if (open) {
      setZoom(1);
      setRotation(0);
      setAngle(0);
      setPan({ x: 0, y: 0 });
    }
  }, [open, imageSrc]);

  const handleRotate90 = () => {
    setRotation((r) => (r + 90) % 360);
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setAngle(0);
    setPan({ x: 0, y: 0 });
  };

  // Mouse & Touch Pan handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Render cropped circular image to canvas and export base64
  const handleSaveCrop = useCallback(() => {
    if (!imageRef.current) return;
    const img = imageRef.current;

    const CROP_SIZE = 400; // High resolution 400x400 output
    const canvas = document.createElement("canvas");
    canvas.width = CROP_SIZE;
    canvas.height = CROP_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Viewport preview circle is 220px on screen
    const PREVIEW_SIZE = 220;
    const scaleFactor = CROP_SIZE / PREVIEW_SIZE;

    // Background fill
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, CROP_SIZE, CROP_SIZE);

    // Save context state
    ctx.save();

    // Center canvas for transforms
    ctx.translate(CROP_SIZE / 2, CROP_SIZE / 2);

    // Apply pan scaled up to output resolution
    ctx.translate(pan.x * scaleFactor, pan.y * scaleFactor);

    // Total rotation angle = 90deg steps + angle tilt
    const totalRad = ((rotation + angle) * Math.PI) / 180;
    ctx.rotate(totalRad);

    // Apply zoom
    ctx.scale(zoom, zoom);

    // Draw the source image centered
    // Calculate aspect ratio fit into preview area
    const imgAspect = img.naturalWidth / img.naturalHeight;
    let drawW: number;
    let drawH: number;
    if (imgAspect >= 1) {
      drawH = PREVIEW_SIZE * scaleFactor;
      drawW = drawH * imgAspect;
    } else {
      drawW = PREVIEW_SIZE * scaleFactor;
      drawH = drawW / imgAspect;
    }

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

    ctx.restore();

    // Compress as clean JPEG at 0.88 quality (compact yet sharp)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    onCropComplete(dataUrl);
    onClose();
  }, [pan, rotation, angle, zoom, onCropComplete, onClose]);

  if (!open || !imageSrc) return null;

  const totalAngle = rotation + angle;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={cn(
          "max-w-md w-[92vw] sm:w-full rounded-3xl p-5 sm:p-6 border shadow-2xl select-none z-[130]",
          isDark
            ? "bg-[#16181B] text-white border-zinc-800"
            : "bg-white text-gray-900 border-gray-200"
        )}
      >
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-white/5">
          <DialogTitle className="text-lg sm:text-xl font-bold">
            Adjust Profile Picture
          </DialogTitle>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </DialogHeader>

        {/* Viewport Mask Zone */}
        <div className="flex flex-col items-center justify-center my-2">
          <div
            className="relative w-[240px] h-[240px] rounded-full overflow-hidden shadow-2xl border-4 border-emerald-500/80 cursor-grab active:cursor-grabbing touch-none bg-black flex items-center justify-center"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* Image being manipulated */}
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Crop target"
              draggable={false}
              className="max-w-none pointer-events-none transition-transform duration-75 origin-center will-change-transform"
              style={{
                width: "220px",
                height: "220px",
                objectFit: "contain",
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom}) rotate(${totalAngle}deg)`,
              }}
            />

            {/* Subtle alignment crosshair overlay */}
            <div className="absolute inset-0 pointer-events-none border border-white/20 rounded-full" />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30">
              <div className="w-full h-px bg-white/40" />
              <div className="absolute h-full w-px bg-white/40" />
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            Drag to reposition · Face will appear in this circle
          </p>
        </div>

        {/* Interactive Controls */}
        <div className="space-y-3.5 px-2 pt-1">
          {/* Zoom Slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-gray-400">
                <ZoomIn className="w-3.5 h-3.5" />
                Zoom
              </span>
              <span className="text-emerald-400 font-mono">{zoom.toFixed(1)}x</span>
            </div>
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.05}
              onValueChange={([val]) => setZoom(val)}
              className="cursor-pointer"
            />
          </div>

          {/* Angle Tilt Slider (-45° to +45°) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-gray-400">
                Angle Adjustment
              </span>
              <span className="text-emerald-400 font-mono">{angle > 0 ? `+${angle}°` : `${angle}°`}</span>
            </div>
            <Slider
              value={[angle]}
              min={-45}
              max={45}
              step={1}
              onValueChange={([val]) => setAngle(val)}
              className="cursor-pointer"
            />
          </div>

          {/* Quick Buttons: Rotate 90° & Reset */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleRotate90}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 border transition-all active:scale-95 cursor-pointer",
                isDark
                  ? "bg-zinc-800/80 border-zinc-700 text-gray-200 hover:bg-zinc-700"
                  : "bg-gray-100 border-gray-200 text-gray-800 hover:bg-gray-200"
              )}
            >
              <RotateCw className="w-3.5 h-3.5" />
              Rotate 90°
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Undo className="w-3 h-3" />
              Reset
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 pt-4 mt-2 border-t border-white/5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className={cn(
              "flex-1 rounded-xl h-11 text-sm font-semibold",
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
            className="flex-1 rounded-xl h-11 text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-1.5 active:scale-98 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            Set Photo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
