"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Eye, RotateCcw, Heart } from "lucide-react";

// Soft, romantic loading placeholder for Karu
function RomanticLoadingPlaceholder() {
  return (
    <div className="w-full h-[320px] sm:h-[380px] md:h-[440px] rounded-2xl bg-gradient-to-b from-pink-500/5 via-purple-500/5 to-transparent border border-pink-500/15 flex flex-col items-center justify-center p-6 text-center animate-pulse">
      <div className="relative mb-3">
        <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center shadow-md">
          <Heart className="w-5 h-5 text-pink-400 fill-pink-400 heart-gentle-pulse" />
        </div>
      </div>
      <p className="text-sm font-medium text-foreground/80 tracking-wide">
        Something special is waiting for you...
      </p>
      <span className="text-[11px] text-muted-foreground/70 mt-1">
        Bringing your moment to life
      </span>
    </div>
  );
}

// Dynamically import the 3D scene ONLY when Karu is authenticated and viewing the section
const DynamicLove3DScene = dynamic(() => import("./love-3d-scene"), {
  ssr: false,
  loading: () => <RomanticLoadingPlaceholder />,
});

interface KaruLoveSectionProps {
  myId: string;
  darkMode?: boolean;
}

export function KaruLoveSection({ myId, darkMode = true }: KaruLoveSectionProps) {
  const [isClient, setIsClient] = useState(false);
  const [effectiveRole, setEffectiveRole] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isSceneReady, setIsSceneReady] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Double check from localStorage in case state hydration is in flight
    const storedRole = typeof window !== "undefined" ? localStorage.getItem("duonexus_role") : null;
    setEffectiveRole(storedRole);
  }, []);

  // Strict role check:
  // If myId is "nabin" or neither myId nor storedRole is "karu", render absolutely NOTHING.
  const isKaru = myId === "karu" || effectiveRole === "karu";
  const isNabin = myId === "nabin" || effectiveRole === "nabin";

  if (!isClient || !isKaru || isNabin) {
    return null;
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      aria-label="Just for You, Karu"
      className="relative overflow-hidden rounded-[28px] sm:rounded-[32px] border border-pink-500/25 bg-gradient-to-b from-card/85 via-card/70 to-card/90 p-4 sm:p-6 shadow-xl backdrop-blur-xl transition-all duration-300"
    >
      {/* Ambient Romantic Background Bloom */}
      <div
        className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-pink-500/15 blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-24 -right-20 w-72 h-72 rounded-full bg-purple-500/15 blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Subtle Made for You pill badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/25 shadow-xs mb-3"
        >
          <Sparkles className="w-3 h-3 text-pink-400" />
          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-pink-400">
            Made for You
          </span>
        </motion.div>

        {/* Primary Heading */}
        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="text-xl sm:text-2xl md:text-3xl font-black text-foreground tracking-tight"
        >
          Just for You, Karu
        </motion.h2>

        {/* First progressive text teaser */}
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.22 }}
          className="text-xs sm:text-sm text-muted-foreground mt-1.5 max-w-md font-medium leading-relaxed"
        >
          I don&apos;t think a single message could ever explain how much you mean to me.
          So I wanted to leave you something that simply says it in a different way.
        </motion.p>

        {/* 3D Model Presentation Area */}
        <div className="relative w-full my-3 sm:my-4 rounded-2xl overflow-hidden bg-gradient-to-b from-pink-500/5 via-background/40 to-purple-500/5 border border-pink-500/15 shadow-inner">
          <DynamicLove3DScene
            darkMode={darkMode}
            isZoomed={isZoomed}
            onLoaded={() => setIsSceneReady(true)}
          />

          {/* Touch / Interaction hint banner */}
          <div className="absolute bottom-2.5 inset-x-0 flex items-center justify-center pointer-events-none px-3">
            <span className="px-3 py-1 rounded-full bg-background/60 backdrop-blur-md border border-white/10 text-[10px] text-muted-foreground font-semibold shadow-xs">
              Drag to rotate • Pinch to zoom
            </span>
          </div>
        </div>

        {/* Micro-Interaction Button: "Take a closer look" */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => setIsZoomed((prev) => !prev)}
            aria-pressed={isZoomed}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold shadow-sm transition-all active:scale-95 ${
              isZoomed
                ? "bg-pink-500/20 text-pink-400 border border-pink-500/35 hover:bg-pink-500/25"
                : "bg-muted/70 hover:bg-muted text-foreground/80 border border-border"
            }`}
          >
            {isZoomed ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 text-pink-400" />
                <span>Reset view</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-pink-400" />
                <span>Take a closer look</span>
              </>
            )}
          </button>
        </div>

        {/* Progressive love letter paragraphs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="space-y-2.5 max-w-lg px-1 sm:px-3 text-center"
        >
          <p className="text-xs sm:text-sm text-foreground/90 font-normal leading-relaxed">
            Thank you for being part of my life, for the little moments, the conversations,
            the smiles, and all the memories we keep creating. No matter how simple the day is,
            having you in it makes it feel more special.
          </p>

          <p className="text-xs sm:text-sm text-pink-400 font-medium italic leading-relaxed pt-1">
            &ldquo;Some things are difficult to put into words. This is my little way of saying:
            you mean so much to me.&rdquo;
          </p>
        </motion.div>
      </div>
    </motion.section>
  );
}
export default KaruLoveSection;
