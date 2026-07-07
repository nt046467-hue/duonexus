
"use client";

import { useState, useRef, useCallback } from "react";
import { X, Download, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaViewerProps {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
}

export function MediaViewer({ src, alt = "Image", open, onClose }: MediaViewerProps) {
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [dragDeltaY, setDragDeltaY] = useState(0);
  const overlayRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    setScale(1);
    setDragDeltaY(0);
  };

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose]);

  const handleDownload = async () => {
    if (!src) return;
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `duonexus-photo-${Date.now()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    } catch {
      window.open(src, "_blank");
    }
  };

  // Swipe-to-dismiss touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (scale > 1) return; // only swipe to dismiss when not zoomed
    setIsDragging(true);
    setStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || scale > 1) return;
    const delta = e.touches[0].clientY - startY;
    if (delta > 0) setDragDeltaY(delta);
  };

  const handleTouchEnd = () => {
    if (dragDeltaY > 120) {
      handleClose();
    } else {
      setDragDeltaY(0);
    }
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    setScale((prev) => (prev > 1 ? 1 : 2.5));
  };

  if (!open) return null;

  const opacity = Math.max(0, 1 - dragDeltaY / 300);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black"
      style={{ opacity }}
      onClick={(e) => {
        if (e.target === overlayRef.current) handleClose();
      }}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
        <button
          onClick={handleClose}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale((s) => Math.max(1, s - 0.5))}
            disabled={scale <= 1}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-30"
          >
            <ZoomOut className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={() => setScale((s) => Math.min(4, s + 0.5))}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ZoomIn className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={handleDownload}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <Download className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Image */}
      <div
        className="flex items-center justify-center w-full h-full overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
        style={{
          transform: `translateY(${dragDeltaY}px)`,
          transition: isDragging ? "none" : "transform 0.3s ease",
          cursor: scale > 1 ? "zoom-out" : "zoom-in",
        }}
      >
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain select-none"
          style={{
            transform: `scale(${scale})`,
            transition: "transform 0.2s ease",
          }}
          draggable={false}
        />
      </div>

      {/* Swipe hint */}
      {scale === 1 && (
        <p className="absolute bottom-8 text-white/40 text-[10px] font-headline uppercase tracking-widest pointer-events-none">
          Swipe down to close · Double-tap to zoom
        </p>
      )}
    </div>
  );
}
