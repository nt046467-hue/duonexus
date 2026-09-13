"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, X, Volume2, VolumeX } from "lucide-react";

interface OurStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode?: boolean;
}

export function OurStoryModal({ isOpen, onClose, darkMode = true }: OurStoryModalProps) {
  // Sync with global theme (prop or document class)
  const [isDark, setIsDark] = useState<boolean>(darkMode);

  useEffect(() => {
    if (typeof document !== "undefined") {
      setIsDark(document.documentElement.classList.contains("dark"));
      const observer = new MutationObserver(() => {
        setIsDark(document.documentElement.classList.contains("dark"));
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return () => observer.disconnect();
    }
  }, []);

  useEffect(() => {
    setIsDark(darkMode);
  }, [darkMode]);

  const [charIndex, setCharIndex] = useState(0);
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [showSecretToast, setShowSecretToast] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const holdTimer = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const celebrationAudioRef = useRef<HTMLAudioElement | null>(null);

  // Lock body scroll while modal is open, and handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Clean up audio on close
  useEffect(() => {
    if (!isOpen) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (celebrationAudioRef.current) {
        celebrationAudioRef.current.pause();
        celebrationAudioRef.current.currentTime = 0;
      }
      // Reset state on close so subsequent opens start freshly
      setCharIndex(0);
      setIsTypingComplete(false);
      setShowConfetti(false);
      setShowSecretToast(false);
    }
  }, [isOpen]);

  // Play pen scratching sound while typing
  useEffect(() => {
    if (!isOpen || isMuted) {
      if (audioRef.current) audioRef.current.pause();
      return;
    }
    if (audioRef.current) {
      audioRef.current.volume = 0.08;
      if (charIndex > 0 && !isTypingComplete) {
        audioRef.current.play().catch(() => { });
      } else {
        audioRef.current.pause();
      }
    }
  }, [charIndex, isTypingComplete, isOpen, isMuted]);

  const handleHoldStart = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      setShowSecretToast(true);
      setTimeout(() => setShowSecretToast(false), 5500);
    }, 1600);
  };

  const handleHoldEnd = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const handleHeartClick = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
    setShowSecretToast(true);
    setTimeout(() => setShowSecretToast(false), 5500);
  };

  const verses = useMemo(
    () => [
      {
        lines: [
          "The day we met...",
          "I still remember that moment,",
          "our eyes met, and it felt like the whole world",
          "just paused. That one look... changed everything.",
        ],
      },
      {
        lines: [
          "The day we became more than friends...",
          "we chose each other, and I knew,",
          "you were the one I wanted, in every moment,",
          "in every season.",
        ],
      },
      {
        lines: [
          "Our first date...",
          "a night walk, under the same sky,",
          "talking, laughing, and feeling",
          "like time didn't even exist.",
        ],
      },
      {
        lines: [
          "Then came our first kiss...",
          "a moment so real, so soft,",
          "it felt like the universe finally",
          "put our hearts in the same place.",
        ],
      },
      {
        lines: [
          "Your hugs...",
          "they feel like home,",
          "safe, warm, and full of love.",
          "Every smile, every touch,",
          "just you and me — always.",
        ],
      },
      {
        lines: [
          "Now, we are all together...",
          "through the good, the bad,",
          "the silly, the serious...",
          "and I wouldn't want it any other way.",
          "Because with you, everything feels right.",
        ],
      },
      {
        lines: ["You are my today, my tomorrow,", "and my always..."],
      },
    ],
    []
  );

  const versesWithIndices = useMemo(() => {
    let currentIdx = 0;
    return verses.map((verse) => {
      const lines = verse.lines.map((line) => {
        const start = currentIdx;
        const end = start + line.length;
        currentIdx = end + 1;
        return { text: line, start, end };
      });
      currentIdx += 1;
      return { lines };
    });
  }, [verses]);

  const totalChars = useMemo(() => {
    const lastVerse = versesWithIndices[versesWithIndices.length - 1];
    const lastLine = lastVerse.lines[lastVerse.lines.length - 1];
    return lastLine.end;
  }, [versesWithIndices]);

  useEffect(() => {
    if (!isOpen) return;

    const startDelay = setTimeout(() => {
      const interval = setInterval(() => {
        setCharIndex((prev) => {
          if (prev >= totalChars) {
            clearInterval(interval);
            setIsTypingComplete(true);
            return prev;
          }
          return prev + 1;
        });
      }, 30);

      return () => clearInterval(interval);
    }, 1200);

    return () => clearTimeout(startDelay);
  }, [isOpen, totalChars]);

  useEffect(() => {
    if (isTypingComplete && isOpen) {
      setShowConfetti(true);
      if (!isMuted && celebrationAudioRef.current) {
        celebrationAudioRef.current.volume = 0.35;
        celebrationAudioRef.current.play().catch(() => { });
      }
      const timer = setTimeout(() => setShowConfetti(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [isTypingComplete, isOpen, isMuted]);

  const activeVerseIndex = useMemo(() => {
    if (isTypingComplete) return versesWithIndices.length - 1;
    const idx = versesWithIndices.findIndex(
      (verse) => charIndex < verse.lines[verse.lines.length - 1].end
    );
    return idx === -1 ? versesWithIndices.length - 1 : idx;
  }, [charIndex, versesWithIndices, isTypingComplete]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className={`fixed inset-0 z-[100] flex flex-col overflow-y-auto overflow-x-hidden transition-colors duration-500 ${isDark ? "bg-stone-950 text-stone-200" : "bg-[#f5ebd9] text-amber-950"
          }`}
        role="dialog"
        aria-modal="true"
        aria-label="Our Story"
      >
        {/* Background Noise Texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay"
          style={{
            backgroundImage:
              'url("https://www.transparenttextures.com/patterns/aged-paper.png")',
            backgroundRepeat: "repeat",
          }}
          aria-hidden="true"
        />

        {/* ════ TOP NAVBAR WITH PROMINENT CANCEL / CLOSE BUTTON ════ */}
        <header
          className="sticky top-0 z-50 w-full px-4 sm:px-8 py-3 flex items-center justify-between border-b backdrop-blur-md bg-opacity-80 transition-colors duration-300"
          style={{
            backgroundColor: isDark ? "rgba(24, 20, 20, 0.75)" : "rgba(245, 235, 217, 0.85)",
            borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(120, 60, 20, 0.15)",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-bold tracking-wide flex items-center gap-1.5 font-['Playfair_Display']">
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
              Our Story
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Mute Toggle */}
            <button
              type="button"
              onClick={() => setIsMuted((prev) => !prev)}
              className={`p-2.5 rounded-full border transition-all active:scale-95 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center ${isDark
                ? "bg-stone-800/80 hover:bg-stone-700 text-stone-300 border-stone-700"
                : "bg-white/70 hover:bg-white text-amber-950 border-amber-200"
                }`}
              aria-label={isMuted ? "Unmute audio" : "Mute audio"}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            {/* Cancel / Close Action Button */}
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-full font-bold text-xs sm:text-sm border transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-sm min-h-[44px] ${isDark
                ? "bg-stone-800/90 hover:bg-rose-950/80 text-rose-200 border-rose-500/30 hover:border-rose-400"
                : "bg-white/80 hover:bg-rose-50 text-rose-800 border-rose-300 hover:border-rose-400"
                }`}
              aria-label="Cancel and return to proposal"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          </div>
        </header>

        {/* Secret Message Toast — Mobile Responsive & Natural Romantic Line */}
        <div className="fixed inset-x-0 bottom-6 sm:bottom-8 z-[110] flex justify-center pointer-events-none px-4">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{
              opacity: showSecretToast ? 1 : 0,
              y: showSecretToast ? 0 : 24,
              scale: showSecretToast ? 1 : 0.96,
            }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="w-full max-w-sm sm:max-w-md px-4 sm:px-6 py-3.5 sm:py-4 rounded-2xl shadow-2xl backdrop-blur-md border text-center"
            style={{
              backgroundColor: isDark ? "rgba(35, 30, 30, 0.94)" : "rgba(255, 255, 255, 0.95)",
              borderColor: isDark ? "rgba(244, 114, 182, 0.3)" : "rgba(244, 63, 94, 0.25)",
              boxShadow: isDark
                ? "0 20px 40px -10px rgba(0, 0, 0, 0.75), 0 0 25px rgba(244, 114, 182, 0.15)"
                : "0 20px 40px -10px rgba(120, 60, 20, 0.2), 0 0 25px rgba(244, 63, 94, 0.12)",
            }}
          >
            <p
              className={`font-['Caveat'] text-lg sm:text-xl md:text-2xl leading-relaxed break-words ${
                isDark ? "text-rose-200" : "text-amber-950"
              }`}
            >
              &ldquo;P.S. Loving you is the easiest, most natural thing my heart has ever known.&rdquo; 💖
            </p>
          </motion.div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 w-full flex justify-center py-6 sm:py-10 px-3 sm:px-6">
          <div
            className={`relative z-10 w-full max-w-5xl rounded-2xl p-[1px] transition-colors duration-500 bg-gradient-to-br ${isDark
              ? "from-stone-700/50 via-stone-800/20 to-red-900/40 shadow-[0_0_40px_rgba(0,0,0,0.8)]"
              : "from-amber-200/80 via-amber-100/30 to-amber-600/40 shadow-[0_0_40px_rgba(120,60,20,0.15)]"
              }`}
          >
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{
                opacity: 1,
                y: 0,
                x: isShaking ? [-8, 8, -6, 6, -4, 4, 0] : 0,
              }}
              transition={{ duration: isShaking ? 0.4 : 0.6, ease: "easeOut" }}
              className={`relative w-full flex flex-col md:flex-row shadow-2xl rounded-2xl overflow-hidden transition-colors duration-500 ${isDark ? "bg-stone-900/95" : "bg-[#f5ebd9]/95"
                }`}
            >
              {/* Typing Progress Line */}
              <div className="absolute top-0 left-0 w-full h-[3px] bg-transparent z-40">
                <div
                  className={`h-full transition-all duration-75 ease-linear ${isDark ? "bg-red-700/80" : "bg-red-800/60"
                    }`}
                  style={{
                    width: `${totalChars > 0 ? Math.min(100, (charIndex / totalChars) * 100) : 0
                      }%`,
                  }}
                />
              </div>

              {/* Background Vintage Rose Image */}
              <img
                src="/our-story/image.png"
                alt="Vintage rose background"
                className="absolute inset-0 w-full h-full object-cover object-[75%_center] sm:object-right z-0 pointer-events-none select-none opacity-80"
              />

              {/* Blending Overlay */}
              <div
                className={`absolute inset-0 pointer-events-none z-0 transition-colors duration-500 ${isDark ? "bg-black/65 mix-blend-overlay" : "bg-amber-900/10 mix-blend-multiply"
                  }`}
              />

              {/* Left Vignette Gradient */}
              <div
                className={`absolute inset-y-0 left-0 w-full md:w-[65%] pointer-events-none z-0 transition-colors duration-500 ${isDark
                  ? "bg-gradient-to-r from-stone-950/95 via-stone-900/80 to-transparent"
                  : "bg-gradient-to-r from-[#fef8ef]/95 via-[#fef8ef]/70 to-transparent"
                  }`}
              />

              {/* Falling Petals Effect (subtle) */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
                {[...Array(10)].map((_, i) => (
                  <motion.div
                    key={`petal-${i}`}
                    initial={{
                      opacity: 0,
                      y: -40,
                      x: (i * 110) % 900,
                      rotate: 0,
                      scale: 0.5 + (i % 3) * 0.2,
                    }}
                    animate={{
                      opacity: [0, 0.7, 0],
                      y: "110vh",
                      rotate: 360,
                    }}
                    transition={{
                      duration: 12 + (i % 5) * 3,
                      repeat: Infinity,
                      delay: (i % 4) * 2.5,
                      ease: "linear",
                    }}
                    className={`absolute top-0 w-3.5 h-3.5 rounded-tl-full rounded-br-full ${isDark ? "bg-red-900/50" : "bg-red-700/40"
                      }`}
                  />
                ))}
              </div>

              {/* Left Column: The Narrative Poem */}
              <div className="flex-1 p-5 sm:p-10 md:p-14 flex flex-col justify-center relative z-20 min-h-[480px]">
                {/* Corner Ornaments */}
                <div
                  className={`absolute top-5 left-5 w-8 h-8 border-t-2 border-l-2 opacity-40 transition-colors ${isDark ? "border-red-900" : "border-red-800"
                    }`}
                />
                <div
                  className={`absolute bottom-5 left-5 w-8 h-8 border-b-2 border-l-2 opacity-40 transition-colors ${isDark ? "border-red-900" : "border-red-800"
                    }`}
                />

                <h1
                  className={`font-['Great_Vibes'] text-4xl sm:text-6xl md:text-7xl mb-5 sm:mb-7 relative inline-block drop-shadow-md ${isDark ? "text-stone-200" : "text-amber-950"
                    }`}
                >
                  Our Story...
                  <motion.span
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="inline-block ml-3"
                  >
                    <Heart
                      className={`inline ${isDark ? "text-red-500/80" : "text-red-700/80"}`}
                      size={20}
                      fill="currentColor"
                    />
                  </motion.span>
                </h1>

                <div
                  className={`font-['Caveat'] text-xl sm:text-2xl md:text-[1.6rem] leading-snug sm:leading-tight max-w-lg drop-shadow-xs relative ${isDark ? "text-stone-300" : "text-amber-900"
                    }`}
                >
                  {/* Invisible Layout Placeholder to prevent content jump */}
                  <div className="opacity-0 pointer-events-none select-none" aria-hidden="true">
                    {verses.map((verse, index) => (
                      <React.Fragment key={`hidden-${index}`}>
                        <p className="mb-4 sm:mb-5">
                          {verse.lines.map((line, i) => (
                            <React.Fragment key={i}>
                              {line}
                              {i < verse.lines.length - 1 && <br />}
                            </React.Fragment>
                          ))}
                        </p>
                        {index < verses.length - 1 && (
                          <div className="flex items-center justify-center gap-3 my-4 sm:my-6">
                            <div className="w-12 h-[1px] bg-current opacity-70" />
                            <Heart size={10} fill="currentColor" className="opacity-80" />
                            <div className="w-12 h-[1px] bg-current opacity-70" />
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Absolute Typewriter Text */}
                  <div className="absolute top-0 left-0 w-full h-full">
                    {versesWithIndices.map((verse, index) => {
                      const isVerseFinished =
                        charIndex >= verse.lines[verse.lines.length - 1].end;
                      const hasStartedTyping = charIndex >= verse.lines[0].start;

                      return (
                        <React.Fragment key={`type-${index}`}>
                          <motion.p
                            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
                            animate={{
                              opacity: hasStartedTyping ? 1 : 0,
                              y: hasStartedTyping ? 0 : 12,
                              filter: hasStartedTyping ? "blur(0px)" : "blur(6px)",
                            }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="mb-4 sm:mb-5"
                          >
                            {verse.lines.map((line, i) => {
                              if (charIndex < line.start) return null;

                              const displayed = line.text.slice(
                                0,
                                Math.max(0, charIndex - line.start)
                              );
                              const isTypingThisLine =
                                charIndex >= line.start && charIndex < line.end;

                              return (
                                <React.Fragment key={i}>
                                  {displayed}
                                  {isTypingThisLine && (
                                    <span
                                      className={`inline-block w-[2px] h-[1.1em] ml-1 align-middle animate-pulse ${isDark ? "bg-stone-400" : "bg-amber-800/70"
                                        }`}
                                    />
                                  )}
                                  {i < verse.lines.length - 1 && charIndex >= line.end && (
                                    <br />
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </motion.p>

                          {index < versesWithIndices.length - 1 && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: isVerseFinished ? 0.3 : 0 }}
                              transition={{ duration: 0.8 }}
                              className="flex items-center justify-center gap-3 my-4 sm:my-6"
                            >
                              <div className="w-12 h-[1px] bg-current" />
                              <Heart size={10} fill="currentColor" />
                              <div className="w-12 h-[1px] bg-current" />
                            </motion.div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* Reading Progression Dots */}
                <div className="flex items-center justify-start gap-2 mt-8 mb-4 px-1">
                  {versesWithIndices.map((_, i) => (
                    <div
                      key={`progress-${i}`}
                      className={`h-1.5 rounded-full transition-all duration-500 ease-in-out ${i === activeVerseIndex
                        ? isDark
                          ? "w-8 bg-red-700"
                          : "w-8 bg-red-800"
                        : i < activeVerseIndex
                          ? isDark
                            ? "w-2.5 bg-stone-500"
                            : "w-2.5 bg-[#cbb8a3]"
                          : isDark
                            ? "w-2.5 bg-stone-800"
                            : "w-2.5 bg-[#e8d5bf]"
                        }`}
                    />
                  ))}
                </div>

                {/* Footer Signature & Monogram */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{
                    opacity: isTypingComplete ? 1 : 0,
                    y: isTypingComplete ? 0 : 15,
                  }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="mt-6 sm:mt-10 flex flex-col items-center justify-center text-center max-w-sm mx-auto md:ml-0 md:mr-auto relative"
                >
                  {/* Celebration Confetti */}
                  {showConfetti && (
                    <div className="absolute top-1/2 left-1/2 w-0 h-0 pointer-events-none z-50">
                      {[...Array(25)].map((_, i) => (
                        <motion.div
                          key={`confetti-${i}`}
                          initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
                          animate={{
                            opacity: [1, 1, 1, 0],
                            scale: [0, 1, 1, 1],
                            x: (Math.random() - 0.5) * 400,
                            y: [0, -120 - Math.random() * 200, 120 + Math.random() * 200],
                            rotate: [0, Math.random() * 360, Math.random() * 720],
                          }}
                          transition={{
                            duration: 3 + Math.random() * 2,
                            times: [0, 0.1, 0.8, 1],
                            ease: "easeOut",
                          }}
                          className={`absolute w-2.5 h-2.5 rounded-tl-full rounded-br-full ${["bg-red-500", "bg-rose-400", "bg-red-700", "bg-pink-500"][i % 4]
                            }`}
                        />
                      ))}
                    </div>
                  )}

                  {/* NK Monogram with Hold for Secret Whisper */}
                  <div
                    className="relative w-44 h-28 flex items-center justify-center cursor-pointer select-none"
                    onMouseDown={handleHoldStart}
                    onMouseUp={handleHoldEnd}
                    onMouseLeave={handleHoldEnd}
                    onTouchStart={handleHoldStart}
                    onTouchEnd={handleHoldEnd}
                    onTouchCancel={handleHoldEnd}
                    title="Hold for a secret whisper..."
                  >
                    <img
                      src="/our-story/signature.png"
                      alt="NK Monogram"
                      className={`w-full h-full object-contain ${isDark ? "invert opacity-80" : "opacity-90 mix-blend-multiply"
                        } pointer-events-none select-none`}
                    />
                  </div>

                  <p
                    className={`mt-1 font-['Playfair_Display'] italic text-xs tracking-widest uppercase ${isDark ? "text-stone-500" : "text-amber-900/60"
                      }`}
                  >
                    Forever &amp; Always • Nabin &amp; Karu
                  </p>

                  <div
                    className="mt-4 cursor-pointer p-2 rounded-full hover:bg-rose-500/10 transition-colors"
                    onClick={handleHeartClick}
                  >
                    <Heart
                      className={isDark ? "text-red-500/70" : "text-red-700/70"}
                      size={20}
                      fill="currentColor"
                    />
                  </div>
                </motion.div>
              </div>

              {/* Right Spacer for Desktop */}
              <div className="flex-1 hidden md:block relative z-20 pointer-events-none" />
            </motion.div>
          </div>
        </div>

        {/* Audio Elements */}
        <audio
          ref={audioRef}
          src="https://orangefreesounds.com/wp-content/uploads/2024/01/Pen-scribbling-sound-effect.mp3"
          loop
          preload="none"
        />
        <audio
          ref={celebrationAudioRef}
          src="https://orangefreesounds.com/wp-content/uploads/2020/09/Magic-chime-sound-effect.mp3"
          preload="none"
        />
      </div>
    </AnimatePresence>
  );
}
