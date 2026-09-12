"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  Fragment,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Flame,
  Heart,
  Trophy,
  Check,
  Clock,
  Gift,
  Lock,
  Unlock,
  AlertTriangle,
  Copy,
  ChevronRight,
  PartyPopper,
  X,
  Shield,
  Star,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StreakModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  streak: number;
  longestStreak: number;
  chattedToday: boolean;
  isStreakLoaded?: boolean;
  partnerName: string;
  onUpdateStreak?: (newStreak: number) => Promise<void>;
  onStartChat?: () => void;
  onClaimReward?: (surprise: SurpriseMilestone) => Promise<void> | void;
}

// ─── Data (unchanged) ─────────────────────────────────────────────────────────

const STREAK_TIERS = [
  {
    min: 100,
    name: "Century Legends",
    level: "Level 7 · Prismatic Flame",
    gradient: "from-fuchsia-500 via-pink-500 to-amber-400",
    shadow: "shadow-fuchsia-500/40",
    flameColor: "text-amber-100 fill-amber-100",
    badgeClass: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30",
    accentHsl: "270 80% 60%",
  },
  {
    min: 50,
    name: "Golden Phoenix",
    level: "Level 6 · Royal Fire",
    gradient: "from-amber-400 via-orange-500 to-yellow-300",
    shadow: "shadow-yellow-500/40",
    flameColor: "text-yellow-100 fill-yellow-100",
    badgeClass: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    accentHsl: "38 95% 55%",
  },
  {
    min: 30,
    name: "Diamond Inferno",
    level: "Level 5 · Electric Ice Fire",
    gradient: "from-cyan-400 via-blue-500 to-indigo-500",
    shadow: "shadow-cyan-500/40",
    flameColor: "text-cyan-100 fill-cyan-100",
    badgeClass: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    accentHsl: "195 85% 55%",
  },
  {
    min: 15,
    name: "Cosmic Supernova",
    level: "Level 4 · Romantic Plasma",
    gradient: "from-rose-500 via-purple-500 to-pink-500",
    shadow: "shadow-pink-500/40",
    flameColor: "text-pink-100 fill-pink-100",
    badgeClass: "bg-pink-500/20 text-pink-300 border-pink-500/30",
    accentHsl: "330 80% 60%",
  },
  {
    min: 7,
    name: "Blazing Duo",
    level: "Level 3 · Voltage Flame",
    gradient: "from-violet-500 via-orange-500 to-amber-400",
    shadow: "shadow-violet-500/40",
    flameColor: "text-amber-100 fill-amber-100",
    badgeClass: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    accentHsl: "265 70% 62%",
  },
  {
    min: 3,
    name: "Flame Keepers",
    level: "Level 2 · Ignited Spark",
    gradient: "from-orange-500 via-amber-500 to-rose-500",
    shadow: "shadow-orange-500/40",
    flameColor: "text-yellow-200 fill-yellow-200",
    badgeClass: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    accentHsl: "25 90% 58%",
  },
  {
    min: 1,
    name: "Spark Beginnings",
    level: "Level 1 · Awakening",
    gradient: "from-amber-400 via-orange-400 to-rose-400",
    shadow: "shadow-amber-500/30",
    flameColor: "text-white fill-white",
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    accentHsl: "32 95% 58%",
  },
];

interface SurpriseMilestone {
  days: number;
  title: string;
  tag: string;
  icon: string;
  rewardTitle: string;
  rewardDescription: string;
  rewardVoucher: string;
}

const SURPRISES: SurpriseMilestone[] = [
  {
    days: 3,
    title: "Secret Love Capsule",
    tag: "Love Note",
    icon: "💌",
    rewardTitle: "Secret Love Note Unlocked! 💌",
    rewardDescription:
      "A sweet truth for both of you: 'Every single message from you makes the whole day better. You are my favorite notification and my dearest person in the world!'",
    rewardVoucher: "DUO-LOVE-DAY3",
  },
  {
    days: 7,
    title: "Late-Night Treat Pass",
    tag: "Food Voucher",
    icon: "🍦",
    rewardTitle: "Free Late-Night Treat Voucher! 🍦",
    rewardDescription:
      "Redeem 1 Free late-night snack, boba, ice cream or dessert delivered or prepared with love by your partner whenever you desire!",
    rewardVoucher: "DUO-TREAT-DAY7",
  },
  {
    days: 15,
    title: "Movie & Cuddle Authority",
    tag: "Fun Pass",
    icon: "🎬",
    rewardTitle: "Movie Choice & Cuddle Pass! 🎬",
    rewardDescription:
      "Complete authority to choose any movie or series to watch together without dispute, accompanied by unlimited warm hugs and snacks!",
    rewardVoucher: "DUO-MOVIE-DAY15",
  },
  {
    days: 30,
    title: "Royal Pamper & Zero Chores",
    tag: "VIP Pass",
    icon: "💆‍♀️",
    rewardTitle: "Royal Pamper Day Pass! 💆‍♀️",
    rewardDescription:
      "Redeem a relaxing 30-minute massage, your favorite home meal, and immunity from all chores for an entire day of pure pampering!",
    rewardVoucher: "DUO-PAMPER-DAY30",
  },
  {
    days: 50,
    title: "Golden Genie Wish",
    tag: "Special Wish",
    icon: "🧞‍♂️",
    rewardTitle: "Unconditional Couple Wish! 🧞‍♂️",
    rewardDescription:
      "One free unconditional wish! Whatever you request from your partner (a surprise date, a sweet gift, or a cute favor) must be happily granted!",
    rewardVoucher: "DUO-WISH-DAY50",
  },
  {
    days: 100,
    title: "Dream Weekend Trip Ticket",
    tag: "Legendary",
    icon: "✈️",
    rewardTitle: "Century Soulmates Getaway Ticket! ✈️",
    rewardDescription:
      "Official Century Soulmates Honor 🏆! You both earn a commitment to plan and go on an unforgettable weekend vacation or romantic road trip together!",
    rewardVoucher: "DUO-CENTURY-DAY100",
  },
];

// ─── Reward row sub-component ─────────────────────────────────────────────────

function RewardRow({
  surprise,
  streak,
  claimedCodes,
  index,
  onOpen,
}: {
  surprise: SurpriseMilestone;
  streak: number;
  claimedCodes: string[];
  index: number;
  onOpen: (s: SurpriseMilestone) => void;
}) {
  const isUnlocked = streak >= surprise.days;
  const isClaimed = claimedCodes.includes(surprise.rewardVoucher);

  return (
    <div
      style={{ animationDelay: `${0.32 + index * 0.045}s` }}
      role={isUnlocked ? "button" : undefined}
      tabIndex={isUnlocked ? 0 : undefined}
      aria-label={
        isUnlocked
          ? `Open reward: ${surprise.title}`
          : `Locked: ${surprise.title}, requires ${surprise.days} day streak`
      }
      onClick={() => isUnlocked && onOpen(surprise)}
      onKeyDown={(e) => {
        if (isUnlocked && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen(surprise);
        }
      }}
      className={cn(
        "reward-row-in flex items-center gap-3 px-3.5 py-3 rounded-2xl border transition-all duration-200 min-h-[64px]",
        isUnlocked
          ? isClaimed
            ? "bg-emerald-500/8 border-emerald-500/20 cursor-pointer hover:bg-emerald-500/12 active:scale-[0.98]"
            : "bg-gradient-to-r from-primary/8 via-orange-500/6 to-amber-500/6 border-primary/20 cursor-pointer hover:border-primary/40 hover:bg-primary/12 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          : "bg-muted/20 border-border/30 opacity-55 cursor-not-allowed"
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0",
          isUnlocked
            ? isClaimed
              ? "bg-emerald-500/15 border border-emerald-500/25"
              : "bg-gradient-to-tr from-primary/80 to-orange-500/80"
            : "bg-muted/60 border border-border/40"
        )}
      >
        {isUnlocked ? (
          <span className="leading-none">{surprise.icon}</span>
        ) : (
          <Lock className="w-4 h-4 text-muted-foreground/60" />
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-bold text-foreground leading-tight truncate">
          Day {surprise.days}: {surprise.title}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {isUnlocked
            ? isClaimed
              ? "Reward claimed ✓"
              : "Tap to open your surprise"
            : `Reach a ${surprise.days}-day streak to unlock`}
        </div>
      </div>

      {/* Status badge */}
      <div className="shrink-0 ml-1">
        {isUnlocked ? (
          isClaimed ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-1 rounded-full">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
              Claimed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-primary text-primary-foreground px-2.5 py-1 rounded-full shadow-sm shadow-primary/20">
              <Unlock className="w-2.5 h-2.5" />
              Open
            </span>
          )
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/70 bg-muted/50 px-2 py-1 rounded-full">
            <Lock className="w-2.5 h-2.5" />
            {surprise.days}d
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Reward detail popup ───────────────────────────────────────────────────────

function RewardPopup({
  surprise,
  claimedCodes,
  copiedCode,
  onCopy,
  onClaim,
  onClose,
}: {
  surprise: SurpriseMilestone;
  claimedCodes: string[];
  copiedCode: boolean;
  onCopy: (code: string) => void;
  onClaim: (s: SurpriseMilestone) => void;
  onClose: () => void;
}) {
  const isClaimed = claimedCodes.includes(surprise.rewardVoucher);

  // Trap focus inside popup
  const popupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const first = popupRef.current?.querySelector<HTMLElement>(
      "button, [tabindex]:not([tabindex='-1'])"
    );
    first?.focus();
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Popup card */}
      <motion.div
        ref={popupRef}
        role="dialog"
        aria-modal="true"
        aria-label={surprise.rewardTitle}
        className="relative z-10 w-full max-w-sm mx-3 mb-6 sm:mb-0 bg-background border border-border/60 rounded-3xl shadow-2xl overflow-hidden"
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        {/* Header gradient strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-orange-500 to-amber-400" />

        <div className="p-6 text-center space-y-4">
          {/* Icon */}
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-primary via-rose-500 to-amber-400 flex items-center justify-center text-3xl shadow-lg shadow-primary/25">
            {surprise.icon}
          </div>

          {/* Title */}
          <div>
            <h3 className="text-lg font-black font-headline text-foreground leading-tight">
              {surprise.rewardTitle}
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary/80 bg-primary/10 px-2 py-0.5 rounded-full mt-1.5 inline-block">
              {surprise.tag}
            </span>
          </div>

          {/* Description */}
          <p className="text-xs text-foreground/80 leading-relaxed bg-muted/40 p-3.5 rounded-2xl border border-border/50 text-left font-medium">
            {surprise.rewardDescription}
          </p>

          {/* Voucher */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/40">
            <div className="text-left">
              <div className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">
                Official Couple Voucher
              </div>
              <div className="text-xs font-mono font-bold text-primary tracking-wider mt-0.5">
                {surprise.rewardVoucher}
              </div>
            </div>
            <button
              onClick={() => onCopy(surprise.rewardVoucher)}
              className="h-8 px-3 text-[11px] font-bold rounded-lg flex items-center gap-1.5 bg-background border border-border/60 hover:bg-primary/10 hover:border-primary/30 transition-all active:scale-95"
              aria-label="Copy voucher code"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-500">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Copy</span>
                </>
              )}
            </button>
          </div>

          {/* CTA */}
          <button
            onClick={() => onClaim(surprise)}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-primary via-rose-500 to-purple-600 text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25 flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
          >
            <PartyPopper className="w-4 h-4" />
            {isClaimed ? "Send to Chat Again 💬" : "Claim & Send to Chat 🥳"}
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Maybe later
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main StreakModal ─────────────────────────────────────────────────────────

export function StreakModal({
  open,
  onOpenChange,
  streak,
  longestStreak,
  chattedToday,
  isStreakLoaded = true,
  partnerName,
  onStartChat,
  onClaimReward,
}: StreakModalProps) {
  const [selectedSurprise, setSelectedSurprise] =
    useState<SurpriseMilestone | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number }>(
    { hours: 0, minutes: 0 }
  );
  const [claimedCodes, setClaimedCodes] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        return JSON.parse(
          localStorage.getItem("duonexus_claimed_vouchers") || "[]"
        );
      } catch {}
    }
    return [];
  });

  // Progress bar animated value (fills once on open)
  const [animatedProgress, setAnimatedProgress] = useState(0);

  // Detect mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Portal mount point
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.classList.add("streak-modal-open");
    } else {
      document.body.classList.remove("streak-modal-open");
    }
    return () => {
      document.body.classList.remove("streak-modal-open");
    };
  }, [open]);

  // Reset state on close/reopen
  useEffect(() => {
    if (!open) {
      setSelectedSurprise(null);
      setCopiedCode(false);
      setAnimatedProgress(0);
    }
  }, [open]);

  // Trigger progress animation shortly after open
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setAnimatedProgress(progressPercent);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Countdown timer (existing logic — 60s interval, efficient)
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(23, 59, 59, 999);
      const diffMs = Math.max(0, midnight.getTime() - now.getTime());
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft({ hours, minutes });
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 60000);
    return () => clearInterval(timer);
  }, []);

  // ESC close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !selectedSurprise) onOpenChange(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange, selectedSurprise]);

  // Focus trap inside modal
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const el = modalRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      "button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])"
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    el.addEventListener("keydown", trap);
    // Focus first element after animation
    const t = setTimeout(() => first?.focus(), 220);
    return () => {
      el.removeEventListener("keydown", trap);
      clearTimeout(t);
    };
  }, [open]);

  // Computed values (all existing logic)
  const currentTier = useMemo(() => {
    return (
      STREAK_TIERS.find((t) => streak >= t.min) ||
      STREAK_TIERS[STREAK_TIERS.length - 1]
    );
  }, [streak]);

  const nextMilestone = useMemo(() => {
    return (
      SURPRISES.find((m) => m.days > streak) || SURPRISES[SURPRISES.length - 1]
    );
  }, [streak]);

  const prevMilestoneDays = useMemo(() => {
    return [...SURPRISES].reverse().find((m) => m.days <= streak)?.days || 0;
  }, [streak]);

  const progressPercent = useMemo(() => {
    if (streak >= nextMilestone.days) return 100;
    const range = nextMilestone.days - prevMilestoneDays;
    if (range <= 0) return 100;
    return Math.min(
      100,
      Math.max(5, Math.round(((streak - prevMilestoneDays) / range) * 100))
    );
  }, [streak, nextMilestone, prevMilestoneDays]);

  // Update animated progress when progressPercent changes while open
  useEffect(() => {
    if (open) {
      setAnimatedProgress(progressPercent);
    }
  }, [progressPercent, open]);

  // Urgency level for danger state
  const isUrgent =
    !chattedToday && timeLeft.hours === 0 && timeLeft.minutes < 30;
  const isCritical =
    !chattedToday && timeLeft.hours === 0 && timeLeft.minutes < 10;

  const handleClaimReward = async (surprise: SurpriseMilestone) => {
    const updated = Array.from(
      new Set([...claimedCodes, surprise.rewardVoucher])
    );
    setClaimedCodes(updated);
    try {
      localStorage.setItem(
        "duonexus_claimed_vouchers",
        JSON.stringify(updated)
      );
    } catch {}
    if (onClaimReward) await onClaimReward(surprise);
    setSelectedSurprise(null);
    onOpenChange(false);
    onStartChat?.();
  };

  const handleCopyVoucher = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Swipe-to-dismiss (mobile only)
  const dragY = useMotionValue(0);
  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (info.offset.y > 80 || info.velocity.y > 400) {
        onOpenChange(false);
      } else {
        dragY.set(0);
      }
    },
    [onOpenChange, dragY]
  );

  if (!mounted) return null;

  // ─── Animation variants ──────────────────────────────────────────────────

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const sheetVariants = isMobile
    ? {
        hidden: { y: "100%", opacity: 0.6 },
        visible: {
          y: 0,
          opacity: 1,
          transition: { type: "spring" as const, stiffness: 380, damping: 36, mass: 0.8 },
        },
        exit: {
          y: "100%",
          opacity: 0,
          transition: { duration: 0.18, ease: "easeIn" as const },
        },
      }
    : {
        hidden: { scale: 0.93, opacity: 0, y: 12 },
        visible: {
          scale: 1,
          opacity: 1,
          y: 0,
          transition: { type: "spring" as const, stiffness: 420, damping: 35 },
        },
        exit: {
          scale: 0.95,
          opacity: 0,
          y: 8,
          transition: { duration: 0.14, ease: "easeIn" as const },
        },
      };

  const stagger = (delay: number) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.22, delay, ease: "easeOut" as const },
  });

  // ─── Modal content ───────────────────────────────────────────────────────

  const modalContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          aria-hidden={!open}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.18 }}
            onClick={() => !selectedSurprise && onOpenChange(false)}
            aria-hidden="true"
          />

          {/* Sheet / Modal */}
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Streak & Rewards — ${streak} Days Strong`}
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            drag={isMobile ? "y" : false}
            dragConstraints={{ top: 0 }}
            dragElastic={0.12}
            dragListener={false}
            onDragEnd={handleDragEnd}
            style={isMobile ? { y: dragY, touchAction: "none" } : undefined}
            className={cn(
              "relative z-10 w-full bg-background flex flex-col gpu-layer overflow-hidden",
              isMobile
                ? "rounded-t-[28px] max-h-[90dvh]"
                : "max-w-[440px] rounded-3xl max-h-[88vh] mx-4 shadow-2xl border border-border/40"
            )}
          >
            {/* Tier ambient glow — subtle, not excessive */}
            <div
              className={cn(
                "absolute top-0 left-1/2 -translate-x-1/2 w-80 h-28 blur-3xl rounded-full pointer-events-none opacity-25 bg-gradient-to-r",
                currentTier.gradient
              )}
              aria-hidden="true"
            />

            {/* ── HANDLE + CLOSE ────────────────────────────────────────────── */}
            <div
              className={cn(
                "relative shrink-0 pt-3 pb-2 px-4 flex items-center",
                isMobile ? "justify-between" : "justify-end"
              )}
            >
              {/* Drag handle (mobile only) */}
              {isMobile && (
                <motion.div
                  className="sheet-handle absolute left-1/2 top-3 -translate-x-1/2 cursor-grab active:cursor-grabbing"
                  onPointerDown={(e) => {
                    if (!isMobile) return;
                    // Allow dragging from handle
                    const motionEl = modalRef.current;
                    if (!motionEl) return;
                  }}
                  drag="y"
                  dragConstraints={{ top: 0 }}
                  dragElastic={0.12}
                  onDragEnd={handleDragEnd}
                  style={{ y: dragY }}
                />
              )}

              {/* Close button — 44px touch target */}
              <button
                onClick={() => onOpenChange(false)}
                aria-label="Close streak panel"
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center",
                  "bg-muted/60 hover:bg-muted border border-border/40",
                  "transition-all active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "ml-auto" // always push to right
                )}
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* ── HEADER ───────────────────────────────────────────────────── */}
            <div className="shrink-0 px-5 pb-4 text-center space-y-3">
              {/* Flame icon */}
              <motion.div
                className="relative inline-flex mx-auto"
                {...stagger(0.08)}
              >
                <div
                  className={cn(
                    "w-[72px] h-[72px] rounded-[22px] bg-gradient-to-tr flex items-center justify-center shadow-xl",
                    currentTier.gradient,
                    currentTier.shadow
                  )}
                >
                  <Flame
                    className={cn(
                      "w-10 h-10 drop-shadow-sm animate-breath",
                      currentTier.flameColor
                    )}
                  />
                </div>
                {/* Heart accent */}
                <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-background border-2 border-background flex items-center justify-center shadow">
                  <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                </div>
              </motion.div>

              {/* Streak number — dominant typographic element */}
              <motion.div {...stagger(0.14)}>
                <div className="flex items-baseline justify-center gap-2">
                  {isStreakLoaded ? (
                    <span className="text-[52px] sm:text-[60px] font-black font-headline text-foreground leading-none tracking-tighter animate-number-pop">
                      {streak}
                    </span>
                  ) : (
                    <span className="w-24 h-14 bg-muted animate-pulse rounded-xl inline-block" />
                  )}
                  <div className="text-left">
                    <div className="text-base font-bold text-foreground/90 leading-tight">
                      Days
                    </div>
                    <div className="text-sm font-semibold text-orange-400 leading-tight">
                      Strong 🔥
                    </div>
                  </div>
                </div>

                {/* Tier badge */}
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span
                    className={cn(
                      "text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full border",
                      currentTier.badgeClass
                    )}
                  >
                    {currentTier.name}
                  </span>
                </div>

                {/* Subtitle */}
                <p className="text-xs text-muted-foreground mt-1.5">
                  {currentTier.level} ·{" "}
                  <span className="font-semibold text-foreground/70">
                    {partnerName}
                  </span>
                </p>
              </motion.div>
            </div>

            {/* ── SCROLLABLE BODY ────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto streak-scroll min-h-0 px-4 space-y-3 pb-4">

              {/* ALERT: Streak status */}
              <motion.div {...stagger(0.20)}>
                <div
                  className={cn(
                    "rounded-2xl border p-3.5 transition-colors",
                    chattedToday
                      ? "bg-emerald-500/10 border-emerald-500/25"
                      : isCritical
                      ? "bg-red-500/10 border-red-500/30"
                      : isUrgent
                      ? "bg-amber-500/12 border-amber-500/35"
                      : "bg-amber-500/8 border-amber-500/20"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Status icon */}
                    <div
                      className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                        chattedToday
                          ? "bg-emerald-500/20"
                          : isCritical
                          ? "bg-red-500/20"
                          : "bg-amber-500/20"
                      )}
                    >
                      {chattedToday ? (
                        <Shield
                          className="w-5 h-5 text-emerald-400"
                          strokeWidth={2.5}
                        />
                      ) : (
                        <Clock
                          className={cn(
                            "w-5 h-5",
                            isCritical
                              ? "text-red-400 animate-countdown-pulse"
                              : isUrgent
                              ? "text-amber-400 animate-countdown-pulse"
                              : "text-amber-400"
                          )}
                          strokeWidth={2.5}
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span
                          className={cn(
                            "text-[12px] font-bold leading-tight",
                            chattedToday
                              ? "text-emerald-400"
                              : isCritical
                              ? "text-red-400"
                              : "text-amber-400"
                          )}
                        >
                          {chattedToday
                            ? "Streak Secured Today"
                            : "Streak In Danger"}
                        </span>
                        {/* Live countdown — from existing timeLeft state */}
                        {!chattedToday && (
                          <span
                            className={cn(
                              "text-[11px] font-black font-mono px-2 py-0.5 rounded-full shrink-0",
                              isCritical
                                ? "bg-red-500/20 text-red-300"
                                : "bg-amber-500/20 text-amber-300"
                            )}
                          >
                            {timeLeft.hours}h {timeLeft.minutes}m left
                          </span>
                        )}
                      </div>
                      <p
                        className={cn(
                          "text-[11px] mt-1 leading-snug",
                          chattedToday
                            ? "text-emerald-300/80"
                            : "text-amber-300/80"
                        )}
                      >
                        {chattedToday
                          ? `You both connected today! Your flame is safe. Keep it going tomorrow.`
                          : `Send a message to ${partnerName} before midnight to keep your streak alive.`}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* STATS: Record + Today's Status */}
              <motion.div
                {...stagger(0.25)}
                className="grid grid-cols-2 gap-2"
              >
                <div className="p-3 rounded-2xl bg-muted/25 border border-border/30 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Trophy className="w-3 h-3 text-amber-500" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      Record
                    </span>
                  </div>
                  <span className="text-lg font-black font-headline text-foreground">
                    {Math.max(streak, longestStreak)}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    days 🏆
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-muted/25 border border-border/30 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {chattedToday ? (
                      <Shield className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Clock className="w-3 h-3 text-amber-400" />
                    )}
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      Today
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-black font-headline",
                      chattedToday ? "text-emerald-400" : "text-amber-400"
                    )}
                  >
                    {chattedToday ? "Secured" : "Pending"}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] block",
                      chattedToday
                        ? "text-emerald-400/70"
                        : "text-amber-400/70"
                    )}
                  >
                    {chattedToday ? "✓ Safe" : "Chat required"}
                  </span>
                </div>
              </motion.div>

              {/* NEXT REWARD: Progress component */}
              <motion.div
                {...stagger(0.29)}
                className="p-4 rounded-2xl bg-muted/20 border border-border/30 space-y-3"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Next Reward
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-primary">
                    {streak >= nextMilestone.days
                      ? "Ready!"
                      : `${nextMilestone.days - streak} days away`}
                  </span>
                </div>

                {/* Reward name */}
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">
                    {nextMilestone.icon}
                  </span>
                  <span className="text-[13px] font-bold text-foreground leading-snug">
                    {nextMilestone.title}
                  </span>
                </div>

                {/* Progress track */}
                <div>
                  <div className="relative h-2 rounded-full bg-muted/60 overflow-hidden">
                    {/* Animated fill */}
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-orange-500 transition-none"
                      style={{ width: `${animatedProgress}%` }}
                    />
                    {/* Current position dot */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-primary shadow-sm transition-none"
                      style={{
                        left: `calc(${Math.min(
                          animatedProgress,
                          92
                        )}% - 6px)`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      {prevMilestoneDays} days
                    </span>
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      {nextMilestone.days} days
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* REWARDS LIST */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Gift className="w-3 h-3 text-primary" />
                    Couple Surprises
                  </span>
                  <span className="text-[10px] font-semibold text-primary">
                    {SURPRISES.filter((s) => streak >= s.days).length}/
                    {SURPRISES.length} Unlocked
                  </span>
                </div>

                <div className="space-y-1.5">
                  {SURPRISES.map((surprise, i) => (
                    <RewardRow
                      key={surprise.days}
                      surprise={surprise}
                      streak={streak}
                      claimedCodes={claimedCodes}
                      index={i}
                      onOpen={setSelectedSurprise}
                    />
                  ))}
                </div>
              </div>

              {/* Bottom padding so last row clears the sticky CTA */}
              <div className="h-2 shrink-0" aria-hidden="true" />
            </div>

            {/* ── STICKY CTA ────────────────────────────────────────────────── */}
            <div
              className={cn(
                "shrink-0 px-4 pt-3 pb-4 border-t border-border/30 bg-background/95",
                "safe-bottom"
              )}
              style={{
                paddingBottom: `max(16px, env(safe-area-inset-bottom, 0px))`,
              }}
            >
              {!chattedToday ? (
                <button
                  id="streak-cta-chat"
                  onClick={() => {
                    onOpenChange(false);
                    onStartChat?.();
                  }}
                  className={cn(
                    "w-full h-12 rounded-2xl font-bold text-sm text-white",
                    "bg-gradient-to-r from-orange-500 via-amber-500 to-rose-500",
                    "shadow-lg shadow-orange-500/25",
                    "flex items-center justify-center gap-2",
                    "active:scale-[0.97] transition-transform",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
                  )}
                >
                  <Flame className="w-4 h-4 fill-white shrink-0" />
                  Chat Now & Save Streak
                </button>
              ) : (
                <button
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    "w-full h-12 rounded-2xl font-bold text-sm",
                    "bg-gradient-to-r from-emerald-500 to-teal-500",
                    "text-white shadow-lg shadow-emerald-500/20",
                    "flex items-center justify-center gap-2",
                    "active:scale-[0.97] transition-transform",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                  )}
                >
                  <Shield className="w-4 h-4 fill-white/20 shrink-0" />
                  Keep Loving 💕
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ─── Reward popup portal ─────────────────────────────────────────────────

  const popupPortal = (
    <AnimatePresence>
      {selectedSurprise && (
        <RewardPopup
          surprise={selectedSurprise}
          claimedCodes={claimedCodes}
          copiedCode={copiedCode}
          onCopy={handleCopyVoucher}
          onClaim={handleClaimReward}
          onClose={() => setSelectedSurprise(null)}
        />
      )}
    </AnimatePresence>
  );

  return createPortal(
    <>
      {modalContent}
      {popupPortal}
    </>,
    document.body
  );
}
