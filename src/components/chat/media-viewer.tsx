
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Download, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaViewerProps {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
  usePortal?: boolean;
}

export function MediaViewer({ src, alt = "Image", open, onClose, usePortal = true }: MediaViewerProps) {
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [dragDeltaY, setDragDeltaY] = useState(0);
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Set mounted state for hydration safety in SSR / Next.js
  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!open || !mounted) return null;

  const opacity = Math.max(0, 1 - dragDeltaY / 350);

  const viewerContent = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md transition-opacity duration-200 select-none animate-in fade-in"
      style={{ opacity }}
      onClick={(e) => {
        // Only close when tapping the backdrop itself, not any child element
        if (e.target === overlayRef.current) handleClose();
      }}
    >
      {/* Top bar — pointer-events-auto ensures taps hit buttons even over swipe area */}
      <div
        className="absolute top-0 left-0 right-0 z-[10001] flex items-center justify-between p-4 pb-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent safe-top pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleClose();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleClose();
          }}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 active:scale-90 transition-all touch-manipulation cursor-pointer"
          aria-label="Close viewer"
          type="button"
        >
          <X className="w-6 h-6 text-white pointer-events-none" />
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale((s) => Math.max(1, s - 0.5))}
            disabled={scale <= 1}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-transform disabled:opacity-30 touch-manipulation"
            type="button"
          >
            <ZoomOut className="w-4 h-4 text-white pointer-events-none" />
          </button>
          <button
            onClick={() => setScale((s) => Math.min(4, s + 0.5))}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-transform touch-manipulation"
            type="button"
          >
            <ZoomIn className="w-4 h-4 text-white pointer-events-none" />
          </button>
          <button
            onClick={handleDownload}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-transform touch-manipulation"
            type="button"
          >
            <Download className="w-4 h-4 text-white pointer-events-none" />
          </button>
        </div>
      </div>

      {/* Image Container */}
      <div
        className="flex items-center justify-center w-full h-full p-4 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
        style={{
          transform: `translateY(${dragDeltaY}px)`,
          transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          cursor: scale > 1 ? "zoom-out" : "zoom-in",
        }}
      >
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-[85vh] object-contain select-none shadow-2xl rounded-lg"
          style={{
            transform: `scale(${scale})`,
            transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
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

  if (usePortal) {
    return createPortal(viewerContent, document.body);
  }
  return viewerContent;
}

