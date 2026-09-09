"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { signInWithCustomToken, updateProfile } from "firebase/auth";
import { useAuth, useUser } from "@/firebase";
import { motion, AnimatePresence, useAnimation, useReducedMotion } from "motion/react";
import { Delete, Check, AlertCircle, ExternalLink, Sun, Moon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ScreenState = "pin" | "verifying" | "success" | "exiting";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [screenState, setScreenState] = useState<ScreenState>("pin");
  const [isDark, setIsDark] = useState<boolean>(true);

  const controls = useAnimation();
  const shouldReduceMotion = useReducedMotion();
  const router = useRouter();
  const auth = useAuth();
  const { user } = useUser();
  const { toast } = useToast();

  const isNavigatingRef = useRef(false);

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

  // Real backend verification + Firebase login with buttery-smooth timing
  const verifyAndAuthenticate = useCallback(
    async (pinToVerify: string) => {
      setScreenState("verifying");
      setError("");
      setAuthError(null);

      const startTime = Date.now();

      try {
        // Run network verification and prefetch concurrently
        const verifyPromise = fetch("/api/verify-pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: pinToVerify }),
        });

        const res = await verifyPromise;
        if (!res.ok) {
          throw new Error("Server error: Unable to verify PIN at this time.");
        }

        const data = await res.json();

        // Enforce minimum convergence animation time (450ms) so the pill pulse is fluid
        const elapsed = Date.now() - startTime;
        const minAnimationWait = shouldReduceMotion ? 100 : 450;
        if (elapsed < minAnimationWait) {
          await new Promise((resolve) => setTimeout(resolve, minAnimationWait - elapsed));
        }

        if (!data.valid) {
          setError("Incorrect PIN. Try again.");
          controls.start({
            x: [-8, 8, -6, 6, -4, 4, 0],
            transition: { duration: 0.4, ease: "easeInOut" },
          });
          setPin("");
          setScreenState("pin");
          return;
        }

        // Trigger gentle haptic vibration if supported on mobile devices
        if (typeof window !== "undefined" && window.navigator?.vibrate) {
          try {
            window.navigator.vibrate([30, 40, 30]);
          } catch {}
        }

        // Authenticate with Firebase using resolved identity & server-minted custom token
        const identity: string = data.identity || "nabin";
        const displayName = identity === "nabin" ? "Nabin" : "Karu";
        const photoURL = identity === "nabin" ? "/avatars/nabin.png" : "/avatars/karu.png";

        if (!data.customToken) {
          throw new Error("Failed to obtain secure authentication token from server.");
        }

        // Firebase sign-in with role-gated custom token & update profile
        const userCredential = await signInWithCustomToken(auth, data.customToken);
        await updateProfile(userCredential.user, { displayName, photoURL });
        localStorage.setItem("duonexus_role", identity);

        // Transition to success state (turns green pill, shows checkmark)
        setScreenState("success");

        // Hold success state for natural human perception, then initiate smooth exit
        setTimeout(() => {
          setScreenState("exiting");
        }, shouldReduceMotion ? 350 : 800);
      } catch (err: any) {
        console.error("Authentication Error:", err);
        setPin("");
        setScreenState("pin");

        setAuthError(err?.message || "An unexpected error occurred during login.");

        toast({
          variant: "destructive",
          title: "Login Failed",
          description: err?.message || "Please check your network connection and try again.",
        });
      }
    },
    [auth, controls, shouldReduceMotion, toast]
  );

  // Navigate cleanly when exit transition plays
  useEffect(() => {
    if (screenState === "exiting" && !isNavigatingRef.current) {
      isNavigatingRef.current = true;
      const t = setTimeout(() => {
        router.push("/chat");
      }, shouldReduceMotion ? 80 : 380);
      return () => clearTimeout(t);
    }
  }, [screenState, router, shouldReduceMotion]);

  // Input handling
  const handleInput = useCallback(
    (value: string) => {
      if (screenState !== "pin") return;

      if (value === "backspace") {
        setPin((prev) => prev.slice(0, -1));
        setError("");
        setAuthError(null);
        return;
      }

      if (pin.length < 4) {
        const newPin = pin + value;
        setPin(newPin);
        setError("");
        setAuthError(null);

        if (newPin.length === 4) {
          verifyAndAuthenticate(newPin);
        }
      }
    },
    [pin, screenState, verifyAndAuthenticate]
  );

  // Global physical keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleInput(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleInput("backspace");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleInput]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 26 } },
  };

  const merged = screenState === "verifying" || screenState === "success" || screenState === "exiting";
  const isSuccess = screenState === "success" || screenState === "exiting";

  return (
    <div
      className={cn(
        "min-h-[100dvh] w-full overflow-y-auto flex flex-col items-center justify-center font-sans antialiased transition-colors duration-300 relative select-none py-8",
        isDark ? "bg-[#0C0C0C] text-gray-100 selection:bg-gray-800" : "bg-[#F8FAFC] text-gray-900 selection:bg-rose-100"
      )}
      style={{
        paddingTop: "max(2rem, env(safe-area-inset-top))",
        paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      {/* Top Floating Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          className={cn(
            "p-2.5 rounded-full transition-all active:scale-90 cursor-pointer shadow-sm border",
            isDark
              ? "bg-[#181818] border-white/10 text-amber-400 hover:bg-[#222]"
              : "bg-white border-gray-200 text-amber-500 hover:bg-gray-100 shadow-md"
          )}
          title={isDark ? "Switch to Bright Mode" : "Switch to Dark Mode"}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5 text-indigo-600" />}
        </button>
      </div>

      {/* Main Animated Card */}
      <AnimatePresence mode="wait">
        {screenState !== "exiting" && (
          <motion.div
            key="screen"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.95, y: -16 }
            }
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[420px] mx-auto flex flex-col items-center px-4 will-change-transform my-auto"
          >
            <motion.div
              initial="hidden"
              animate="visible"
              variants={containerVariants}
              className="w-full flex flex-col items-center"
            >
              {/* Hero Character Avatar */}
              <motion.div variants={itemVariants} className="mb-4 sm:mb-6 relative shrink-0">
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
                    "relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-full overflow-hidden p-1 transition-colors duration-300 border",
                    isDark
                      ? "bg-[#151515] shadow-[0_8px_32px_rgba(0,0,0,0.6)] border-white/10"
                      : "bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] border-gray-200"
                  )}
                >
                  <img
                    src="/images/hero_character_1788746411651.jpg"
                    alt="Welcome Character"
                    className="w-full h-full object-cover rounded-full pointer-events-none"
                    draggable={false}
                  />
                </div>
              </motion.div>

              {/* Title & Subtext */}
              <motion.div
                variants={itemVariants}
                className="text-center mb-4 sm:mb-7 min-h-[82px] sm:min-h-[92px] flex flex-col items-center justify-end relative shrink-0 px-2"
              >
                <AnimatePresence mode="wait">
                  {isSuccess ? (
                    <motion.h1
                      key="success-title"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className={cn(
                        "text-3xl sm:text-[34px] leading-tight font-bold tracking-tight",
                        isDark ? "text-white" : "text-gray-900"
                      )}
                    >
                      Verified successfully
                    </motion.h1>
                  ) : (
                    <motion.h1
                      key="welcome-title"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className={cn(
                        "text-3xl sm:text-[34px] leading-tight font-bold tracking-tight",
                        isDark ? "text-white" : "text-gray-900"
                      )}
                    >
                      Welcome Back
                      <br />
                      to DuoNexus
                    </motion.h1>
                  )}
                </AnimatePresence>

                <div className="h-2 sm:h-3" />

                <AnimatePresence mode="wait">
                  {screenState === "pin" && (
                    <motion.p
                      key="subtext"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        "text-[14px] sm:text-base font-medium",
                        isDark ? "text-gray-400" : "text-gray-500"
                      )}
                    >
                      Enter your 4-digit PIN to continue.
                    </motion.p>
                  )}
                  {screenState === "verifying" && (
                    <motion.p
                      key="verifying-subtext"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        "text-[14px] sm:text-base font-medium",
                        isDark ? "text-gray-400" : "text-gray-500"
                      )}
                    >
                      Verifying...
                    </motion.p>
                  )}
                  {isSuccess && (
                    <motion.p
                      key="success-subtext"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      className="text-[14px] sm:text-base text-emerald-500 font-medium"
                    >
                      Entering your private space...
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Action Required Alert (if Firebase anonymous is not enabled) */}
              {authError && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full mb-4"
                >
                  <Alert variant="destructive" className="border-red-500/30 bg-red-500/10 text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-xs uppercase tracking-widest font-semibold">
                      Action Required
                    </AlertTitle>
                    <AlertDescription className="text-xs mt-1 leading-relaxed">
                      {authError}
                      <div className="mt-2.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-7 text-[10px] gap-1 border-red-700 text-red-600 hover:bg-red-50",
                            isDark ? "bg-black/30 text-red-200 hover:bg-red-950" : "bg-white"
                          )}
                          onClick={() =>
                            window.open(
                              "https://console.firebase.google.com/u/0/project/our-sweet-conversation/authentication/providers",
                              "_blank"
                            )
                          }
                        >
                          <ExternalLink className="w-3 h-3" /> Open Firebase Console
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}

              {/* PIN Row / Merge Zone */}
              <motion.div
                variants={itemVariants}
                className="w-full mb-5 sm:mb-8 relative flex flex-col items-center shrink-0"
              >
                <div className="relative flex justify-center items-center w-full h-[60px] sm:h-[68px] [--box:52px] sm:[--box:64px] [--gap:0.75rem] sm:[--gap:1rem]">
                  {/* The 4 boxes converge to center + shrink using GPU transforms */}
                  <div className="flex justify-center items-center" style={{ gap: "var(--gap)" }}>
                    {[0, 1, 2, 3].map((index) => {
                      const isActive = pin.length === index && screenState === "pin";
                      const isFilled = pin.length > index;
                      const offsetSteps = index - 1.5;
                      const translateX = merged
                        ? `calc(${-offsetSteps} * (var(--box) + var(--gap)))`
                        : "0px";

                      return (
                        <motion.div
                          key={index}
                          animate={controls}
                          className="rounded-2xl flex items-center justify-center will-change-transform"
                          style={{
                            width: "var(--box)",
                            height: "var(--box)",
                            transform: `translateX(${translateX}) scale(${merged ? 0.35 : 1})`,
                            opacity: merged ? 0 : 1,
                            transition: shouldReduceMotion
                              ? "opacity 180ms ease"
                              : "transform 380ms cubic-bezier(0.4,0,0.2,1), opacity 320ms cubic-bezier(0.4,0,0.2,1)",
                          }}
                        >
                          <div
                            className={cn(
                              "w-full h-full rounded-2xl flex items-center justify-center border transition-all duration-200",
                              isDark
                                ? isActive
                                  ? "border-gray-500 bg-[#1A1A1A] shadow-[0_0_0_4px_rgba(255,255,255,0.06)]"
                                  : isFilled
                                  ? "border-white/15 bg-[#1E1E1E] shadow-sm"
                                  : "border-white/10 bg-white/5"
                                : isActive
                                ? "border-gray-900 bg-white shadow-[0_0_0_4px_rgba(0,0,0,0.06)] ring-1 ring-gray-900/10"
                                : isFilled
                                ? "border-gray-300 bg-white shadow-xs"
                                : "border-gray-200 bg-gray-50/80",
                              error && isActive && "border-red-500/50 shadow-[0_0_0_4px_rgba(239,68,68,0.15)]"
                            )}
                          >
                            {isFilled && (
                              <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 450, damping: 25 }}
                                className={cn(
                                  "w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full",
                                  isDark ? "bg-white" : "bg-gray-900"
                                )}
                              />
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Merged pill — pulses while verifying, then morphs into emerald green with checkmark */}
                  <div
                    className="absolute rounded-2xl border flex items-center justify-center pointer-events-none will-change-transform"
                    style={{
                      width: "var(--box)",
                      height: "var(--box)",
                      transform: `scale(${merged ? 1 : 0.3})`,
                      opacity: merged ? 1 : 0,
                      borderColor: isSuccess ? "rgb(16,185,129)" : isDark ? "rgb(156,163,175)" : "rgb(209,213,219)",
                      backgroundColor: isSuccess ? (isDark ? "#101915" : "#ECFDF5") : (isDark ? "#17171a" : "#FFFFFF"),
                      transition: shouldReduceMotion
                        ? "opacity 180ms ease, background-color 300ms ease, border-color 300ms ease"
                        : "transform 380ms cubic-bezier(0.4,0,0.2,1) 60ms, opacity 320ms ease 60ms, background-color 300ms ease, border-color 300ms ease",
                      boxShadow: !merged
                        ? "0 0 0 0px rgba(16,185,129,0)"
                        : isSuccess
                        ? "0 0 0 4px rgba(16,185,129,0.2), 0 0 35px 12px rgba(16,185,129,0.35)"
                        : isDark
                        ? "0 0 0 4px rgba(156,163,175,0.15), 0 0 24px 8px rgba(156,163,175,0.25)"
                        : "0 0 0 4px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.1)",
                    }}
                  >
                    {screenState === "verifying" && (
                      <motion.div
                        animate={shouldReduceMotion ? {} : { scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
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
                          initial={{ scale: 0, opacity: 0, rotate: -45 }}
                          animate={{ scale: 1, opacity: 1, rotate: 0 }}
                          transition={{ type: "spring", stiffness: 420, damping: 22 }}
                        >
                          <Check className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-500" strokeWidth={3} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Error message text */}
                <div className="h-5 sm:h-6 mt-3 sm:mt-4 flex items-center justify-center">
                  {error && screenState === "pin" && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm font-medium text-red-500"
                    >
                      {error}
                    </motion.p>
                  )}
                </div>
              </motion.div>

              {/* Numeric Keypad */}
              <AnimatePresence>
                {screenState === "pin" && (
                  <motion.div
                    variants={itemVariants}
                    exit={{ opacity: 0, y: 10, transition: { duration: 0.2 } }}
                    className="w-full max-w-[280px] sm:max-w-[320px] mx-auto grid grid-cols-3 gap-y-2.5 sm:gap-y-3 gap-x-4 sm:gap-x-5 shrink-0"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <KeypadButton key={num} onClick={() => handleInput(num.toString())} isDark={isDark}>
                        {num}
                      </KeypadButton>
                    ))}
                    <div className="pointer-events-none" />
                    <KeypadButton onClick={() => handleInput("0")} isDark={isDark}>0</KeypadButton>
                    <KeypadButton
                      onClick={() => handleInput("backspace")}
                      disabled={pin.length === 0}
                      isDark={isDark}
                    >
                      <Delete className={cn("w-6 h-6 stroke-[2]", isDark ? "text-gray-400" : "text-gray-600")} />
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
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  isDark?: boolean;
}) {
  return (
    <motion.button
      type="button"
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.94 } : {}}
      onClick={onClick}
      disabled={disabled}
      aria-label={typeof children === "string" ? `Digit ${children}` : "Delete"}
      className={cn(
        "h-[56px] sm:h-[60px] shrink-0 flex items-center justify-center text-[24px] sm:text-[28px] font-medium rounded-2xl transition-all duration-150 select-none touch-manipulation cursor-pointer focus:outline-none border disabled:opacity-40 disabled:cursor-not-allowed",
        isDark
          ? "text-gray-100 bg-[#151515] shadow-[0_1px_3px_rgba(0,0,0,0.4)] border-white/5 hover:bg-[#1E1E1E] active:bg-[#252525]"
          : "text-gray-800 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] border-gray-200 hover:bg-gray-50 active:bg-gray-100 hover:shadow-md"
      )}
    >
      {children}
    </motion.button>
  );
}
