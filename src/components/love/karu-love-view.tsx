"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Sparkles,
  RotateCcw,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Compass,
  Gift,
  Flame,
  Stars,
  Quote,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CameraPreset } from "@/components/dashboard/love-3d-scene";

// Romantic Loading Skeleton for Karu's 3D Scene
function SceneSkeleton() {
  return (
    <div className="w-full h-full min-h-[380px] md:min-h-[520px] rounded-3xl bg-gradient-to-b from-rose-950/20 via-background to-rose-950/10 border border-rose-500/20 flex flex-col items-center justify-center p-8 text-center">
      <div className="relative mb-4">
        <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center shadow-lg shadow-rose-500/10">
          <Heart className="w-8 h-8 text-rose-400 fill-rose-400 heart-gentle-pulse" />
        </div>
      </div>
      <h4 className="text-base font-bold text-foreground tracking-wide">
        Bringing Our Proposal Moment to Life...
      </h4>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
        Preparing every detail — the roses, the ring, your dress, and this eternal promise.
      </p>
    </div>
  );
}

// Dynamically load the 3D scene (client-only, lazy loaded)
const DynamicLove3DScene = dynamic(() => import("@/components/dashboard/love-3d-scene"), {
  ssr: false,
  loading: () => <SceneSkeleton />,
});

interface KaruLoveViewProps {
  myId: string;
  darkMode?: boolean;
}

export function KaruLoveView({ myId, darkMode = true }: KaruLoveViewProps) {
  const [isClient, setIsClient] = useState(false);
  const [effectiveRole, setEffectiveRole] = useState<string | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("overview");
  const [autoRotate, setAutoRotate] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState(false);
  const [activeNoteTab, setActiveNoteTab] = useState<"letter" | "whyYou" | "promise">("letter");

  useEffect(() => {
    setIsClient(true);
    const stored = typeof window !== "undefined" ? localStorage.getItem("duonexus_role") : null;
    setEffectiveRole(stored);
  }, []);

  // Strict role gate: ONLY Karu can view this. Nabin sees nothing.
  const isKaru = myId === "karu" || effectiveRole === "karu";
  const isNabin = myId === "nabin" || effectiveRole === "nabin";

  if (!isClient || !isKaru || isNabin) {
    return null;
  }

  return (
    <div
      className={`relative w-full max-w-full flex flex-col font-sans transition-colors duration-300 overflow-x-hidden ${darkMode ? "bg-[#0c080d] text-rose-50" : "bg-[#fdfafb] text-zinc-900"
        }`}
    >
      {/* ════ AMBIENT ROMANTIC GLOWS (STRICTLY CONTAINED TO PREVENT HORIZONTAL SCROLL) ════ */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[340px] sm:w-[500px] h-[340px] sm:h-[500px] rounded-full bg-rose-600/10 blur-[100px] sm:blur-[130px]"
        />
        <div
          className="absolute bottom-0 right-0 w-[340px] sm:w-[600px] h-[340px] sm:h-[600px] rounded-full bg-pink-700/10 blur-[120px] sm:blur-[150px]"
        />
      </div>

      {/* ════ HERO HEADER BAR ════ */}
      <header className="relative z-10 w-full px-3.5 sm:px-8 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-rose-500/15 bg-background/50 backdrop-blur-md flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-rose-500 via-pink-500 to-amber-400 p-0.5 shadow-md shadow-rose-500/20 shrink-0">
            <div className="w-full h-full rounded-[14px] bg-black/60 flex items-center justify-center">
              <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 fill-rose-400 heart-gentle-pulse" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-base sm:text-xl font-black tracking-tight text-foreground truncate">
                Just For You, Karu <span className="text-rose-500">❤️</span>
              </h1>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
                Private & Eternal
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium truncate">
              From Nabin with all my heart — capturing where our forever began.
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRotate((prev) => !prev)}
            className="rounded-full h-8 px-2.5 sm:px-3 text-xs gap-1 border-rose-500/30 hover:bg-rose-500/15 bg-card/60 backdrop-blur-sm"
          >
            {autoRotate ? (
              <>
                <Pause className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden xs:inline">Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden xs:inline">Spin</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="rounded-full h-8 px-2.5 sm:px-3 text-xs gap-1 border-rose-500/30 hover:bg-rose-500/15 bg-card/60 backdrop-blur-sm"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden xs:inline">Standard</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden xs:inline">Expand</span>
              </>
            )}
          </Button>
        </div>
      </header>

      {/* ════ MAIN CONTENT CONTAINER ════ */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto p-3 sm:p-6 md:p-8 flex flex-col gap-6 sm:gap-8 pb-5 sm:pb-8">
        {/* TOP/SPLIT SECTION: 3D MODEL & LOVE HIGHLIGHT */}
        <div
          className={`grid gap-6 items-stretch ${isFullscreen ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-12"
            }`}
        >
          {/* ═══ 3D INTERACTIVE STAGE (lg:col-span-7) ═══ */}
          <div
            className={`relative flex flex-col rounded-3xl overflow-hidden border border-rose-500/25 bg-gradient-to-b from-card/90 via-card/70 to-card/95 shadow-2xl backdrop-blur-xl ${isFullscreen
              ? "lg:col-span-12 h-[85vh]"
              : "lg:col-span-7 h-[390px] sm:h-[500px] lg:h-[640px]"
              }`}
          >
            {/* Top Stage Bar */}
            <div className={`px-3 sm:px-4 py-2 sm:py-2.5 border-b border-rose-500/15 flex items-center justify-between gap-2 z-20 shrink-0 ${darkMode ? "bg-black/40" : "bg-rose-50/80 backdrop-blur-sm"}`}>
              <span className={`px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-[11px] sm:text-xs font-bold flex items-center gap-1.5 shadow-xs shrink-0 ${darkMode ? "text-rose-200" : "text-rose-700"}`}>
                <Stars className="w-3 h-3 text-amber-500" />
                The Proposal
              </span>

              {/* Camera Presets Selector (Overview & The Bouquet) */}
              <div className={`flex items-center gap-1 p-0.5 sm:p-1 rounded-full shadow-inner border ${darkMode ? "bg-black/60 border-white/10" : "bg-white/70 border-rose-200"}`}>
                <button
                  type="button"
                  onClick={() => setCameraPreset("overview")}
                  className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all ${
                    cameraPreset === "overview"
                      ? "bg-rose-500 text-white shadow-sm"
                      : darkMode ? "text-white/70 hover:text-white" : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setCameraPreset("bouquet")}
                  className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all ${
                    cameraPreset === "bouquet"
                      ? "bg-rose-500 text-white shadow-sm"
                      : darkMode ? "text-white/70 hover:text-white" : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  Bouquet 🌹
                </button>
              </div>
            </div>

            {/* 3D Canvas Mount — Perfectly Centered */}
            <div className="relative flex-1 w-full h-full min-h-0">
              <DynamicLove3DScene
                darkMode={darkMode}
                cameraPreset={cameraPreset}
                autoRotate={autoRotate}
              />
            </div>

            {/* Bottom Interaction Hint Bar */}
            <div className={`px-3 py-2 border-t flex items-center justify-center shrink-0 z-20 ${darkMode ? "bg-black/30 border-white/5" : "bg-rose-50/60 border-rose-200/60"}`}>
              <span className={`text-[10px] sm:text-[11px] font-medium flex items-center gap-1.5 text-center ${darkMode ? "text-muted-foreground/80" : "text-zinc-500"}`}>
                <Compass className="w-3 h-3 text-rose-500 shrink-0" />
                Drag to rotate 360° around us • Pinch to zoom
              </span>
            </div>
          </div>

          {/* ═══ ROMANTIC LETTERS & NARRATIVE (lg:col-span-5) ═══ */}
          {!isFullscreen && (
            <div className="lg:col-span-5 flex flex-col gap-4">
              {/* Tabs to explore the story */}
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-card/80 border border-rose-500/20 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setActiveNoteTab("letter")}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeNoteTab === "letter"
                      ? "bg-rose-500 text-white shadow-md shadow-rose-500/25"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <Quote className="w-3.5 h-3.5" />
                  My Letter
                </button>
                <button
                  type="button"
                  onClick={() => setActiveNoteTab("whyYou")}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeNoteTab === "whyYou"
                      ? "bg-rose-500 text-white shadow-md shadow-rose-500/25"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <Heart className="w-3.5 h-3.5 fill-current" />
                  Why You
                </button>
                <button
                  type="button"
                  onClick={() => setActiveNoteTab("promise")}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeNoteTab === "promise"
                      ? "bg-rose-500 text-white shadow-md shadow-rose-500/25"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  My Vow
                </button>
              </div>

              {/* Dynamic Note Content Card */}
              <div className="flex-1 rounded-3xl border border-rose-500/20 bg-card/80 backdrop-blur-xl p-5 sm:p-6 flex flex-col justify-between shadow-xl relative overflow-hidden">
                <div
                  className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-rose-500/10 blur-2xl pointer-events-none"
                  aria-hidden="true"
                />

                <AnimatePresence mode="wait">
                  {activeNoteTab === "letter" && (
                    <motion.div
                      key="letter"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4"
                    >
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold">
                        <Heart className="w-3 h-3 fill-rose-400 text-rose-400" />
                        From Nabin to Karu
                      </div>

                      <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight leading-tight">
                        &ldquo;You are my home, my calm, and my favorite tomorrow.&rdquo;
                      </h2>

                      <div className="space-y-3 text-sm text-foreground/85 leading-relaxed font-normal">
                        <p>
                          Karu, I don&apos;t think any number of chat messages or words could ever capture
                          just how much you mean to me.
                        </p>
                        <p>
                          Every morning begins with thoughts of you, and every night feels peaceful knowing
                          you are in my life. You have this natural, gentle warmth that makes the darkest days
                          feel light and the hardest moments feel easy.
                        </p>
                        <p>
                          When I made this 3D moment, I wanted something timeless — something that captures
                          the exact feeling of looking up at you, completely sure that you are the one I want
                          to spend every single chapter with.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {activeNoteTab === "whyYou" && (
                    <motion.div
                      key="whyYou"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4"
                    >
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold">
                        <Sparkles className="w-3 h-3 text-rose-400" />
                        Natural Love • Why Always You
                      </div>

                      <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight leading-tight">
                        &ldquo;In a world full of noise, you are my peace.&rdquo;
                      </h2>

                      <div className="space-y-3 text-sm text-foreground/85 leading-relaxed font-normal">
                        <p>
                          It was never about grand words or dramatic moments, Karu. It has always been the little things.
                          The way your laugh instantly melts away my stress. The quiet comfort of our silences, where
                          just having you near makes everything feel right.
                        </p>
                        <p>
                          With you, I never have to pretend. You make loving you the most natural, effortless thing in the world.
                          Out of eight billion souls, my heart found its anchor in you, and I would choose you in every single lifetime.
                        </p>
                        <p className={`p-3 rounded-2xl border text-xs sm:text-sm font-medium italic ${darkMode ? "bg-rose-950/25 border-rose-500/25 text-rose-300" : "bg-rose-100/80 border-rose-300/60 text-rose-700"}`}>
                          &ldquo;Holding this bouquet of red roses, on one knee looking up at you, my only thought was: thank you for existing, and thank you for choosing me.&rdquo; 🌹
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {activeNoteTab === "promise" && (
                    <motion.div
                      key="promise"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4"
                    >
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        My Eternal Promise
                      </div>

                      <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight leading-tight">
                        Three Things I Promise You
                      </h2>

                      <ul className="space-y-3 text-sm text-foreground/85">
                        <li className="flex items-start gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                            1
                          </span>
                          <span>
                            <strong className="text-foreground">To listen and understand:</strong> Even on hard days, to always choose kindness, honesty, and care.
                          </span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                            2
                          </span>
                          <span>
                            <strong className="text-foreground">To celebrate you:</strong> Your dreams, your laughter, and every little win along our journey.
                          </span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                            3
                          </span>
                          <span>
                            <strong className="text-foreground">To never stop choosing you:</strong> Every morning, every night, forever and always.
                          </span>
                        </li>
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Bottom Secret Message Reveal Button */}
                <div className="pt-5 border-t border-rose-500/20 mt-4">
                  {revealedSecret ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-3.5 rounded-2xl bg-gradient-to-r from-rose-500/20 via-pink-500/20 to-amber-500/15 border border-rose-500/35 text-center"
                    >
                      <p className={`text-xs sm:text-sm font-semibold ${darkMode ? "text-rose-300" : "text-rose-700"}`}>
                        &ldquo;Whenever you open DuoNexus, remember: there is someone out here whose entire world is brighter just because you exist in it.&rdquo; 💕
                      </p>
                    </motion.div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRevealedSecret(true)}
                      className={`w-full py-2.5 px-4 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-98 shadow-xs ${darkMode ? "bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400" : "bg-rose-100 hover:bg-rose-200 border-rose-300 text-rose-600"}`}
                    >
                      <Gift className="w-4 h-4 animate-bounce" />
                      <span>Tap to open Nabin&apos;s secret whisper</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ════ BOTTOM ROMANTIC MEMORY CARDS (RESPONSIVE GRID) ════ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-3xl bg-card/75 border border-rose-500/15 backdrop-blur-md flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                The Rose Bouquet
              </span>
              <span className="text-xl">🌹</span>
            </div>
            <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">
              Every single red rose in that bouquet represents a memory of you that I keep locked in my heart.
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-card/75 border border-rose-500/15 backdrop-blur-md flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                The Diamond Ring
              </span>
              <span className="text-xl">💍</span>
            </div>
            <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">
              A little circle with no beginning and no end — just like the love I have for you.
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-card/75 border border-rose-500/15 backdrop-blur-md flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                Our DuoNexus
              </span>
              <span className="text-xl">✨</span>
            </div>
            <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">
              Our shared universe, where distance fades and every day feels like coming home to you.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default KaruLoveView;
