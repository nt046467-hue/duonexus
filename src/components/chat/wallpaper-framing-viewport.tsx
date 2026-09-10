"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Video,
  Phone,
  Flame,
  Smile,
  Send,
  Plus,
  RotateCcw,
  ZoomIn,
  Move,
  CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatWallpaperLayer } from "./chat-wallpaper-layer";
import { useWallpaperTransform } from "./use-wallpaper-transform";
import { Slider } from "@/components/ui/slider";

export interface WallpaperFramingViewportProps {
  imageSrc: string;
  positionX: number;
  positionY: number;
  zoom: number;
  fit?: "smart" | "cover" | "contain";
  opacity: number;
  device?: "desktop" | "mobile";
  isDark?: boolean;
  partnerName?: string;
  partnerAvatar?: string;
  isPartnerOnline?: boolean;
  streak?: number;
  onChange: (updates: { positionX?: number; positionY?: number; zoom?: number }) => void;
  className?: string;
  showControlsBar?: boolean;
}

export function WallpaperFramingViewport({
  imageSrc,
  positionX,
  positionY,
  zoom,
  fit = "smart",
  opacity,
  device = "desktop",
  isDark = true,
  partnerName,
  partnerAvatar,
  isPartnerOnline = true,
  streak,
  onChange,
  className,
  showControlsBar = true,
}: WallpaperFramingViewportProps) {
  const [showHint, setShowHint] = useState(true);

  // Auto-fade instruction hint after 3.2 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowHint(false);
    }, 3200);
    return () => clearTimeout(timer);
  }, []);

  const {
    viewportRef,
    isInteracting,
    handleReset,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useWallpaperTransform({
    positionX,
    positionY,
    zoom,
    fit,
    imageSrc,
    minZoom: 100,
    maxZoom: 250,
    onChange,
  });

  const isPhone = device === "mobile";
  const displayName = partnerName || "Karu";
  const displayAvatar =
    partnerAvatar ||
    (displayName.toLowerCase().includes("nabin") ? "/avatars/nabin.png" : "/avatars/karu.png");

  return (
    <div className={cn("flex flex-col items-center w-full select-none", className)}>
      {/* ── DEVICE MOCKUP CONTAINER ── */}
      <div
        className={cn(
          "relative overflow-hidden transition-all duration-300",
          isPhone
            ? "w-[245px] sm:w-[270px] aspect-[9/18.5] rounded-[38px] shadow-2xl border-[6px] border-zinc-900 ring-1 ring-white/15 bg-zinc-950 flex flex-col justify-between"
            : "w-full aspect-[16/10] max-h-[440px] rounded-2xl sm:rounded-3xl shadow-2xl border-2 border-border/50 ring-1 ring-primary/15 bg-zinc-950 flex flex-col justify-between"
        )}
      >
        {/* Dynamic Island / Top Speaker Bar for Phone mode */}
        {isPhone && (
          <div className="absolute top-2.5 inset-x-0 z-30 flex justify-center pointer-events-none">
            <div className="w-20 h-4 bg-black rounded-full border border-white/10 flex items-center justify-end px-2.5">
              <div className="w-2 h-2 rounded-full bg-zinc-900 border border-blue-500/40" />
            </div>
          </div>
        )}

        {/* ── DRAGGABLE & PINCHABLE FRAMING CANVAS ── */}
        <div
          ref={viewportRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={cn(
            "absolute inset-0 z-0 touch-none overflow-hidden",
            isInteracting ? "cursor-grabbing" : "cursor-grab"
          )}
          style={{ touchAction: "none" }}
          aria-label="Wallpaper framing canvas. Drag to move, pinch or scroll to zoom, double-click to toggle zoom."
          tabIndex={0}
        >
          {/* Real Wallpaper Rendering Layer */}
          <ChatWallpaperLayer
            src={imageSrc}
            positionX={positionX}
            positionY={positionY}
            zoom={zoom}
            fit={fit}
            opacity={opacity}
            isDark={isDark}
          />

          {/* Rule-of-Thirds Grid (Appears smoothly when dragging/pinching) */}
          <div
            className={cn(
              "absolute inset-0 pointer-events-none transition-opacity duration-200 z-10",
              isInteracting ? "opacity-35" : "opacity-0"
            )}
          >
            <div className="w-full h-1/3 border-b border-white/30" />
            <div className="w-full h-1/3 border-b border-white/30" />
            <div className="absolute top-0 bottom-0 left-1/3 border-r border-white/30" />
            <div className="absolute top-0 bottom-0 left-2/3 border-r border-white/30" />
          </div>
        </div>

        {/* ── REALISTIC CHAT HEADER OVERLAY ── */}
        <div
          className={cn(
            "relative z-20 pointer-events-none flex items-center justify-between border-b backdrop-blur-md transition-colors shrink-0",
            isDark
              ? "bg-[#18181A]/80 border-white/10 text-white"
              : "bg-white/80 border-black/10 text-gray-900",
            isPhone ? "pt-7 pb-2 px-3" : "py-2 px-3.5"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {isPhone && (
              <ArrowLeft className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
            {/* Avatar with online dot */}
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 p-0.5 shadow-sm">
                <img
                  src={displayAvatar}
                  alt={displayName}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <span
                className={cn(
                  "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-zinc-950",
                  isPartnerOnline ? "bg-emerald-500" : "bg-gray-400"
                )}
              />
            </div>

            {/* Name and active status */}
            <div className="flex flex-col min-w-0">
              <span className="text-[12px] font-bold leading-tight flex items-center gap-1 truncate">
                {displayName} <span className="text-red-500 text-[10px]">❤️</span>
              </span>
              <span
                className={cn(
                  "text-[9px] font-medium leading-none mt-0.5 truncate",
                  isPartnerOnline ? "text-emerald-500 font-semibold" : "text-muted-foreground"
                )}
              >
                {isPartnerOnline ? "Active now" : "Offline"}
              </span>
            </div>
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            {/* Streak Badge */}
            <div className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded-full text-amber-500">
              <Flame className="w-2.5 h-2.5 fill-amber-500" />
              <span className="text-[10px] font-bold">{typeof streak === "number" ? streak : 14}</span>
            </div>
            {!isPhone && (
              <>
                <div className="w-6 h-6 rounded-full bg-muted/40 flex items-center justify-center">
                  <Video className="w-3 h-3 text-blue-500" />
                </div>
                <div className="w-6 h-6 rounded-full bg-muted/40 flex items-center justify-center">
                  <Phone className="w-3 h-3 text-emerald-500" />
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── REALISTIC CONVERSATION AREA (MESSAGE BUBBLES) ── */}
        <div className="relative z-20 pointer-events-none flex-1 flex flex-col justify-end p-3 space-y-2 overflow-hidden">
          {/* Subtle auto-fading gesture hint */}
          <div
            className={cn(
              "mx-auto my-auto transition-all duration-500 transform",
              showHint && !isInteracting
                ? "opacity-100 scale-100"
                : "opacity-0 scale-95 pointer-events-none"
            )}
          >
            <div className="bg-black/75 backdrop-blur-md text-white/90 text-[11px] font-semibold px-3 py-1 rounded-full shadow-lg border border-white/15 flex items-center gap-1.5">
              <Move className="w-3 h-3 text-primary animate-pulse" />
              <span>{isPhone ? "Drag to move • Pinch to zoom" : "Drag to move • Scroll to zoom"}</span>
            </div>
          </div>

          {/* Incoming Message Bubble */}
          <div className="max-w-[80%] flex flex-col items-start space-y-0.5">
            <div
              className={cn(
                "rounded-2xl rounded-tl-xs px-3 py-1.5 shadow-sm text-[11px] font-medium leading-relaxed backdrop-blur-sm border",
                isDark
                  ? "bg-[#1f2c34]/95 text-gray-100 border-white/10"
                  : "bg-white/95 text-gray-900 border-gray-200/80"
              )}
            >
              Love this wallpaper! It feels so warm and calm 💕
            </div>
            <span className="text-[8px] text-white/70 px-1 font-medium">10:42 AM</span>
          </div>

          {/* Outgoing Message Bubble */}
          <div className="max-w-[80%] ml-auto flex flex-col items-end space-y-0.5">
            <div className="rounded-2xl rounded-tr-xs px-3 py-1.5 shadow-sm text-[11px] font-medium leading-relaxed bg-[#1877F2] text-white">
              Looks so clear and beautiful on our chat ✨
            </div>
            <div className="flex items-center gap-1 px-1 text-[8px] text-white/70 font-medium">
              <span>10:43 AM</span>
              <CheckCheck className="w-3 h-3 text-sky-300" />
            </div>
          </div>
        </div>

        {/* ── REALISTIC BOTTOM COMPOSER INPUT ── */}
        <div
          className={cn(
            "relative z-20 pointer-events-none border-t backdrop-blur-md transition-colors shrink-0",
            isDark
              ? "bg-[#18181A]/80 border-white/10"
              : "bg-white/80 border-black/10",
            isPhone ? "pb-4 pt-2 px-3" : "py-2 px-3"
          )}
        >
          <div className="flex items-center gap-2 w-full">
            <div className="w-6 h-6 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground shrink-0">
              <Plus className="w-3.5 h-3.5" />
            </div>

            <div
              className={cn(
                "flex-1 h-7 rounded-full flex items-center px-3 border text-[10px] text-muted-foreground",
                isDark
                  ? "bg-zinc-800/80 border-white/10"
                  : "bg-gray-100/90 border-gray-200"
              )}
            >
              <span>Type a message...</span>
            </div>

            <div className="w-6 h-6 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground shrink-0">
              <Smile className="w-3 h-3" />
            </div>

            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-xs shrink-0">
              <Send className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>

      {/* ── SECONDARY CONTROLS BAR ── */}
      {showControlsBar && (
        <div className="flex items-center justify-between gap-3 w-full max-w-[420px] mt-2.5 px-2">
          {/* Zoom Indicator Badge */}
          <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground font-mono">
            <ZoomIn className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>{(zoom / 100).toFixed(1)}x</span>
            <span className="text-[10px] opacity-70">({zoom}%)</span>
          </div>

          {/* Quick Slider */}
          <div className="flex-1 max-w-[200px]">
            <Slider
              value={[zoom]}
              min={100}
              max={250}
              step={5}
              onValueChange={(vals) => onChange({ zoom: vals[0] })}
              aria-label="Wallpaper zoom"
            />
          </div>

          {/* Reset Framing Button */}
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary active:scale-95 transition-all px-2 py-1 rounded-lg hover:bg-muted/40"
            title="Reset to default framing"
            aria-label="Reset framing"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      )}
    </div>
  );
}
