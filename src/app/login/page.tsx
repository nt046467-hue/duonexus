"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { signInWithCustomToken, updateProfile } from "firebase/auth";
import { useAuth, useUser } from "@/firebase";
import { motion, AnimatePresence, useAnimation, useReducedMotion } from "motion/react";
import { Delete, Check, Sun, Moon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { mapToSafeAuthError, logAuthEvent, type SafeAuthError } from "@/lib/auth-errors";

type ScreenState = "pin" | "verifying" | "success" | "exiting";

const LOCKOUT_STORAGE_KEY = "duonexus_lockout_until";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [screenState, setScreenState] = useState<ScreenState>("pin");
  const [isDark, setIsDark] = useState<boolean>(true);
  const [authError, setAuthError] = useState<SafeAuthError | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  const controls = useAnimation();
  const shouldReduceMotion = useReducedMotion();
  const router = useRouter();
  const auth = useAuth();
  const { user } = useUser();

  const isNavigatingRef = useRef(false);
  const isVerifyingRef = useRef(false);
  const lockoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync theme with localStorage or system preference
  useEffect(() => {
    router.prefetch("/chat");
    try {
      const stored = localStorage.getItem("theme");
      const systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      const shouldBeDark = stored ? stored === "dark" : (systemDark ?? true);
      setIsDark(shouldBeDark);
      if (shouldBeDark) {
        document.documentElement.classList.add("dark");
        document.documentElement.style.background = "#0C0C0C";
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.style.background = "#F8FAFC";
      }
    } catch {
      setIsDark(true);
    }
  }, [router]);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    try {
      localStorage.setItem("theme", nextDark ? "dark" : "light");
      if (nextDark) {
        document.documentElement.classList.add("dark");
        document.documentElement.style.background = "#0C0C0C";
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.style.background = "#F8FAFC";
      }
    } catch {}
  };

  // If already logged in with stored role, automatically redirect to chat
  useEffect(() => {
    if (user?.displayName && typeof window !== "undefined" && localStorage.getItem("duonexus_role")) {
      router.push("/chat");
    }
  }, [user, router]);

  // Start lockout countdown timer with timestamp precision
  const startLockoutCountdown = useCallback((lockedUntilMs: number) => {
    if (lockoutTimerRef.current) {
      clearInterval(lockoutTimerRef.current);
    }

    try {
      localStorage.setItem(LOCKOUT_STORAGE_KEY, String(lockedUntilMs));
    } catch {}

    const updateTimer = () => {
      const now = Date.now();
      const diffMs = lockedUntilMs - now;
      if (diffMs <= 0) {
        if (lockoutTimerRef.current) {
          clearInterval(lockoutTimerRef.current);
          lockoutTimerRef.current = null;
        }
        try {
          localStorage.removeItem(LOCKOUT_STORAGE_KEY);
        } catch {}
        setIsLocked(false);
        setRemainingSeconds(0);
        setAuthError(null);
        setPin("");
        return;
      }
      const secs = Math.ceil(diffMs / 1000);
      setRemainingSeconds(secs);
      setIsLocked(true);
    };

    updateTimer();
    lockoutTimerRef.current = setInterval(updateTimer, 500);
  }, []);

  // Check lockout state on mount (both local cached timestamp & server verification)
  useEffect(() => {
    // 1. Immediate local check to avoid any flash of unlocked state
    try {
      const storedLockout = localStorage.getItem(LOCKOUT_STORAGE_KEY);
      if (storedLockout) {
        const lockedUntil = Number(storedLockout);
        if (lockedUntil > Date.now()) {
          startLockoutCountdown(lockedUntil);
          setAuthError({
            title: "Too many attempts",
            message: "Please wait a moment before trying again.",
            isLocked: true,
            lockedUntil,
          });
        } else {
          localStorage.removeItem(LOCKOUT_STORAGE_KEY);
        }
      }
    } catch {}

    // 2. Authoritative server check
    let isCancelled = false;
    fetch("/api/verify-pin", { method: "GET", cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (isCancelled) return;
        if (data?.isLocked && typeof data?.lockedUntil === "number") {
          startLockoutCountdown(data.lockedUntil);
          setAuthError({
            title: "Too many attempts",
            message: "Please wait a moment before trying again.",
            isLocked: true,
            lockedUntil: data.lockedUntil,
          });
        }
      })
      .catch(() => {
        // Silently tolerate background check errors
      });

    return () => {
      isCancelled = true;
      if (lockoutTimerRef.current) {
        clearInterval(lockoutTimerRef.current);
      }
    };
  }, [startLockoutCountdown]);

  // Real backend verification + Firebase login
  const verifyAndAuthenticate = useCallback(
    async (pinToVerify: string) => {
      if (isVerifyingRef.current || isLocked) return;
      isVerifyingRef.current = true;

      setScreenState("verifying");
      setAuthError(null);

      const startTime = Date.now();

      try {
        const res = await fetch("/api/verify-pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: pinToVerify }),
        });

        const data = await res.json().catch(() => null);

        // Enforce minimum convergence animation time (380ms) for smooth visual feel
        const elapsed = Date.now() - startTime;
        const minAnimationWait = shouldReduceMotion ? 80 : 380;
        if (elapsed < minAnimationWait) {
          await new Promise((resolve) => setTimeout(resolve, minAnimationWait - elapsed));
        }

        // Handle rate limiting / lockout (HTTP 429)
        if (res.status === 429 || data?.isLocked) {
          const safeErr = mapToSafeAuthError(null, 429, data);
          setAuthError(safeErr);
          setPin("");
          setScreenState("pin");
          isVerifyingRef.current = false;

          const lockedUntil = safeErr.lockedUntil || Date.now() + 30000;
          startLockoutCountdown(lockedUntil);

          // Subtle shake feedback
          if (!shouldReduceMotion) {
            controls.start({
              x: [-6, 6, -4, 4, -2, 2, 0],
              transition: { duration: 0.35, ease: "easeInOut" },
            });
          }
          return;
        }

        // Handle incorrect PIN (HTTP 401 or invalid response)
        if (!res.ok || !data?.valid) {
          const safeErr = mapToSafeAuthError(null, res.status, data);
          setAuthError(safeErr);
          setPin("");
          setScreenState("pin");
          isVerifyingRef.current = false;

          // Subtle Messenger/WhatsApp-style horizontal shake
          if (!shouldReduceMotion) {
            controls.start({
              x: [-6, 6, -4, 4, -2, 2, 0],
              transition: { duration: 0.35, ease: "easeInOut" },
            });
          }
          return;
        }

        // Trigger gentle haptic vibration if supported on mobile devices
        if (typeof window !== "undefined" && window.navigator?.vibrate) {
          try {
            window.navigator.vibrate([25, 35, 25]);
          } catch {}
        }

        // Authenticate with Firebase using resolved identity & server-minted custom token
        const identity: string = data.identity || "nabin";
        const displayName = identity === "nabin" ? "Nabin" : "Karu";
        const photoURL = identity === "nabin" ? "/avatars/nabin.png" : "/avatars/karu.png";

        if (!data.customToken) {
          throw new Error("Invalid session token received.");
        }

        const userCredential = await signInWithCustomToken(auth, data.customToken);
        await updateProfile(userCredential.user, { displayName, photoURL });
        localStorage.setItem("duonexus_role", identity);

        // Transition to success state (turns green pill, shows checkmark)
        setScreenState("success");

        // Natural pause on success before clean navigation
        setTimeout(() => {
          setScreenState("exiting");
        }, shouldReduceMotion ? 250 : 700);
      } catch (err: any) {
        logAuthEvent("verification_exception", { message: err?.message });
        setPin("");
        setScreenState("pin");
        isVerifyingRef.current = false;

        const safeErr = mapToSafeAuthError(err);
        setAuthError(safeErr);

        if (!shouldReduceMotion) {
          controls.start({
            x: [-6, 6, -4, 4, -2, 2, 0],
            transition: { duration: 0.35, ease: "easeInOut" },
          });
        }
      }
    },
    [auth, controls, isLocked, shouldReduceMotion, startLockoutCountdown]
  );

  // Navigate cleanly when exit transition plays
  useEffect(() => {
    if (screenState === "exiting" && !isNavigatingRef.current) {
      isNavigatingRef.current = true;
      const t = setTimeout(() => {
        router.push("/chat");
      }, shouldReduceMotion ? 50 : 320);
      return () => clearTimeout(t);
    }
  }, [screenState, router, shouldReduceMotion]);

  // Input handling
  const handleInput = useCallback(
    (value: string) => {
      if (screenState !== "pin" || isLocked || isVerifyingRef.current) return;

      if (value === "backspace") {
        setPin((prev) => prev.slice(0, -1));
        setAuthError(null);
        return;
      }

      if (pin.length < 4) {
        const newPin = pin + value;
        setPin(newPin);
        setAuthError(null);

        if (newPin.length === 4) {
          verifyAndAuthenticate(newPin);
        }
      }
    },
    [pin, screenState, isLocked, verifyAndAuthenticate]
  );

  // Physical keyboard support (0-9, Backspace, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isLocked || screenState !== "pin" || isVerifyingRef.current) return;

      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleInput(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleInput("backspace");
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (pin.length === 4) {
          verifyAndAuthenticate(pin);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleInput, isLocked, screenState, pin, verifyAndAuthenticate]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 340, damping: 28 } },
  };

  const merged = screenState === "verifying" || screenState === "success" || screenState === "exiting";
  const isSuccess = screenState === "success" || screenState === "exiting";

  return (
    <div
      className={cn(
        "min-h-[100dvh] w-full overflow-x-hidden overflow-y-auto flex flex-col items-center justify-center font-sans antialiased transition-colors duration-300 relative select-none py-4 sm:py-6",
        isDark ? "bg-[#0C0C0C] text-gray-100" : "bg-[#F8FAFC] text-gray-900"
      )}
      style={{
        paddingTop: "max(1.25rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      {/* Top Floating Theme Toggle */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to Bright Mode" : "Switch to Dark Mode"}
          className={cn(
            "p-2 sm:p-2.5 rounded-full transition-all active:scale-90 cursor-pointer shadow-sm border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            isDark
              ? "bg-[#161616] border-white/10 text-amber-400 hover:bg-[#202020]"
              : "bg-white border-gray-200 text-amber-500 hover:bg-gray-100 shadow-xs"
          )}
        >
          {isDark ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />}
        </button>
      </div>

      {/* Main Animated Login Container */}
      <AnimatePresence mode="wait">
        {screenState !== "exiting" && (
          <motion.div
            key="screen"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.96, y: -12 }
            }
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[380px] sm:max-w-[420px] mx-auto flex flex-col items-center px-4 will-change-transform my-auto"
          >
            <motion.div
              initial="hidden"
              animate="visible"
              variants={containerVariants}
              className="w-full flex flex-col items-center"
            >
              {/* Hero Character Avatar */}
              <motion.div variants={itemVariants} className="mb-3 sm:mb-4 relative shrink-0">
                <div
                  className={cn(
                    "absolute inset-0 rounded-full blur-xl transform scale-110 pointer-events-none transition-opacity",
                    isDark
                      ? "bg-gradient-to-tr from-white/10 via-primary/10 to-transparent opacity-80"
                      : "bg-gradient-to-tr from-rose-200/50 via-pink-200/40 to-transparent opacity-90"
                  )}
                />
                <div
                  className={cn(
                    "relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-full overflow-hidden p-1 transition-colors duration-300 border",
                    isDark
                      ? "bg-[#141414] shadow-[0_6px_24px_rgba(0,0,0,0.6)] border-white/10"
                      : "bg-white shadow-[0_6px_20px_rgba(0,0,0,0.08)] border-gray-200"
                  )}
                >
                  <img
                    src="/images/hero_character_1788746411651.jpg"
                    alt="DuoNexus Avatar"
                    className="w-full h-full object-cover rounded-full pointer-events-none"
                    draggable={false}
                  />
                </div>
              </motion.div>

              {/* Title Header */}
              <motion.div
                variants={itemVariants}
                className="text-center mb-3 sm:mb-5 flex flex-col items-center justify-end relative shrink-0 px-2 min-h-[56px] sm:min-h-[64px]"
              >
                <AnimatePresence mode="wait">
                  {isSuccess ? (
                    <motion.h1
                      key="success-title"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        "text-2xl sm:text-[28px] leading-tight font-bold tracking-tight",
                        isDark ? "text-white" : "text-gray-900"
                      )}
                    >
                      Verified successfully
                    </motion.h1>
                  ) : (
                    <motion.h1
                      key="welcome-title"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        "text-2xl sm:text-[28px] leading-snug font-bold tracking-tight",
                        isDark ? "text-white" : "text-gray-900"
                      )}
                    >
                      Welcome Back
                    </motion.h1>
                  )}
                </AnimatePresence>

                <div className="h-1 sm:h-1.5" />

                <AnimatePresence mode="wait">
                  {screenState === "pin" && !isLocked && (
                    <motion.p
                      key="subtext-pin"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className={cn(
                        "text-xs sm:text-sm font-medium",
                        isDark ? "text-gray-400" : "text-gray-500"
                      )}
                    >
                      Enter your 4-digit PIN to continue
                    </motion.p>
                  )}
                  {screenState === "verifying" && (
                    <motion.p
                      key="subtext-verifying"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className={cn(
                        "text-xs sm:text-sm font-medium",
                        isDark ? "text-gray-300" : "text-gray-600"
                      )}
                    >
                      Verifying...
                    </motion.p>
                  )}
                  {isSuccess && (
                    <motion.p
                      key="subtext-success"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="text-xs sm:text-sm text-emerald-500 font-medium"
                    >
                      Entering your private space...
                    </motion.p>
                  )}
                  {isLocked && (
                    <motion.p
                      key="subtext-locked"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="text-xs sm:text-sm text-amber-500/90 dark:text-amber-400 font-medium"
                    >
                      Please wait before trying again
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* PIN Box Row / Pill Convergence Zone */}
              <motion.div
                variants={itemVariants}
                className="w-full mb-3 sm:mb-4 relative flex flex-col items-center shrink-0"
              >
                <div
                  className="relative flex justify-center items-center w-full h-[52px] sm:h-[60px] [--box:46px] sm:[--box:56px] [--gap:0.6rem] sm:[--gap:0.85rem]"
                  role="status"
                  aria-live="polite"
                >
                  {/* The 4 boxes converge to center + shrink on verification */}
                  <motion.div
                    animate={controls}
                    className="flex justify-center items-center will-change-transform"
                    style={{ gap: "var(--gap)" }}
                  >
                    {[0, 1, 2, 3].map((index) => {
                      const isActive = pin.length === index && screenState === "pin" && !isLocked;
                      const isFilled = pin.length > index;
                      const offsetSteps = index - 1.5;
                      const translateX = merged
                        ? `calc(${-offsetSteps} * (var(--box) + var(--gap)))`
                        : "0px";

                      const hasError = !!authError && !isLocked;

                      return (
                        <div
                          key={index}
                          className="rounded-2xl flex items-center justify-center will-change-transform"
                          style={{
                            width: "var(--box)",
                            height: "var(--box)",
                            transform: `translateX(${translateX}) scale(${merged ? 0.35 : 1})`,
                            opacity: merged ? 0 : 1,
                            transition: shouldReduceMotion
                              ? "opacity 160ms ease"
                              : "transform 360ms cubic-bezier(0.4,0,0.2,1), opacity 300ms cubic-bezier(0.4,0,0.2,1)",
                          }}
                        >
                          <div
                            className={cn(
                              "w-full h-full rounded-2xl flex items-center justify-center border transition-all duration-200",
                              isDark
                                ? isLocked
                                  ? "border-white/5 bg-white/[0.02] opacity-50"
                                  : hasError
                                  ? "border-rose-500/40 bg-rose-500/5 shadow-[0_0_0_2px_rgba(244,63,94,0.15)]"
                                  : isActive
                                  ? "border-gray-400 bg-[#1A1A1A] shadow-[0_0_0_3px_rgba(255,255,255,0.06)]"
                                  : isFilled
                                  ? "border-white/20 bg-[#1E1E1E] shadow-xs"
                                  : "border-white/10 bg-white/5"
                                : isLocked
                                ? "border-gray-200 bg-gray-100/50 opacity-50"
                                : hasError
                                ? "border-rose-300 bg-rose-50/50 shadow-[0_0_0_2px_rgba(244,63,94,0.15)]"
                                : isActive
                                ? "border-gray-800 bg-white shadow-[0_0_0_3px_rgba(0,0,0,0.06)] ring-1 ring-gray-900/10"
                                : isFilled
                                ? "border-gray-300 bg-white shadow-xs"
                                : "border-gray-200 bg-gray-50/80"
                            )}
                          >
                            {isFilled && (
                              <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 450, damping: 25 }}
                                className={cn(
                                  "w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full",
                                  isDark ? "bg-white" : "bg-gray-900"
                                )}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>

                  {/* Merged pill — pulses while verifying, morphs into green checkmark */}
                  <div
                    className="absolute rounded-2xl border flex items-center justify-center pointer-events-none will-change-transform"
                    style={{
                      width: "var(--box)",
                      height: "var(--box)",
                      transform: `scale(${merged ? 1 : 0.3})`,
                      opacity: merged ? 1 : 0,
                      borderColor: isSuccess ? "rgb(16,185,129)" : isDark ? "rgb(156,163,175)" : "rgb(209,213,219)",
                      backgroundColor: isSuccess ? (isDark ? "#101915" : "#ECFDF5") : (isDark ? "#161618" : "#FFFFFF"),
                      transition: shouldReduceMotion
                        ? "opacity 160ms ease, background-color 280ms ease, border-color 280ms ease"
                        : "transform 360ms cubic-bezier(0.4,0,0.2,1) 50ms, opacity 300ms ease 50ms, background-color 280ms ease, border-color 280ms ease",
                      boxShadow: !merged
                        ? "none"
                        : isSuccess
                        ? "0 0 0 3px rgba(16,185,129,0.2), 0 0 30px 10px rgba(16,185,129,0.35)"
                        : isDark
                        ? "0 0 0 3px rgba(156,163,175,0.15), 0 0 20px 6px rgba(156,163,175,0.2)"
                        : "0 0 0 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)",
                    }}
                  >
                    {screenState === "verifying" && (
                      <motion.div
                        animate={shouldReduceMotion ? {} : { scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
                        transition={{
                          duration: 0.8,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                        className={cn(
                          "absolute inset-0 rounded-2xl border pointer-events-none",
                          isDark ? "border-gray-400/40" : "border-gray-300"
                        )}
                      />
                    )}
                    <AnimatePresence mode="wait">
                      {isSuccess && (
                        <motion.div
                          key="check"
                          initial={{ scale: 0, opacity: 0, rotate: -30 }}
                          animate={{ scale: 1, opacity: 1, rotate: 0 }}
                          transition={{ type: "spring", stiffness: 420, damping: 22 }}
                        >
                          <Check className="w-5 h-5 sm:w-7 sm:h-7 text-emerald-500" strokeWidth={3} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Inline Safe Feedback / Error / Lockout Zone */}
                <div
                  className="w-full min-h-[44px] mt-2 flex items-center justify-center text-center px-3"
                  aria-live="polite"
                >
                  <AnimatePresence mode="wait">
                    {isLocked ? (
                      <motion.div
                        key="lockout-badge"
                        initial={{ opacity: 0, y: -4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.97 }}
                        transition={{ duration: 0.2 }}
                        className={cn(
                          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium shadow-xs",
                          isDark
                            ? "bg-amber-950/30 border-amber-500/20 text-amber-300"
                            : "bg-amber-50 border-amber-200 text-amber-800"
                        )}
                      >
                        <Clock className="w-3.5 h-3.5 shrink-0 animate-pulse text-amber-400" />
                        <span>
                          Try again in{" "}
                          <strong className="font-semibold tabular-nums">
                            {remainingSeconds}s
                          </strong>
                        </span>
                      </motion.div>
                    ) : authError && screenState === "pin" ? (
                      <motion.div
                        key="incorrect-pin-msg"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.2 }}
                        className="flex flex-col items-center"
                      >
                        <p className="text-xs sm:text-[13px] font-semibold text-rose-500 dark:text-rose-400">
                          {authError.title}
                        </p>
                        <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {authError.message}
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* Responsive Numeric Keypad */}
              <AnimatePresence>
                {screenState === "pin" && (
                  <motion.div
                    variants={itemVariants}
                    exit={{ opacity: 0, y: 10, transition: { duration: 0.18 } }}
                    className="w-full max-w-[270px] sm:max-w-[300px] mx-auto grid grid-cols-3 gap-y-2 sm:gap-y-2.5 gap-x-3.5 sm:gap-x-4 shrink-0"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <KeypadButton
                        key={num}
                        onClick={() => handleInput(num.toString())}
                        disabled={isLocked}
                        isDark={isDark}
                      >
                        {num}
                      </KeypadButton>
                    ))}
                    <div className="pointer-events-none" />
                    <KeypadButton
                      onClick={() => handleInput("0")}
                      disabled={isLocked}
                      isDark={isDark}
                    >
                      0
                    </KeypadButton>
                    <KeypadButton
                      onClick={() => handleInput("backspace")}
                      disabled={isLocked || pin.length === 0}
                      isDark={isDark}
                      ariaLabel="Delete last digit"
                    >
                      <Delete
                        className={cn(
                          "w-5 h-5 sm:w-6 sm:h-6 stroke-[2]",
                          isDark ? "text-gray-400" : "text-gray-600"
                        )}
                      />
                    </KeypadButton>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function KeypadButton({
  children,
  onClick,
  disabled,
  isDark = true,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  isDark?: boolean;
  ariaLabel?: string;
}) {
  const label = ariaLabel || (typeof children === "string" || typeof children === "number" ? `Digit ${children}` : undefined);

  return (
    <motion.button
      type="button"
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.94 } : {}}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-disabled={disabled}
      className={cn(
        "h-[50px] sm:h-[56px] shrink-0 flex items-center justify-center text-[22px] sm:text-[26px] font-medium rounded-2xl transition-all duration-150 select-none touch-manipulation cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary border",
        isDark
          ? "text-gray-100 bg-[#151515] shadow-[0_1px_3px_rgba(0,0,0,0.4)] border-white/5 hover:bg-[#1E1E1E] active:bg-[#252525] disabled:bg-white/[0.02] disabled:border-white/[0.03] disabled:text-gray-600 disabled:shadow-none disabled:cursor-not-allowed"
          : "text-gray-800 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-gray-200 hover:bg-gray-50 active:bg-gray-100 disabled:bg-gray-50 disabled:border-gray-200 disabled:text-gray-300 disabled:shadow-none disabled:cursor-not-allowed"
      )}
    >
      {children}
    </motion.button>
  );
}

