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
  Check,
  RotateCcw,
  ImagePlus,
  RefreshCw,
  Wand2,
  Eye,
  SlidersHorizontal,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Crop,
  Monitor,
  Smartphone,
  Maximize2,
  X,
  ZoomIn,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useViewport } from "@/hooks/use-viewport";
import {
  generateWallpaperAction,
  WallpaperStyle,
} from "@/ai/flows/wallpaper-generator";
import { processPhotographicWallpaper } from "@/lib/photo-wallpaper";
import { WallpaperFramingViewport } from "./wallpaper-framing-viewport";

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
  partnerName?: string;
  partnerAvatar?: string;
  isPartnerOnline?: boolean;
  streak?: number;
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
    icon: "ðŸŽ¬",
    desc: "35mm warm tone, gentle anamorphic mood",
  },
  {
    id: "golden_hour",
    label: "Golden Hour",
    icon: "ðŸŒ…",
    desc: "Warm amber glow & tender rim lighting",
  },
  {
    id: "dreamy_soft",
    label: "Dreamy Glow",
    icon: "ðŸŒ¸",
    desc: "Soft daylight diffusion & romantic pastel tone",
  },
  {
    id: "clean_studio",
    label: "Clean Studio",
    icon: "ðŸ“¸",
    desc: "Crisp natural tones & calm neutral balance",
  },
  {
    id: "film_noir",
    label: "Velvet Noir",
    icon: "ðŸ–¤",
    desc: "High tonal monochrome & velvety shadows",
  },
];

export function WallpaperDialog({
  open,
  onOpenChange,
  currentConfig,
  onSaveConfig,
  isDark,
  partnerName,
  partnerAvatar,
  isPartnerOnline,
  streak,
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
    typeof currentConfig.positionY === "number" ? currentConfig.positionY : 35
  );
  const [zoom, setZoom] = useState<number>(currentConfig.zoom || 100);
  const [fitMode, setFitMode] = useState<"smart" | "cover" | "contain">(currentConfig.fit || "smart");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "mobile" : "desktop"
  );
  const [isMobileFramingOpen, setIsMobileFramingOpen] = useState(false);

  // Studio Mode State
  const [inStudioMode, setInStudioMode] = useState<boolean>(false);
  const [selectedStyle, setSelectedStyle] = useState<WallpaperStyle>("cinematic");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [previewTab, setPreviewTab] = useState<"generated" | "original">("generated");
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mobile wizard: 1=Choose source, 2=AI Style (custom photo only), 3=Preview, 4=Frame & Save
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);

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
      setWizardStep(1);
      if (typeof window !== "undefined") {
        setPreviewDevice(window.innerWidth < 768 ? "mobile" : "desktop");
      }
    }
  }, [open, currentConfig]);

  // Handle Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      setCustomUrl(dataUrl);
      setSelectedId("custom");

      if (isMobile) {
        // Go to Step 2 (Style) so user can pick AI mood before generating
        setWizardStep(2);
      } else {
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
      const processedLocal = await processPhotographicWallpaper(photoBase64, style);
      setCustomUrl(processedLocal);

      setGenerationMessage("Applying photographic depth & calm chat balance...");
      const aiResult = await generateWallpaperAction({
        photoBase64,
        style,
      });

      if (aiResult.success && aiResult.wallpaperUrl && aiResult.wallpaperUrl !== photoBase64) {
        setCustomUrl(aiResult.wallpaperUrl);
        setGenerationMessage(aiResult.message || "Wallpaper generated âœ¨");
      } else {
        setGenerationMessage(aiResult.message || "Photographic wallpaper ready");
      }
    } catch (err: unknown) {
      console.warn("Generation warning:", err);
      setGenerationMessage("Photographic wallpaper ready");
    } finally {
      setIsGenerating(false);
    }
  };

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

  const handleResetAll = () => {
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

  const handleTransformChange = (updates: { positionX?: number; positionY?: number; zoom?: number }) => {
    if (typeof updates.positionX === "number") setPositionX(updates.positionX);
    if (typeof updates.positionY === "number") setPositionY(updates.positionY);
    if (typeof updates.zoom === "number") setZoom(updates.zoom);
  };

  // Active image calculation
  const activeMainImage =
    selectedId === "custom"
      ? (customUrl || originalPhotoUrl || "/wallpapers/messenger-love.jpg")
      : (PRESET_WALLPAPERS.find((p) => p.id === selectedId)?.image || "/wallpapers/messenger-love.jpg");

  const activeStudioImage =
    (previewTab === "generated" ? customUrl : originalPhotoUrl) ||
    originalPhotoUrl ||
    customUrl ||
    "/wallpapers/messenger-love.jpg";

  const currentDisplayImage = inStudioMode ? activeStudioImage : activeMainImage;

  // Render wallpaper picker card grid
  const renderWallpaperCards = () => (
    <div className="grid grid-cols-3 gap-2">
      {/* Upload Card */}
      <div
        onClick={() => {
          if (customUrl) {
            setSelectedId("custom");
          } else {
            fileInputRef.current?.click();
          }
        }}
        className={cn(
          "relative aspect-[9/13] rounded-2xl overflow-hidden border-2 transition-all p-1 flex flex-col items-center justify-between text-left cursor-pointer group shadow-xs",
          selectedId === "custom"
            ? "border-primary ring-2 ring-primary/40 scale-[1.02] shadow-primary/20"
            : "border-dashed border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10"
        )}
      >
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
                  if (isMobile) {
                    setIsMobileFramingOpen(true);
                  } else {
                    setInStudioMode(true);
                  }
                }}
                className="absolute bottom-1 right-1 p-1 rounded-lg bg-background/85 backdrop-blur-md text-foreground hover:text-primary shadow text-[9px] flex items-center gap-0.5"
                title="Open Studio"
              >
                <Crop className="w-3 h-3 text-pink-500" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-2 text-center">
              <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center mb-1 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground transition-all shadow-xs">
                <ImagePlus className="w-4 h-4 stroke-[2.2]" />
              </div>
              <span className="text-[10px] font-bold text-foreground">Upload Photo</span>
              <span className="text-[8px] text-muted-foreground mt-0.5 line-clamp-1">
                Custom photo
              </span>
            </div>
          )}
        </div>

        <div className="w-full px-1 pt-1 flex items-center justify-between">
          <span className="text-[10px] font-bold truncate">
            {customUrl ? "Custom" : "Upload"}
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

        {selectedId === "custom" && (
          <div className="absolute top-2 right-2 w-4 h-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md">
            <Check className="w-2.5 h-2.5 stroke-[3]" />
          </div>
        )}
      </div>

      {/* Presets */}
      {PRESET_WALLPAPERS.map((wp) => {
        const isSelected = selectedId === wp.id;
        return (
          <button
            key={wp.id}
            type="button"
            onClick={() => setSelectedId(wp.id)}
            className={cn(
              "relative aspect-[9/13] rounded-2xl overflow-hidden border-2 transition-all p-1 group flex flex-col items-center justify-between text-left shadow-xs",
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
            </div>
            <span className="text-[10px] font-bold mt-1 truncate w-full px-1 text-center">
              {wp.name}
            </span>
            {isSelected && (
              <div className="absolute top-2 right-2 w-4 h-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

  // Render Fit Mode Selectors
  const renderFitModes = () => (
    <div className="p-3 bg-muted/40 rounded-2xl space-y-2 border border-primary/10">
      <div className="flex justify-between items-center text-xs font-semibold">
        <span className="text-foreground flex items-center gap-1.5 font-bold">
          <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
          Framing & Fit Mode
        </span>
        <span className="text-[10px] text-muted-foreground font-medium">
          Adaptive
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => setFitMode("smart")}
          className={cn(
            "flex flex-col items-start p-2 rounded-xl border text-left transition-all",
            fitMode === "smart"
              ? "border-primary bg-primary/10 ring-1 ring-primary/30 shadow-xs"
              : "border-border/60 hover:border-primary/40 bg-card/60"
          )}
        >
          <div className="flex items-center gap-1 font-bold text-[11px] text-foreground mb-0.5">
            <SlidersHorizontal className="w-3 h-3 text-primary shrink-0" />
            <span>Smart Fit</span>
          </div>
          <p className="text-[9px] text-muted-foreground leading-tight">
            Balanced subject + ambient glow
          </p>
        </button>

        <button
          type="button"
          onClick={() => setFitMode("cover")}
          className={cn(
            "flex flex-col items-start p-2 rounded-xl border text-left transition-all",
            fitMode === "cover"
              ? "border-primary bg-primary/10 ring-1 ring-primary/30 shadow-xs"
              : "border-border/60 hover:border-primary/40 bg-card/60"
          )}
        >
          <div className="flex items-center gap-1 font-bold text-[11px] text-foreground mb-0.5">
            <Maximize2 className="w-3 h-3 text-primary shrink-0" />
            <span>Fill Screen</span>
          </div>
          <p className="text-[9px] text-muted-foreground leading-tight">
            Full edge-to-edge coverage
          </p>
        </button>

        <button
          type="button"
          onClick={() => setFitMode("contain")}
          className={cn(
            "flex flex-col items-start p-2 rounded-xl border text-left transition-all",
            fitMode === "contain"
              ? "border-primary bg-primary/10 ring-1 ring-primary/30 shadow-xs"
              : "border-border/60 hover:border-primary/40 bg-card/60"
          )}
        >
          <div className="flex items-center gap-1 font-bold text-[11px] text-foreground mb-0.5">
            <Crop className="w-3 h-3 text-primary shrink-0" />
            <span>Center Fit</span>
          </div>
          <p className="text-[9px] text-muted-foreground leading-tight">
            Centered full photograph
          </p>
        </button>
      </div>
    </div>
  );

  // Render Opacity Slider
  const renderOpacityControl = () => (
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
        aria-label="Wallpaper visibility"
      />
      <p className="text-[10px] text-muted-foreground">
        Adjust brightness so conversation text and bubbles remain crisp and comfortable to read.
      </p>
    </div>
  );

  // Studio Mode Controls
  const renderStudioControls = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold flex items-center gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
          Photographic Mood & Grading
        </label>
        <span className="text-[10px] text-muted-foreground">
          Calm chat balance
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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

      {generationMessage && (
        <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
          <Wand2 className="w-3.5 h-3.5 text-primary" />
          {generationMessage}
        </p>
      )}
    </div>
  );

  // Top Bar for Right Preview (Tabs & Device Switcher)
  const renderPreviewTopBar = () => (
    <div className="flex items-center justify-between w-full gap-2 mb-2">
      {inStudioMode ? (
        <div className="flex items-center gap-1 p-0.5 bg-muted/60 rounded-full border border-primary/10">
          <button
            type="button"
            onClick={() => setPreviewTab("generated")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full transition-all",
              previewTab === "generated"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Palette className="w-3 h-3" />
            Generated
          </button>
          <button
            type="button"
            onClick={() => setPreviewTab("original")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full transition-all",
              previewTab === "original"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Eye className="w-3 h-3" />
            Original
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
          <span>Live Chat Preview</span>
        </div>
      )}

      {/* Device Switcher (Desktop ðŸ’» vs Phone ðŸ“±) */}
      <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-full border border-primary/10">
        <button
          type="button"
          onClick={() => setPreviewDevice("desktop")}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all",
            previewDevice === "desktop"
              ? "bg-primary text-primary-foreground shadow-xs"
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
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
          title="Phone Preview"
        >
          <Smartphone className="w-3 h-3" />
          Phone
        </button>
      </div>
    </div>
  );

  /* â•â•â•â•â•â•â•â•â•â•â• MOBILE WIZARD (<768px) â€” 4 steps â•â•â•â•â•â•â•â•â•â•â•
   * Step 1: Choose source (preset grid + upload)
   * Step 2: AI Style  (custom photo only â€” skippable for presets)
   * Step 3: Generate & Preview
   * Step 4: Frame, Fit & Save
   * Desktop branch below this block stays 100% unchanged.
   * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  if (isMounted && isMobile) {
    /* â”€â”€ wizard navigation helpers â”€â”€ */
    const TOTAL_STEPS = 4;
    const wizardTitles: Record<number, string> = {
      1: "Choose Wallpaper",
      2: "AI Style",
      3: "Preview",
      4: "Frame & Save",
    };

    const goBack = () => {
      if (wizardStep === 1) { onOpenChange(false); return; }
      if (wizardStep === 3 && selectedId !== "custom") {
        // Presets skip step 2, so go back to step 1
        setWizardStep(1);
      } else {
        setWizardStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4);
      }
    };

    /* â”€â”€ step content â”€â”€ */
    const renderStep = () => {
      /* STEP 1 â€” Choose source */
      if (wizardStep === 1) {
        return (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Pick a preset or upload your own couple photo.
            </p>

            {errorMessage && (
              <div className="flex items-center gap-2 p-2.5 bg-destructive/10 text-destructive text-xs rounded-xl border border-destructive/20">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {/* Upload tile */}
              <div
                onClick={() => {
                  if (customUrl) {
                    setSelectedId("custom");
                    setWizardStep(2);
                  } else {
                    fileInputRef.current?.click();
                  }
                }}
                className={cn(
                  "relative aspect-[9/13] rounded-2xl overflow-hidden border-2 transition-all p-1 flex flex-col items-center justify-between text-left cursor-pointer group shadow-xs",
                  selectedId === "custom"
                    ? "border-primary ring-2 ring-primary/40 scale-[1.02]"
                    : "border-dashed border-primary/40 hover:border-primary bg-primary/5"
                )}
              >
                <div className="w-full flex-1 rounded-xl overflow-hidden relative flex flex-col items-center justify-center bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-indigo-500/10">
                  {customUrl ? (
                    <img
                      src={customUrl}
                      alt="Uploaded"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-2 text-center">
                      <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center mb-1">
                        <ImagePlus className="w-4 h-4 stroke-[2.2]" />
                      </div>
                      <span className="text-[10px] font-bold text-foreground">Upload</span>
                      <span className="text-[8px] text-muted-foreground mt-0.5">Custom photo</span>
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-bold mt-1 truncate w-full px-1 text-center">
                  {customUrl ? "Custom" : "Upload"}
                </span>
                {selectedId === "custom" && (
                  <div className="absolute top-2 right-2 w-4 h-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
              </div>

              {/* Preset tiles */}
              {PRESET_WALLPAPERS.map((wp) => {
                const isSelected = selectedId === wp.id;
                return (
                  <button
                    key={wp.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(wp.id);
                      // Presets skip step 2, go straight to preview
                      setWizardStep(3);
                    }}
                    className={cn(
                      "relative aspect-[9/13] rounded-2xl overflow-hidden border-2 transition-all p-1 group flex flex-col items-center justify-between text-left shadow-xs",
                      isSelected
                        ? "border-primary ring-2 ring-primary/40 scale-[1.02]"
                        : "border-border/60 hover:border-primary/40 bg-card"
                    )}
                  >
                    <div className="w-full flex-1 rounded-xl overflow-hidden relative bg-muted/40">
                      <img
                        src={wp.image}
                        alt={wp.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <span className="text-[10px] font-bold mt-1 truncate w-full px-1 text-center">
                      {wp.name}
                    </span>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      }

      /* STEP 2 â€” AI Style (custom photo only) */
      if (wizardStep === 2) {
        return (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Choose a photographic mood â€” the AI will apply it to your photo.
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              {STYLE_OPTIONS.map((st) => {
                const isSelected = selectedStyle === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSelectedStyle(st.id)}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-2xl border text-left transition-all min-h-[68px]",
                      isSelected
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border/60 hover:border-primary/40 bg-muted/20"
                    )}
                  >
                    <span className="text-2xl leading-none shrink-0">{st.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{st.label}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{st.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      }

      /* STEP 3 â€” Generate & Preview */
      if (wizardStep === 3) {
        return (
          <div className="space-y-3">
            {renderPreviewTopBar()}
            <WallpaperFramingViewport
              imageSrc={currentDisplayImage}
              positionX={positionX}
              positionY={positionY}
              zoom={zoom}
              fit={fitMode}
              opacity={opacity}
              device="mobile"
              isDark={isDark}
              partnerName={partnerName}
              partnerAvatar={partnerAvatar}
              isPartnerOnline={isPartnerOnline}
              streak={streak}
              onChange={handleTransformChange}
              showControlsBar={false}
            />
            {isGenerating && (
              <div className="flex items-center gap-2.5 p-3 bg-muted/60 rounded-xl border border-border/60">
                <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                <span className="text-xs text-muted-foreground">{generationMessage || "Generatingâ€¦"}</span>
              </div>
            )}
            {!isGenerating && generationMessage && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{generationMessage}</span>
              </div>
            )}
          </div>
        );
      }

      /* STEP 4 â€” Frame & Save */
      return (
        <div className="space-y-3">
          <WallpaperFramingViewport
            imageSrc={currentDisplayImage}
            positionX={positionX}
            positionY={positionY}
            zoom={zoom}
            fit={fitMode}
            opacity={opacity}
            device="mobile"
            isDark={isDark}
            partnerName={partnerName}
            partnerAvatar={partnerAvatar}
            isPartnerOnline={isPartnerOnline}
            streak={streak}
            onChange={handleTransformChange}
            showControlsBar={true}
          />
          {renderFitModes()}
          {renderOpacityControl()}
        </div>
      );
    };

    /* â”€â”€ wizard footer buttons per step â”€â”€ */
    const renderFooter = () => {
      if (wizardStep === 1) {
        return (
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full h-11 rounded-xl text-sm font-medium text-muted-foreground"
          >
            Cancel
          </Button>
        );
      }

      if (wizardStep === 2) {
        return (
          <>
            <Button
              type="button"
              onClick={async () => {
                if (originalPhotoUrl) {
                  setPreviewTab("generated");
                  setWizardStep(3);
                  await runGeneration(originalPhotoUrl, selectedStyle);
                }
              }}
              disabled={isGenerating || !originalPhotoUrl}
              className="w-full h-11 rounded-xl font-bold text-sm gap-2"
            >
              <Wand2 className="w-4 h-4" />
              Generate Wallpaper
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                // Skip generation â€” use original photo as wallpaper
                setPreviewTab("original");
                setWizardStep(3);
              }}
              className="w-full h-11 rounded-xl text-sm"
            >
              Skip â€” Use Original Photo
            </Button>
          </>
        );
      }

      if (wizardStep === 3) {
        return (
          <>
            <Button
              type="button"
              onClick={() => setWizardStep(4)}
              disabled={isGenerating}
              className="w-full h-11 rounded-xl font-bold text-sm gap-2"
            >
              Next Frame & Save
              <ChevronRight className="w-4 h-4" />
            </Button>
            {selectedId === "custom" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={isGenerating || !originalPhotoUrl}
                className="w-full h-10 rounded-xl text-sm gap-2"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isGenerating && "animate-spin")} />
                Regenerate
              </Button>
            )}
          </>
        );
      }

      // Step 4
      return (
        <>
          <Button
            type="button"
            onClick={handleSave}
            className="w-full h-11 rounded-xl font-bold text-sm"
          >
            Save Wallpaper
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetAll}
              className="flex-1 h-10 rounded-xl text-xs text-muted-foreground gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-10 rounded-xl text-xs"
            >
              Cancel
            </Button>
          </div>
        </>
      );
    };

    return (
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center select-none">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => onOpenChange(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer z-0"
            />

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
              id="wallpaper-photo-upload-mobile"
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className={cn(
                "relative z-10 w-full max-h-[92vh] flex flex-col rounded-t-[28px] border-t shadow-2xl overflow-hidden",
                isDark
                  ? "bg-[#18181A] border-zinc-800 text-white"
                  : "bg-white border-gray-200 text-gray-900"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="w-full flex items-center justify-center pt-3 pb-1 shrink-0">
                <div className={cn("w-10 h-1 rounded-full", isDark ? "bg-zinc-700" : "bg-gray-300")} />
              </div>

              {/* Header with back button + step indicator */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 shrink-0">
                <button
                  type="button"
                  onClick={goBack}
                  className="w-9 h-9 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-foreground transition-colors shrink-0 active:scale-95"
                  aria-label={wizardStep === 1 ? "Close" : "Back"}
                >
                  {wizardStep === 1
                    ? <X className="w-4 h-4" />
                    : <ArrowLeft className="w-4 h-4" />
                  }
                </button>

                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold leading-tight">
                    {wizardTitles[wizardStep]}
                  </h2>
                  <div className="flex items-center gap-1.5 mt-1">
                    {[1, 2, 3, 4].map((s) => (
                      <div
                        key={s}
                        className={cn(
                          "h-1 rounded-full transition-all duration-300",
                          s === wizardStep
                            ? "w-5 bg-primary"
                            : s < wizardStep
                              ? "w-2.5 bg-primary/40"
                              : "w-2.5 bg-muted-foreground/25"
                        )}
                      />
                    ))}
                    <span className="text-[10px] text-muted-foreground ml-1">
                      {wizardStep}/{TOTAL_STEPS}
                    </span>
                  </div>
                </div>

                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 flex items-center justify-center text-pink-500 shadow-xs shrink-0">
                  <Palette className="w-4 h-4" />
                </div>
              </div>

              {errorMessage && (
                <div className="mx-4 mt-2 flex items-center gap-2 p-2.5 bg-destructive/10 text-destructive text-xs rounded-xl border border-destructive/20 shrink-0">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Step content */}
              <div className="flex-1 overflow-y-auto px-4 py-3 overscroll-contain">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={wizardStep}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.18 }}
                  >
                    {renderStep()}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div
                className={cn(
                  "px-4 py-3.5 border-t border-border/40 flex flex-col gap-2 shrink-0",
                  isDark ? "bg-[#18181A]/95" : "bg-white/95"
                )}
                style={{ paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))" }}
              >
                {renderFooter()}
              </div>
            </motion.div>

            {/* Immersive full-screen framing overlay (reachable from upload card crop button) */}
            <AnimatePresence>
              {isMobileFramingOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="fixed inset-0 z-[200] flex flex-col bg-black text-white"
                  style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
                >
                  <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-white/10">
                    <span className="text-white/80 text-sm font-semibold">Frame Wallpaper</span>
                    <button
                      type="button"
                      onClick={() => setIsMobileFramingOpen(false)}
                      className="text-xs font-bold text-primary px-3 py-1 bg-primary/20 rounded-full"
                    >
                      Done
                    </button>
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center p-3 overflow-hidden">
                    <WallpaperFramingViewport
                      imageSrc={currentDisplayImage}
                      positionX={positionX}
                      positionY={positionY}
                      zoom={zoom}
                      fit={fitMode}
                      opacity={opacity}
                      device="mobile"
                      isDark={isDark}
                      partnerName={partnerName}
                      partnerAvatar={partnerAvatar}
                      isPartnerOnline={isPartnerOnline}
                      streak={streak}
                      onChange={handleTransformChange}
                      showControlsBar={true}
                    />
                  </div>

                  <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => { setPositionX(50); setPositionY(35); setZoom(100); }}
                      className="text-xs text-white/70 hover:text-white gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Framing
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => { setIsMobileFramingOpen(false); handleSave(); }}
                      className="bg-primary text-primary-foreground font-bold text-xs px-4 rounded-xl"
                    >
                      Save Wallpaper
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>
    );
  }

  /* DESKTOP CENTERED DIALOG (>=768px): 2-COLUMN STUDIO */
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl lg:max-w-5xl w-[95vw] p-5 sm:p-6 bg-background/95 backdrop-blur-2xl border border-primary/20 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoUpload}
          className="hidden"
          id="wallpaper-photo-upload"
        />

        {/* Dialog Header */}
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
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 flex items-center justify-center text-pink-500 shadow-xs">
                {inStudioMode ? <Wand2 className="w-4 h-4" /> : <Palette className="w-4 h-4" />}
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold">
                  {inStudioMode ? "AI Wallpaper Studio" : "Chat Wallpaper"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground line-clamp-1">
                  {inStudioMode
                    ? "Personalize photo with realistic photorealistic styling"
                    : "Drag to frame â€¢ Wheel/Pinch to zoom â€¢ Realistic chat preview"}
                </DialogDescription>
              </div>
            </div>

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

        {errorMessage && (
          <div className="flex items-center gap-2 p-2.5 bg-destructive/10 text-destructive text-xs rounded-xl border border-destructive/20 flex-shrink-0 mt-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* â”€â”€ 2-COLUMN MAIN BODY â”€â”€ */}
        <div className="flex-1 flex flex-col md:flex-row gap-5 overflow-hidden py-2 min-h-0">
          {/* Left Column: Settings & Controls */}
          <div className="w-full md:w-[380px] lg:w-[410px] flex flex-col gap-4 overflow-y-auto pr-1.5 scrollbar-thin">
            {inStudioMode ? (
              <>
                {renderStudioControls()}
                {renderFitModes()}
                {renderOpacityControl()}
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span>Choose Wallpaper</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      Instant live update
                    </span>
                  </div>
                  {renderWallpaperCards()}
                </div>

                {renderFitModes()}
                {renderOpacityControl()}

                {/* Quick Subject Framing Snaps */}
                <div className="p-3 bg-muted/40 rounded-2xl space-y-2 border border-primary/10">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <ZoomIn className="w-3.5 h-3.5 text-primary" />
                      Quick Framing Snaps
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      X: {positionX}% Â· Y: {positionY}%
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: "Top / Faces", x: 50, y: 15 },
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
                          "py-1 px-1 rounded-lg text-[11px] font-semibold border transition-all text-center",
                          Math.abs(positionX - preset.x) <= 5 && Math.abs(positionY - preset.y) <= 5
                            ? "border-primary bg-primary/15 text-primary ring-1 ring-primary/30"
                            : "border-border/60 text-muted-foreground hover:bg-muted/40"
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right Column: Live Chat Preview Viewport */}
          <div className="flex-1 flex flex-col items-center justify-center p-3 bg-muted/20 rounded-2xl border border-primary/10 overflow-hidden relative">
            {renderPreviewTopBar()}

            <div className="flex-1 w-full flex items-center justify-center overflow-hidden">
              <WallpaperFramingViewport
                imageSrc={currentDisplayImage}
                positionX={positionX}
                positionY={positionY}
                zoom={zoom}
                fit={fitMode}
                opacity={opacity}
                device={previewDevice}
                isDark={isDark}
                partnerName={partnerName}
                partnerAvatar={partnerAvatar}
                isPartnerOnline={isPartnerOnline}
                streak={streak}
                onChange={handleTransformChange}
                showControlsBar={true}
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/40 flex-shrink-0">
          {!inStudioMode ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetAll}
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
                  Save Wallpaper
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={isGenerating || !originalPhotoUrl}
                className="rounded-xl text-xs gap-1.5 h-8"
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
                        positionX,
                        positionY,
                        zoom,
                        fit: fitMode,
                      });
                      onOpenChange(false);
                    }
                  }}
                  className="text-xs rounded-xl h-8"
                >
                  Use Original Photo
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleApplyFromStudio}
                  disabled={isGenerating || !customUrl}
                  className="bg-primary text-primary-foreground font-semibold rounded-xl text-xs gap-1.5 h-8 px-4 shadow-md hover:shadow-primary/20"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Use This Wallpaper
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
