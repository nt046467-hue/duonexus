"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Palette,
  Upload,
  Check,
  Sparkles,
  RotateCcw,
  ImagePlus,
  RefreshCw,
  Wand2,
  Eye,
  SlidersHorizontal,
  ArrowLeft,
  Loader2,
  HeartHandshake,
  CheckCircle2,
  AlertCircle,
  Move,
  ZoomIn,
  Crop,
  Monitor,
  Smartphone,
  Maximize2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useViewport } from "@/hooks/use-viewport";
import {
  generateWallpaperAction,
  WallpaperStyle,
} from "@/ai/flows/wallpaper-generator";
import { processPhotographicWallpaper } from "@/lib/photo-wallpaper";

export interface WallpaperConfig {
  id: "doodles" | "sunset" | "midnight" | "blossom" | "minimal" | "custom";
  customUrl?: string;
  originalPhotoUrl?: string;
  opacity: number;
  positionX?: number; // 0 (left) to 100 (right), default 50
  positionY?: number; // 0 (top/faces) to 100 (bottom), default 35
  zoom?: number;      // 100 to 250, default 100
  fit?: "smart" | "cover" | "contain";
  styleName?: string;
}

export const DEFAULT_WALLPAPER: WallpaperConfig = {
  id: "doodles", // Messenger Love photorealistic wallpaper
  opacity: 85,
  positionX: 50,
  positionY: 35,
  zoom: 100,
  fit: "smart",
};

interface WallpaperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentConfig: WallpaperConfig;
  onSaveConfig: (config: WallpaperConfig) => void;
  isDark: boolean;
}

export const PRESET_WALLPAPERS = [
  {
    id: "sunset" as const,
    name: "Romantic Sunset",
    desc: "Realistic golden hour sunset over calm ocean and soft hills",
    image: "/wallpapers/romantic-sunset.jpg",
  },
  {
    id: "midnight" as const,
    name: "Midnight Stars",
    desc: "Authentic starry night sky with Milky Way shimmer",
    image: "/wallpapers/midnight-stars.jpg",
  },
  {
    id: "blossom" as const,
    name: "Cherry Blossom",
    desc: "Natural spring sakura branch with soft morning daylight",
    image: "/wallpapers/cherry-blossom.jpg",
  },
  {
    id: "minimal" as const,
    name: "Velvet Minimal",
    desc: "Modern minimalist architectural dark fluted wall texture",
    image: "/wallpapers/velvet-minimal.jpg",
  },
  {
    id: "doodles" as const,
    name: "Messenger Love",
    desc: "Tasteful realistic romantic couple photography in warm light",
    image: "/wallpapers/messenger-love.jpg",
  },
];

const STYLE_OPTIONS: { id: WallpaperStyle; label: string; icon: string; desc: string }[] = [
  {
    id: "cinematic",
    label: "Cinematic",
    icon: "🎬",
    desc: "35mm warm tone, gentle anamorphic mood",
  },
  {
    id: "golden_hour",
    label: "Golden Hour",
    icon: "🌅",
    desc: "Warm amber glow & tender rim lighting",
  },
  {
    id: "dreamy_soft",
    label: "Dreamy Glow",
    icon: "🌸",
    desc: "Soft daylight diffusion & romantic pastel tone",
  },
  {
    id: "clean_studio",
    label: "Clean Studio",
    icon: "📸",
    desc: "Crisp natural tones & calm neutral balance",
  },
  {
    id: "film_noir",
    label: "Velvet Noir",
    icon: "🖤",
    desc: "High tonal monochrome & velvety shadows",
  },
];

export function WallpaperDialog({
  open,
  onOpenChange,
  currentConfig,
  onSaveConfig,
  isDark,
}: WallpaperDialogProps) {
  const { isMobile, isMounted } = useViewport();
  const [selectedId, setSelectedId] = useState<WallpaperConfig["id"]>(currentConfig.id);
  const [customUrl, setCustomUrl] = useState<string | undefined>(currentConfig.customUrl);
  const [originalPhotoUrl, setOriginalPhotoUrl] = useState<string | undefined>(
    currentConfig.originalPhotoUrl || currentConfig.customUrl
  );
  const [opacity, setOpacity] = useState<number>(currentConfig.opacity || 85);
  const [positionX, setPositionX] = useState<number>(
    typeof currentConfig.positionX === "number" ? currentConfig.positionX : 50
  );
  const [positionY, setPositionY] = useState<number>(
    typeof currentConfig.positionY === "number" ? currentConfig.positionY : 25
  );
  const [zoom, setZoom] = useState<number>(currentConfig.zoom || 100);
  const [fitMode, setFitMode] = useState<"smart" | "cover" | "contain">(currentConfig.fit || "smart");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "mobile" : "desktop"
  );
  const [isDraggingFraming, setIsDraggingFraming] = useState(false);
  const [isMobileFramingOpen, setIsMobileFramingOpen] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initPosX: number; initPosY: number } | null>(null);

  // Studio Mode State
  const [inStudioMode, setInStudioMode] = useState<boolean>(false);
  const [selectedStyle, setSelectedStyle] = useState<WallpaperStyle>("cinematic");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [previewTab, setPreviewTab] = useState<"generated" | "original">("generated");
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSelectedId(currentConfig.id);
      setCustomUrl(currentConfig.customUrl);
      setOriginalPhotoUrl(currentConfig.originalPhotoUrl || currentConfig.customUrl);
      setOpacity(currentConfig.opacity || 85);
      setPositionX(typeof currentConfig.positionX === "number" ? currentConfig.positionX : 50);
      setPositionY(typeof currentConfig.positionY === "number" ? currentConfig.positionY : 35);
      setZoom(currentConfig.zoom || 100);
      setFitMode(currentConfig.fit || "smart");
      setInStudioMode(false);
      setIsMobileFramingOpen(false);
      setErrorMessage(null);
      setGenerationMessage(null);
      if (typeof window !== "undefined") {
        setPreviewDevice(window.innerWidth < 768 ? "mobile" : "desktop");
      }
    }
  }, [open, currentConfig]);

  // Handle Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type and size (<= 15MB)
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage("Image size exceeds 15MB. Please choose a smaller photo.");
      return;
    }

    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setOriginalPhotoUrl(dataUrl);
      // Immediately set customUrl so the user sees their photo right away
      setCustomUrl(dataUrl);
      setSelectedId("custom");

      if (isMobile) {
        // On mobile: immediately open the real full-screen blue-framing cropper!
        setIsMobileFramingOpen(true);
      } else {
        // On desktop: keep original studio flow
        setInStudioMode(true);
        setPreviewTab("generated");
        await runGeneration(dataUrl, selectedStyle);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Run AI & Photographic Generation
  const runGeneration = async (photoBase64: string, style: WallpaperStyle) => {
    setIsGenerating(true);
    setErrorMessage(null);
    setGenerationMessage("Analyzing photo & composing 9:16 wallpaper...");

    try {
      // First, create the instant high-definition photographic canvas render
      const processedLocal = await processPhotographicWallpaper(photoBase64, style);
      setCustomUrl(processedLocal);

      // Attempt server AI generation with Genkit if available
      setGenerationMessage("Applying photographic depth & calm chat balance...");
      const aiResult = await generateWallpaperAction({
        photoBase64,
        style,
      });

      if (aiResult.success && aiResult.wallpaperUrl && aiResult.wallpaperUrl !== photoBase64) {
        setCustomUrl(aiResult.wallpaperUrl);
        setGenerationMessage(aiResult.message || "Wallpaper generated ✨");
      } else {
        // High quality photographic styling ready
        setGenerationMessage(aiResult.message || "Photographic wallpaper ready");
      }
    } catch (err: any) {
      console.warn("Generation warning:", err);
      // Fallback: the local canvas processed image is already set
      setGenerationMessage("Photographic wallpaper ready");
    } finally {
      setIsGenerating(false);
    }
  };

  // Re-generate or try another style
  const handleRegenerate = async () => {
    if (!originalPhotoUrl) return;
    await runGeneration(originalPhotoUrl, selectedStyle);
  };

  const handleStyleChange = async (style: WallpaperStyle) => {
    setSelectedStyle(style);
    if (!originalPhotoUrl) return;
    await runGeneration(originalPhotoUrl, style);
  };

  // Save selected configuration
  const handleSave = () => {
    onSaveConfig({
      id: selectedId,
      customUrl: selectedId === "custom" ? customUrl : undefined,
      originalPhotoUrl: selectedId === "custom" ? originalPhotoUrl : undefined,
      opacity,
      positionX,
      positionY,
      zoom,
      fit: fitMode,
      styleName: selectedId === "custom" ? selectedStyle : undefined,
    });
    onOpenChange(false);
  };

  // Use this wallpaper directly from studio
  const handleApplyFromStudio = () => {
    setSelectedId("custom");
    onSaveConfig({
      id: "custom",
      customUrl,
      originalPhotoUrl,
      opacity,
      positionX,
      positionY,
      zoom,
      fit: fitMode,
      styleName: selectedStyle,
    });
    onOpenChange(false);
  };

  const handleReset = () => {
    setSelectedId(DEFAULT_WALLPAPER.id);
    setCustomUrl(undefined);
    setOriginalPhotoUrl(undefined);
    setOpacity(DEFAULT_WALLPAPER.opacity);
    setPositionX(DEFAULT_WALLPAPER.positionX ?? 50);
    setPositionY(DEFAULT_WALLPAPER.positionY ?? 35);
    setZoom(DEFAULT_WALLPAPER.zoom ?? 100);
    setFitMode("smart");
    setInStudioMode(false);
  };

  const renderStudioBody = (isMobileView: boolean) => (
    <div className="space-y-4">
      {/* Studio Preview Comparison & Device Switcher */}
      <div className="flex flex-col items-center">
        {/* Top Bar: Tabs + Device Switcher */}
        <div className={cn(
          "flex flex-wrap items-center justify-between w-full gap-2 mb-3",
          isMobileView ? "max-w-full" : "max-w-[420px]"
        )}>
          {/* Preview Tabs: Generated Wallpaper vs Original Photo */}
          <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-full border border-primary/10">
            <button
              type="button"
              onClick={() => setPreviewTab("generated")}
              className={cn(
                "flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full transition-all",
                previewTab === "generated"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className="w-3 h-3" />
              Generated
            </button>
            <button
              type="button"
              onClick={() => setPreviewTab("original")}
              className={cn(
                "flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full transition-all",
                previewTab === "original"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Eye className="w-3 h-3" />
              Original
            </button>
          </div>

          {/* Device Preview Switcher */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-full border border-primary/10">
            <button
              type="button"
              onClick={() => setPreviewDevice("desktop")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all",
                previewDevice === "desktop"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Desktop Preview"
            >
              <Monitor className="w-3 h-3" />
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice("mobile")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all",
                previewDevice === "mobile"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Phone Preview"
            >
              <Smartphone className="w-3 h-3" />
              Phone
            </button>
          </div>
        </div>

        {/* Adaptive Mock Device Display (Desktop vs Phone) */}
        <div
          className={cn(
            "relative overflow-hidden shadow-2xl border-4 border-foreground/10 ring-1 ring-primary/20 bg-zinc-950 flex flex-col justify-between p-3 select-none transition-all duration-300",
            previewDevice === "desktop"
              ? (isMobileView ? "w-full max-w-[340px] aspect-[16/10] rounded-2xl" : "w-full max-w-[420px] aspect-[16/10] rounded-2xl")
              : (isMobileView ? "w-44 aspect-[9/16] rounded-3xl" : "w-48 aspect-[9/16] rounded-3xl")
          )}
        >
          {/* Ambient Backdrop (for desktop widescreen) */}
          {previewDevice === "desktop" && (
            <div
              className="absolute inset-0 bg-cover bg-center pointer-events-none filter blur-xl scale-110 opacity-60"
              style={{
                backgroundImage: `url(${
                  previewTab === "generated" ? customUrl : originalPhotoUrl
                })`,
              }}
            />
          )}

          {/* Wallpaper Background Layer */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-500"
            style={{
              backgroundImage: `url(${
                previewTab === "generated" ? customUrl : originalPhotoUrl
              })`,
              opacity: opacity / 100,
            }}
          />

          {/* Subtle dark tint for readability */}
          <div className="absolute inset-0 bg-black/20 pointer-events-none" />

          {/* AI Generation progress overlay indicator */}
          {isGenerating && (
            <div className="absolute inset-0 z-20 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
              <p className="text-xs font-bold text-white">Synthesizing Wallpaper...</p>
              <span className="text-[10px] text-zinc-300 mt-1">
                Applying photorealistic calm lighting
              </span>
            </div>
          )}

          {/* Simulated Chat Header Overlay */}
          <div className="relative z-10 flex items-center gap-1.5 px-2 py-1.5 rounded-full bg-background/60 backdrop-blur-md border border-white/10 text-[9px] font-semibold text-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Chat Preview ({previewDevice === "desktop" ? "Desktop 16:10" : "Phone 9:16"})</span>
          </div>

          {/* Simulated Chat Bubbles */}
          <div className="relative z-10 space-y-1.5 px-1 max-w-[340px] mx-auto w-full">
            <div className="max-w-[75%] rounded-2xl rounded-tl-sm px-2.5 py-1.5 bg-background/85 dark:bg-zinc-800/90 backdrop-blur-sm border border-border/40 shadow-sm text-[10px] text-foreground font-medium">
              Love this wallpaper! 💕
            </div>
            <div className="max-w-[75%] ml-auto rounded-2xl rounded-tr-sm px-2.5 py-1.5 bg-primary text-primary-foreground shadow-sm text-[10px] font-medium">
              Looks so realistic & clear! ✨
            </div>
          </div>

          {/* Bottom input pill indicator */}
          <div className="relative z-10 h-5 rounded-full bg-background/50 backdrop-blur-md border border-white/10 flex items-center px-2 text-[8px] text-muted-foreground max-w-[340px] mx-auto w-full">
            Message...
          </div>
        </div>

        {generationMessage && (
          <p className="text-[11px] text-muted-foreground font-medium mt-2 flex items-center gap-1.5 text-center">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            {generationMessage}
          </p>
        )}
      </div>

      {/* Try Another Style - Section */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
            Try Another Style
          </label>
          <span className="text-[10px] text-muted-foreground">
            Photorealistic photography
          </span>
        </div>

        <div className={cn("grid gap-2", isMobileView ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
          {STYLE_OPTIONS.map((st) => {
            const isSelected = selectedStyle === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => handleStyleChange(st.id)}
                disabled={isGenerating}
                className={cn(
                  "flex items-start gap-2 p-2 rounded-xl border text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                    : "border-border/60 hover:border-primary/40 bg-muted/20"
                )}
              >
                <span className="text-base leading-none">{st.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{st.label}</p>
                  <p className="text-[9px] text-muted-foreground line-clamp-1">
                    {st.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* On desktop only, studio action controls inside scroll area */}
      {!isMobileView && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={isGenerating || !originalPhotoUrl}
            className="rounded-xl text-xs gap-1.5 h-9"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isGenerating && "animate-spin")} />
            Regenerate
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (originalPhotoUrl) {
                  setCustomUrl(originalPhotoUrl);
                  setSelectedId("custom");
                  onSaveConfig({
                    id: "custom",
                    customUrl: originalPhotoUrl,
                    originalPhotoUrl,
                    opacity,
                  });
                  onOpenChange(false);
                }
              }}
              className="text-xs rounded-xl h-9"
            >
              Use Original Photo
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleApplyFromStudio}
              disabled={isGenerating || !customUrl}
              className="bg-primary text-primary-foreground font-semibold rounded-xl text-xs gap-1.5 h-9 px-4 shadow-md hover:shadow-primary/20"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Use This Wallpaper
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const renderMainBody = (isMobileView: boolean) => (
    <div className="space-y-4">
      <div className={cn("grid gap-2.5", isMobileView ? "grid-cols-2 min-[420px]:grid-cols-3" : "grid-cols-3")}>
        {/* ── CARD 1: UPLOAD PHOTO ── */}
        <div
          onClick={() => {
            if (customUrl) {
              setSelectedId("custom");
              if (isMobileView) {
                setIsMobileFramingOpen(true);
              }
            } else {
              fileInputRef.current?.click();
            }
          }}
          className={cn(
            "relative aspect-[9/14] rounded-2xl overflow-hidden border-2 transition-all p-1 flex flex-col items-center justify-between text-left cursor-pointer group shadow-sm",
            selectedId === "custom"
              ? "border-primary ring-2 ring-primary/40 scale-[1.02] shadow-primary/20"
              : "border-dashed border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10"
          )}
        >
          {/* Thumbnail / Upload Placeholder */}
          <div className="w-full flex-1 rounded-xl overflow-hidden relative flex flex-col items-center justify-center bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-indigo-500/10">
            {customUrl ? (
              <>
                <img
                  src={customUrl}
                  alt="Your Uploaded Photo"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isMobileView) {
                      setIsMobileFramingOpen(true);
                    } else {
                      setInStudioMode(true);
                    }
                  }}
                  className="absolute bottom-1 right-1 p-1 rounded-lg bg-background/80 backdrop-blur-md text-foreground hover:text-primary shadow text-[9px] flex items-center gap-0.5"
                  title={isMobileView ? "Frame Photo" : "Open AI Studio"}
                >
                  <Crop className="w-3 h-3 text-pink-500" />
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-2 text-center">
                <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center mb-1 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground transition-all shadow-sm">
                  <ImagePlus className="w-4 h-4 stroke-[2.2]" />
                </div>
                <span className="text-[10px] font-bold text-foreground">Upload Photo</span>
                <span className="text-[8px] text-muted-foreground mt-0.5 line-clamp-1">
                  Create from photo
                </span>
              </div>
            )}
          </div>

          {/* Card Label */}
          <div className="w-full px-1 pt-1 flex items-center justify-between">
            <span className="text-[10px] font-bold truncate">
              {customUrl ? "Custom Photo" : "Upload Photo"}
            </span>
            {customUrl && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="text-[9px] text-primary hover:underline"
                title="Upload another photo"
              >
                Change
              </button>
            )}
          </div>

          {/* Selected Indicator */}
          {selectedId === "custom" && (
            <div className="absolute top-2 right-2 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md animate-in zoom-in-50">
              <Check className="w-3 h-3 stroke-[3]" />
            </div>
          )}
        </div>

        {/* ── PRESET WALLPAPERS ── */}
        {PRESET_WALLPAPERS.map((wp) => {
          const isSelected = selectedId === wp.id;
          return (
            <button
              key={wp.id}
              type="button"
              onClick={() => {
                setSelectedId(wp.id);
                if (isMobileView) {
                  setIsMobileFramingOpen(true);
                }
              }}
              className={cn(
                "relative aspect-[9/14] rounded-2xl overflow-hidden border-2 transition-all p-1 group flex flex-col items-center justify-between text-left shadow-sm",
                isSelected
                  ? "border-primary ring-2 ring-primary/40 scale-[1.02] shadow-primary/20"
                  : "border-border/60 hover:border-primary/40 bg-card"
              )}
            >
              <div className="w-full flex-1 rounded-xl overflow-hidden relative bg-muted/40">
                <img
                  src={wp.image}
                  alt={wp.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="text-[10px] font-bold mt-1 truncate w-full px-1 text-center">
                {wp.name}
              </span>
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md animate-in zoom-in-50">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Opacity Control */}
      <div className="p-3 bg-muted/40 rounded-2xl space-y-2 border border-primary/10">
        <div className="flex justify-between items-center text-xs font-semibold">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-primary" />
            Wallpaper Visibility
          </span>
          <span className="text-primary font-bold">{opacity}%</span>
        </div>
        <Slider
          value={[opacity]}
          min={20}
          max={100}
          step={5}
          onValueChange={(vals) => setOpacity(vals[0])}
        />
        <p className="text-[10px] text-muted-foreground">
          Subtly adjust brightness so message bubbles remain clear and readable.
        </p>
      </div>

      {/* MOBILE ONLY: Quick action button to open real cropper */}
      {isMobileView && (
        <Button
          type="button"
          onClick={() => setIsMobileFramingOpen(true)}
          className="w-full h-11 rounded-2xl font-bold bg-[#1877F2] hover:bg-[#166fe5] text-white shadow-md active:scale-98 transition-all text-sm gap-2 mt-1"
        >
          <Crop className="w-4 h-4" />
          Position & Frame Wallpaper
        </Button>
      )}

      {/* DESKTOP ONLY (≥768px): Fit Mode and Interactive Preview 100% untouched */}
      {!isMobileView && (
        <>
          {/* Wallpaper Fit Mode Control (Cross-Device Layout) */}
          <div className="p-3.5 bg-muted/40 rounded-2xl space-y-2.5 border border-primary/10">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-foreground flex items-center gap-1.5 font-bold">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Device Layout & Fit Mode
              </span>
              <span className="text-[10px] text-muted-foreground font-medium">
                Best for all devices
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFitMode("smart")}
                className={cn(
                  "flex flex-col items-start p-2.5 rounded-xl border text-left transition-all relative",
                  fitMode === "smart"
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30 shadow-sm"
                    : "border-border/60 hover:border-primary/40 bg-card/60"
                )}
              >
                <div className="flex items-center gap-1 font-bold text-[11px] text-foreground mb-0.5">
                  <Sparkles className="w-3 h-3 text-primary shrink-0" />
                  <span>Smart Fit</span>
                </div>
                <p className="text-[9px] text-muted-foreground leading-tight">
                  Full photo + ambient glow on desktop & phone
                </p>
                <span className="mt-1 text-[8px] bg-primary/20 text-primary font-bold px-1.5 py-0.2 rounded-full">
                  Recommended
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFitMode("cover")}
                className={cn(
                  "flex flex-col items-start p-2.5 rounded-xl border text-left transition-all relative",
                  fitMode === "cover"
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30 shadow-sm"
                    : "border-border/60 hover:border-primary/40 bg-card/60"
                )}
              >
                <div className="flex items-center gap-1 font-bold text-[11px] text-foreground mb-0.5">
                  <Maximize2 className="w-3 h-3 text-primary shrink-0" />
                  <span>Fill Screen</span>
                </div>
                <p className="text-[9px] text-muted-foreground leading-tight">
                  Edge-to-edge fill crop on every screen
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFitMode("contain")}
                className={cn(
                  "flex flex-col items-start p-2.5 rounded-xl border text-left transition-all relative",
                  fitMode === "contain"
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30 shadow-sm"
                    : "border-border/60 hover:border-primary/40 bg-card/60"
                )}
              >
                <div className="flex items-center gap-1 font-bold text-[11px] text-foreground mb-0.5">
                  <Crop className="w-3 h-3 text-primary shrink-0" />
                  <span>Center Fit</span>
                </div>
                <p className="text-[9px] text-muted-foreground leading-tight">
                  Centered full photo with neutral dark backdrop
                </p>
              </button>
            </div>
          </div>

          {/* Photo Subject Focus & Interactive Framing Viewport */}
          {(()=> {
        const currentActiveImage =
          selectedId === "custom"
            ? (customUrl || originalPhotoUrl || "/wallpapers/messenger-love.jpg")
            : (PRESET_WALLPAPERS.find((p) => p.id === selectedId)?.image || "/wallpapers/messenger-love.jpg");

        const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          setIsDraggingFraming(true);
          dragStartRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            initPosX: positionX,
            initPosY: positionY,
          };
        };

        const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
          if (!isDraggingFraming || !dragStartRef.current) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const dx = e.clientX - dragStartRef.current.startX;
          const dy = e.clientY - dragStartRef.current.startY;

          const deltaPercentX = (dx / rect.width) * 100;
          const deltaPercentY = (dy / rect.height) * 100;

          const newX = Math.max(0, Math.min(100, Math.round(dragStartRef.current.initPosX - deltaPercentX)));
          const newY = Math.max(0, Math.min(100, Math.round(dragStartRef.current.initPosY - deltaPercentY)));

          setPositionX(newX);
          setPositionY(newY);
        };

        const handlePointerUp = () => {
          setIsDraggingFraming(false);
          dragStartRef.current = null;
        };

        return (
          <div className="p-3.5 bg-muted/40 rounded-2xl space-y-3 border border-primary/10">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-foreground flex items-center gap-1.5 font-bold">
                <Move className="w-3.5 h-3.5 text-primary" />
                Interactive Framing & Live Preview
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                X: {positionX}% · Y: {positionY}% · {zoom}%
              </span>
            </div>

            {/* Draggable Framing Canvas */}
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={cn(
                "relative w-full rounded-xl overflow-hidden shadow-inner border border-primary/20 touch-none cursor-grab active:cursor-grabbing select-none transition-colors",
                isMobileView ? "h-44" : "h-48 sm:h-52",
                isDraggingFraming ? "ring-2 ring-primary border-primary" : ""
              )}
            >
              {/* Background ambient glow */}
              <div
                className="absolute inset-0 bg-cover bg-center filter blur-xl scale-110 opacity-70"
                style={{ backgroundImage: `url(${currentActiveImage})` }}
              />

              {/* Scalable & Positioned Image */}
              <div
                className="absolute inset-0 transition-transform duration-75"
                style={{
                  backgroundImage: `url(${currentActiveImage})`,
                  backgroundPosition: `${positionX}% ${positionY}%`,
                  backgroundSize: fitMode === "contain" ? `${zoom}%` : `${zoom}%`,
                  backgroundRepeat: "no-repeat",
                  opacity: opacity / 100,
                }}
              />

              {/* Framing Reticle Grid (rule of thirds guidelines) */}
              <div className="absolute inset-0 pointer-events-none opacity-35 border border-white/20">
                <div className="w-full h-1/3 border-b border-white/20" />
                <div className="w-full h-1/3 border-b border-white/20" />
                <div className="absolute top-0 bottom-0 left-1/3 border-r border-white/20" />
                <div className="absolute top-0 bottom-0 left-2/3 border-r border-white/20" />
              </div>

              {/* Simulated chat message bubble in preview */}
              <div className="absolute inset-0 pointer-events-none p-3 flex flex-col justify-between">
                <div className="flex justify-between items-center text-[9px] text-white/90 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 w-fit">
                  <span>Chat bubble readability check</span>
                </div>

                <div className="space-y-1 max-w-[240px]">
                  <div className="bg-background/80 dark:bg-zinc-900/80 backdrop-blur-md text-foreground text-[10px] px-2.5 py-1 rounded-2xl rounded-tl-xs border border-white/10 shadow-xs font-medium">
                    Hey! How does this framing look? ✨
                  </div>
                  <div className="bg-primary text-primary-foreground text-[10px] px-2.5 py-1 rounded-2xl rounded-tr-xs shadow-xs font-medium ml-auto w-fit">
                    Full photo on all devices ✨
                  </div>
                </div>

                {/* Floating Drag Hint Pill */}
                <div className="relative z-10 inset-x-0 flex justify-center pointer-events-none mt-1">
                  <span className="text-[8px] font-semibold text-white/90 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full flex items-center gap-1 border border-white/10 shadow-xs">
                    <Move className="w-2.5 h-2.5" />
                    {isDraggingFraming ? "Panning position..." : "Drag image to adjust framing (X: " + positionX + "% · Y: " + positionY + "%)"}
                  </span>
                </div>
              </div>
            </div>

            {/* Zoom / Scale Control */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center text-[11px] font-semibold text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ZoomIn className="w-3 h-3 text-primary" />
                  Zoom / Scale
                </span>
                <span className="text-primary font-bold">{(zoom / 100).toFixed(1)}x</span>
              </div>
              <Slider
                value={[zoom]}
                min={100}
                max={200}
                step={5}
                onValueChange={(vals) => setZoom(vals[0])}
              />
            </div>

            {/* Quick framing presets */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                <span>Quick Presets</span>
                <span>Click to snap</span>
              </div>
              <div className={cn("grid gap-1.5", isMobileView ? "grid-cols-2 min-[360px]:grid-cols-4" : "grid-cols-4")}>
                {[
                  { label: "Faces / Top", x: 50, y: 15 },
                  { label: "Subject", x: 50, y: 35 },
                  { label: "Center", x: 50, y: 50 },
                  { label: "Reset", x: 50, y: 35 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setPositionX(preset.x);
                      setPositionY(preset.y);
                      if (preset.label === "Reset") setZoom(100);
                    }}
                    className={cn(
                      "py-1 px-1.5 rounded-lg text-[11px] font-semibold border transition-all text-center",
                      Math.abs(positionX - preset.x) <= 8 && Math.abs(positionY - preset.y) <= 8
                        ? "border-primary bg-primary/15 text-primary ring-1 ring-primary/30"
                        : "border-border/60 text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          );
          })()}
        </>
      )}
    </div>
  );

  /* ═══════════ MOBILE-ONLY BOTTOM SHEET (<768px) ═══════════ */
  if (isMounted && isMobile) {
    return (
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center select-none">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => onOpenChange(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer z-0"
            />

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
              id="wallpaper-photo-upload-mobile"
            />

            {/* Mobile Bottom Sheet Modal */}
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className={cn(
                "relative z-10 w-full max-h-[90vh] flex flex-col rounded-t-[28px] border-t shadow-2xl overflow-hidden",
                isDark
                  ? "bg-[#18181A] border-zinc-800 text-white"
                  : "bg-white border-gray-200 text-gray-900"
              )}
            >
              {/* Top Drag Handle */}
              <div className="w-full flex items-center justify-center pt-2.5 pb-1 shrink-0">
                <div
                  className={cn(
                    "w-12 h-1.5 rounded-full",
                    isDark ? "bg-zinc-700" : "bg-gray-300"
                  )}
                />
              </div>

              {/* Header Row */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {inStudioMode && (
                    <button
                      type="button"
                      onClick={() => setInStudioMode(false)}
                      className="w-8 h-8 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-foreground transition-colors mr-0.5 shrink-0 active:scale-95"
                      aria-label="Back to wallpapers"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  )}
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 flex items-center justify-center text-pink-500 shadow-xs shrink-0">
                    {inStudioMode ? <Wand2 className="w-4 h-4" /> : <Palette className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-bold truncate leading-tight">
                      {inStudioMode ? "AI Wallpaper Studio" : "Chat Wallpaper"}
                    </h2>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {inStudioMode
                        ? "Personalize photo with realistic styling"
                        : "Premium wallpapers & framing"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {!inStudioMode && customUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInStudioMode(true)}
                      className="text-xs h-7 gap-1 px-2.5 rounded-full border-pink-500/30 text-pink-600 dark:text-pink-400 hover:bg-pink-500/10"
                    >
                      <Wand2 className="w-3 h-3" />
                      Studio
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-95 transition-all"
                    title="Close"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>

              {/* Error Notification */}
              {errorMessage && (
                <div className="mx-4 mt-2 flex items-center gap-2 p-2.5 bg-destructive/10 text-destructive text-xs rounded-xl border border-destructive/20 shrink-0">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Middle Independently Scrollable Area */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 overscroll-contain scrollbar-thin scrollbar-thumb-muted-foreground/20">
                {inStudioMode ? renderStudioBody(true) : renderMainBody(true)}
              </div>

              {/* Sticky Bottom Footer pinned to bottom */}
              {!inStudioMode ? (
                <div
                  className={cn(
                    "p-3.5 border-t border-border/40 flex flex-col gap-2 shrink-0 z-20",
                    isDark
                      ? "bg-[#18181A]/95 border-zinc-800 backdrop-blur-md"
                      : "bg-white/95 border-gray-200 backdrop-blur-md"
                  )}
                  style={{ paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))" }}
                >
                  {/* Save Wallpaper full-width button */}
                  <Button
                    type="button"
                    onClick={handleSave}
                    className="w-full h-10 rounded-xl font-bold bg-primary text-primary-foreground shadow-md active:scale-98 transition-all text-sm"
                  >
                    Save Wallpaper 💕
                  </Button>

                  {/* Reset and Cancel sharing a row below it */}
                  <div className="flex items-center gap-2 w-full">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleReset}
                      className="flex-1 h-9 rounded-xl text-xs text-muted-foreground hover:text-foreground gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenChange(false)}
                      className="flex-1 h-9 rounded-xl text-xs font-medium"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "p-3.5 border-t border-border/40 flex flex-col gap-2 shrink-0 z-20",
                    isDark
                      ? "bg-[#18181A]/95 border-zinc-800 backdrop-blur-md"
                      : "bg-white/95 border-gray-200 backdrop-blur-md"
                  )}
                  style={{ paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))" }}
                >
                  <Button
                    type="button"
                    onClick={handleApplyFromStudio}
                    disabled={isGenerating || !customUrl}
                    className="w-full h-10 rounded-xl font-bold bg-primary text-primary-foreground shadow-md active:scale-98 transition-all text-sm gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Use This Wallpaper
                  </Button>

                  <div className="flex items-center gap-2 w-full">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerate}
                      disabled={isGenerating || !originalPhotoUrl}
                      className="flex-1 h-9 rounded-xl text-xs gap-1.5"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5", isGenerating && "animate-spin")} />
                      Regenerate
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (originalPhotoUrl) {
                          setCustomUrl(originalPhotoUrl);
                          setSelectedId("custom");
                          onSaveConfig({
                            id: "custom",
                            customUrl: originalPhotoUrl,
                            originalPhotoUrl,
                            opacity,
                          });
                          onOpenChange(false);
                        }
                      }}
                      className="flex-1 h-9 rounded-xl text-xs"
                    >
                      Use Original
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>

            {/* ══════════ MOBILE FULL-SCREEN FRAMING CROPPER ══════════
                Shown when user picks a wallpaper/photo on mobile.
                Mimics Android's native blue-border crop / frame UI.
            ══════════════════════════════════════════════════════════ */}
            <AnimatePresence>
              {isMobileFramingOpen && (() => {
                const framingImage =
                  selectedId === "custom"
                    ? (customUrl || originalPhotoUrl || "/wallpapers/messenger-love.jpg")
                    : (PRESET_WALLPAPERS.find((p) => p.id === selectedId)?.image || "/wallpapers/messenger-love.jpg");

                const handleFPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  setIsDraggingFraming(true);
                  dragStartRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    initPosX: positionX,
                    initPosY: positionY,
                  };
                };
                const handleFPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
                  if (!isDraggingFraming || !dragStartRef.current) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const dx = e.clientX - dragStartRef.current.startX;
                  const dy = e.clientY - dragStartRef.current.startY;
                  const newX = Math.max(0, Math.min(100, Math.round(dragStartRef.current.initPosX - (dx / rect.width) * 100)));
                  const newY = Math.max(0, Math.min(100, Math.round(dragStartRef.current.initPosY - (dy / rect.height) * 100)));
                  setPositionX(newX);
                  setPositionY(newY);
                };
                const handleFPointerUp = () => {
                  setIsDraggingFraming(false);
                  dragStartRef.current = null;
                };

                return (
                  <motion.div
                    key="mobile-framing-cropper"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="fixed inset-0 z-[200] flex flex-col bg-black"
                    style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
                  >
                    {/* Top bar */}
                    <div className="flex items-center justify-between px-4 py-3 shrink-0">
                      <span className="text-white/60 text-sm font-medium">Frame Wallpaper</span>
                      <div className="flex items-center gap-3">
                        {/* Zoom buttons */}
                        <button
                          type="button"
                          onClick={() => setZoom(Math.max(100, zoom - 10))}
                          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-all"
                          title="Zoom out"
                        >
                          <span className="text-white text-lg font-bold leading-none">−</span>
                        </button>
                        <span className="text-white/70 text-xs font-mono w-10 text-center">{zoom}%</span>
                        <button
                          type="button"
                          onClick={() => setZoom(Math.min(200, zoom + 10))}
                          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-all"
                          title="Zoom in"
                        >
                          <span className="text-white text-lg font-bold leading-none">+</span>
                        </button>
                      </div>
                    </div>

                    {/* Photo area — full stretch, drag to reframe */}
                    <div
                      className="flex-1 relative overflow-hidden touch-none select-none"
                      onPointerDown={handleFPointerDown}
                      onPointerMove={handleFPointerMove}
                      onPointerUp={handleFPointerUp}
                      onPointerCancel={handleFPointerUp}
                    >
                      {/* Blurred ambient glow behind */}
                      <div
                        className="absolute inset-0 scale-110"
                        style={{
                          backgroundImage: `url(${framingImage})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          filter: "blur(28px) brightness(0.4)",
                        }}
                      />

                      {/* Main draggable photo */}
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `url(${framingImage})`,
                          backgroundSize: zoom > 100 ? `${zoom}%` : "cover",
                          backgroundPosition: `${positionX}% ${positionY}%`,
                          backgroundRepeat: "no-repeat",
                          cursor: isDraggingFraming ? "grabbing" : "grab",
                        }}
                      />

                      {/* Blue crop-frame border (native Android feel) */}
                      <div
                        className="absolute pointer-events-none"
                        style={{
                          top: "6%",
                          left: "8%",
                          right: "8%",
                          bottom: "6%",
                          border: "2px solid #1877F2",
                          borderRadius: 4,
                        }}
                      >
                        {/* Corner handles */}
                        {["tl","tr","bl","br"].map((pos) => (
                          <div
                            key={pos}
                            className="absolute w-4 h-4 border-[#1877F2]"
                            style={{
                              borderTopWidth: pos.startsWith("t") ? 3 : 0,
                              borderBottomWidth: pos.startsWith("b") ? 3 : 0,
                              borderLeftWidth: pos.endsWith("l") ? 3 : 0,
                              borderRightWidth: pos.endsWith("r") ? 3 : 0,
                              top: pos.startsWith("t") ? -2 : undefined,
                              bottom: pos.startsWith("b") ? -2 : undefined,
                              left: pos.endsWith("l") ? -2 : undefined,
                              right: pos.endsWith("r") ? -2 : undefined,
                              borderStyle: "solid",
                              borderColor: "#1877F2",
                            }}
                          />
                        ))}

                        {/* Rule-of-thirds grid lines */}
                        <div className="absolute inset-0 opacity-40">
                          <div className="absolute top-1/3 left-0 right-0 border-t border-white/50" />
                          <div className="absolute top-2/3 left-0 right-0 border-t border-white/50" />
                          <div className="absolute left-1/3 top-0 bottom-0 border-l border-white/50" />
                          <div className="absolute left-2/3 top-0 bottom-0 border-l border-white/50" />
                        </div>
                      </div>

                      {/* Drag hint */}
                      {!isDraggingFraming && (
                        <div className="absolute bottom-[8%] inset-x-0 flex justify-center pointer-events-none">
                          <span className="text-[11px] text-white/70 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1.5">
                            <Move className="w-3 h-3" />
                            Drag to reposition
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Quick snap presets */}
                    <div className="flex items-center justify-center gap-2 px-4 py-2 shrink-0">
                      {[
                        { label: "Top / Faces", y: 15 },
                        { label: "Subject", y: 35 },
                        { label: "Center", y: 50 },
                      ].map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => { setPositionX(50); setPositionY(p.y); }}
                          className={cn(
                            "px-3 py-1 rounded-full text-[11px] font-semibold border transition-all",
                            Math.abs(positionY - p.y) <= 8
                              ? "border-[#1877F2] bg-[#1877F2]/20 text-[#60a5fa]"
                              : "border-white/20 text-white/50"
                          )}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    {/* Zoom slider */}
                    <div className="px-6 pb-1 shrink-0">
                      <Slider
                        value={[zoom]}
                        min={100}
                        max={200}
                        step={5}
                        onValueChange={(vals) => setZoom(vals[0])}
                        className="[&_.relative]:bg-white/20 [&_[data-orientation=horizontal]]:h-1"
                      />
                    </div>

                    {/* Bottom action bar — DISCARD / SAVE */}
                    <div className="flex items-stretch gap-0 shrink-0 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMobileFramingOpen(false);
                        }}
                        className="flex-1 py-4 text-sm font-bold text-white/80 active:bg-white/10 transition-colors tracking-wide uppercase"
                      >
                        DISCARD
                      </button>
                      <div className="w-px bg-white/10" />
                      <button
                        type="button"
                        onClick={() => {
                          setIsMobileFramingOpen(false);
                          handleSave();
                        }}
                        className="flex-1 py-4 text-sm font-bold text-[#1877F2] active:bg-[#1877F2]/10 transition-colors tracking-wide uppercase"
                      >
                        SAVE
                      </button>
                    </div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>
    );
  }

  /* ═══════════ DESKTOP CENTERED DIALOG (≥768px): 100% UNTOUCHED ═══════════ */
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] p-5 sm:p-6 bg-background/95 backdrop-blur-2xl border border-primary/20 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoUpload}
          className="hidden"
          id="wallpaper-photo-upload"
        />

        {/* Header */}
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              {inStudioMode && (
                <button
                  type="button"
                  onClick={() => setInStudioMode(false)}
                  className="w-8 h-8 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-foreground transition-colors mr-1"
                  aria-label="Back to wallpapers"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 flex items-center justify-center text-pink-500 shadow-sm">
                {inStudioMode ? <Wand2 className="w-4 h-4" /> : <Palette className="w-4 h-4" />}
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold">
                  {inStudioMode ? "AI Wallpaper Studio" : "Chat Wallpaper"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground line-clamp-1">
                  {inStudioMode
                    ? "Personalize photo with realistic photorealistic styling"
                    : "Premium real-photography wallpapers & custom AI photo creation"}
                </DialogDescription>
              </div>
            </div>

            {/* If not in studio, but has custom photo, allow quick studio access */}
            {!inStudioMode && customUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInStudioMode(true)}
                className="text-xs h-7 gap-1 px-2.5 rounded-full border-pink-500/30 text-pink-600 dark:text-pink-400 hover:bg-pink-500/10"
              >
                <Wand2 className="w-3 h-3" />
                Studio
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Error Notification */}
        {errorMessage && (
          <div className="flex items-center gap-2 p-2.5 bg-destructive/10 text-destructive text-xs rounded-xl border border-destructive/20 flex-shrink-0 mt-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pr-1 py-2 space-y-4 scrollbar-thin scrollbar-thumb-muted-foreground/20">
          {inStudioMode ? renderStudioBody(false) : renderMainBody(false)}
        </div>

        {/* Footer Actions */}
        {!inStudioMode && (
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/40 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-xs text-muted-foreground hover:text-foreground gap-1.5 rounded-xl h-8 px-2.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="rounded-xl text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                className="bg-primary text-primary-foreground font-semibold rounded-xl px-5 text-xs h-8 shadow-md hover:shadow-primary/20"
              >
                Save Wallpaper 💕
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
