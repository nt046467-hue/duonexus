"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Flame,
  Heart,
  Trophy,
  Sparkles,
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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  streak: number;
  longestStreak: number;
  chattedToday: boolean;
  partnerName: string;
  onUpdateStreak?: (newStreak: number) => Promise<void>;
  onStartChat?: () => void;
  onClaimReward?: (surprise: SurpriseMilestone) => Promise<void> | void;
}

const STREAK_TIERS = [
  {
    min: 100,
    name: "Century Legends 💎",
    level: "Level 7 · Prismatic Flame",
    gradient: "from-fuchsia-500 via-pink-500 to-amber-400",
    shadow: "shadow-fuchsia-500/30",
    flameColor: "text-amber-200 fill-amber-200",
    badgeClass: "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/40",
  },
  {
    min: 50,
    name: "Golden Phoenix 👑",
    level: "Level 6 · Royal Fire",
    gradient: "from-amber-400 via-orange-500 to-yellow-300",
    shadow: "shadow-yellow-500/30",
    flameColor: "text-yellow-200 fill-yellow-200",
    badgeClass: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  },
  {
    min: 30,
    name: "Diamond Inferno 🌟",
    level: "Level 5 · Electric Ice Fire",
    gradient: "from-cyan-400 via-blue-500 to-indigo-500",
    shadow: "shadow-cyan-500/30",
    flameColor: "text-cyan-200 fill-cyan-200",
    badgeClass: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
  },
  {
    min: 15,
    name: "Cosmic Supernova 💖",
    level: "Level 4 · Romantic Plasma",
    gradient: "from-rose-500 via-purple-500 to-pink-500",
    shadow: "shadow-pink-500/30",
    flameColor: "text-pink-200 fill-pink-200",
    badgeClass: "bg-pink-500/20 text-pink-400 border-pink-500/40",
  },
  {
    min: 7,
    name: "Blazing Duo ⚡",
    level: "Level 3 · Voltage Flame",
    gradient: "from-violet-500 via-orange-500 to-amber-400",
    shadow: "shadow-violet-500/30",
    flameColor: "text-amber-200 fill-amber-200",
    badgeClass: "bg-violet-500/20 text-violet-400 border-violet-500/40",
  },
  {
    min: 3,
    name: "Flame Keepers 🔥",
    level: "Level 2 · Ignited Spark",
    gradient: "from-orange-500 via-amber-500 to-rose-500",
    shadow: "shadow-orange-500/30",
    flameColor: "text-yellow-300 fill-yellow-300",
    badgeClass: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  },
  {
    min: 1,
    name: "Spark Beginnings ✨",
    level: "Level 1 · Awakening",
    gradient: "from-amber-400 via-orange-400 to-rose-400",
    shadow: "shadow-amber-500/25",
    flameColor: "text-white fill-white",
    badgeClass: "bg-amber-500/20 text-amber-400 border-amber-500/40",
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

export function StreakModal({
  open,
  onOpenChange,
  streak,
  longestStreak,
  chattedToday,
  partnerName,
  onStartChat,
  onClaimReward,
}: StreakModalProps) {
  const [selectedSurprise, setSelectedSurprise] = useState<SurpriseMilestone | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number }>({ hours: 0, minutes: 0 });
  const [claimedCodes, setClaimedCodes] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        return JSON.parse(localStorage.getItem("duonexus_claimed_vouchers") || "[]");
      } catch {}
    }
    return [];
  });

  const handleClaimReward = async (surprise: SurpriseMilestone) => {
    const updated = Array.from(new Set([...claimedCodes, surprise.rewardVoucher]));
    setClaimedCodes(updated);
    try {
      localStorage.setItem("duonexus_claimed_vouchers", JSON.stringify(updated));
    } catch {}

    if (onClaimReward) {
      await onClaimReward(surprise);
    }
    setSelectedSurprise(null);
    onOpenChange(false);
    onStartChat?.();
  };

  // Calculate real-time countdown to midnight (like TikTok / Snapchat streak expiration)
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

  // Determine current Tier
  const currentTier = useMemo(() => {
    return STREAK_TIERS.find((t) => streak >= t.min) || STREAK_TIERS[STREAK_TIERS.length - 1];
  }, [streak]);

  // Find next surprise milestone
  const nextMilestone = useMemo(() => {
    return SURPRISES.find((m) => m.days > streak) || SURPRISES[SURPRISES.length - 1];
  }, [streak]);

  const prevMilestoneDays = useMemo(() => {
    return [...SURPRISES].reverse().find((m) => m.days <= streak)?.days || 0;
  }, [streak]);

  const progressPercent = useMemo(() => {
    if (streak >= nextMilestone.days) return 100;
    const range = nextMilestone.days - prevMilestoneDays;
    if (range <= 0) return 100;
    return Math.min(100, Math.max(5, Math.round(((streak - prevMilestoneDays) / range) * 100)));
  }, [streak, nextMilestone, prevMilestoneDays]);

  const handleCopyVoucher = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md w-[94vw] sm:w-full p-5 sm:p-6 bg-background/95 backdrop-blur-xl border border-primary/20 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
          {/* Dynamic Ambient Background Glow */}
          <div
            className={cn(
              "absolute top-0 left-1/2 -translate-x-1/2 w-72 h-36 blur-3xl rounded-full pointer-events-none opacity-40 bg-gradient-to-r",
              currentTier.gradient
            )}
          />

          <DialogHeader className="text-center sm:text-center items-center shrink-0">
            {/* TikTok Animated Evolving Fire Badge */}
            <div className="relative my-2">
              <div
                className={cn(
                  "w-20 h-20 rounded-3xl bg-gradient-to-tr flex items-center justify-center shadow-xl transition-all duration-500",
                  currentTier.gradient,
                  currentTier.shadow
                )}
              >
                <Flame className={cn("w-12 h-12 drop-shadow-md animate-bounce-subtle", currentTier.flameColor)} />
              </div>
              <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-background border-2 border-primary/20 flex items-center justify-center shadow-md">
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500 animate-pulse" />
              </div>
            </div>

            {/* Streak Count & Tier */}
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <DialogTitle className="text-2xl sm:text-3xl font-black font-headline tracking-tight text-foreground">
                  {streak} Days Strong
                </DialogTitle>
                <span className="text-2xl">🔥</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span
                  className={cn(
                    "text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-sm",
                    currentTier.badgeClass
                  )}
                >
                  {currentTier.name}
                </span>
              </div>
              <DialogDescription className="text-xs text-muted-foreground pt-1">
                Real continuous daily chats with <span className="font-semibold text-foreground">{partnerName}</span>
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 my-2 min-h-0 scrollbar-thin">
            {/* TikTok-Style Status & 24h Countdown Alert */}
            <div
              className={cn(
                "p-3.5 rounded-2xl border transition-all shadow-sm",
                chattedToday
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                    chattedToday ? "bg-emerald-500/20 text-emerald-500" : "bg-amber-500/20 text-amber-500 animate-pulse"
                  )}
                >
                  {chattedToday ? (
                    <Check className="w-5 h-5 stroke-[2.5]" />
                  ) : (
                    <Clock className="w-5 h-5 stroke-[2.5]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold block leading-tight">
                      {chattedToday ? "Streak Secured Today 🔥" : "Streak In Danger! ⏳"}
                    </span>
                    {!chattedToday && (
                      <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 px-2 py-0.5 rounded-full">
                        {timeLeft.hours}h {timeLeft.minutes}m left
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] opacity-90 mt-0.5 leading-snug">
                    {chattedToday
                      ? `Both of you connected today! Your flame is safe. Next count unlocks tomorrow.`
                      : `Send a message to ${partnerName} before midnight to prevent your flame from resetting to 1!`}
                  </p>
                </div>
              </div>
            </div>

            {/* Next Milestone Progress Bar */}
            <div className="p-3.5 rounded-2xl bg-muted/30 border border-primary/10 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold flex items-center gap-1.5 text-foreground">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Next Reward: {nextMilestone.title}</span>
                </span>
                <span className="text-primary font-bold text-xs">
                  {streak >= nextMilestone.days ? "Ready!" : `${nextMilestone.days - streak} days left`}
                </span>
              </div>
              <Progress value={progressPercent} className="h-2 rounded-full" />
              <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                <span>{prevMilestoneDays} days</span>
                <span>{nextMilestone.days} days ({nextMilestone.tag})</span>
              </div>
            </div>

            {/* Quick Stats: Longest Streak & Status */}
            <div className="grid grid-cols-2 gap-2.5 text-center">
              <div className="p-3 bg-muted/20 border border-primary/10 rounded-2xl">
                <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block flex items-center justify-center gap-1">
                  <Trophy className="w-3 h-3 text-amber-500" />
                  Record Streak
                </span>
                <span className="text-base font-headline font-black text-foreground">
                  {Math.max(streak, longestStreak)} Days 🏆
                </span>
              </div>
              <div className="p-3 bg-muted/20 border border-primary/10 rounded-2xl">
                <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block">
                  Today's Status
                </span>
                <span className="text-base font-headline font-black text-foreground">
                  {chattedToday ? "Secured ✅" : "Pending 💬"}
                </span>
              </div>
            </div>

            {/* TikTok Style Milestone Mystery Surprises Section */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-pink-500" />
                  Couple Surprises & Vouchers
                </span>
                <span className="text-[10px] text-primary font-medium">
                  {SURPRISES.filter((s) => streak >= s.days).length}/{SURPRISES.length} Unlocked
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {SURPRISES.map((surprise) => {
                  const isUnlocked = streak >= surprise.days;
                  return (
                    <div
                      key={surprise.days}
                      onClick={() => {
                        if (isUnlocked) {
                          setSelectedSurprise(surprise);
                        }
                      }}
                      className={cn(
                        "p-2.5 sm:p-3 rounded-2xl border flex items-center justify-between transition-all",
                        isUnlocked
                          ? "bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-primary/10 border-pink-500/30 hover:border-pink-500/60 cursor-pointer shadow-sm hover:scale-[1.01]"
                          : "bg-muted/20 border-border/40 opacity-65 cursor-not-allowed"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-sm",
                            isUnlocked
                              ? "bg-gradient-to-tr from-pink-500 to-rose-500 text-white animate-pulse"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {surprise.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-foreground truncate">
                              Day {surprise.days}: {surprise.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {isUnlocked ? "✨ Tap to open surprise!" : `Reach ${surprise.days} day streak to unlock`}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 ml-2">
                        {isUnlocked ? (
                          claimedCodes.includes(surprise.rewardVoucher) ? (
                            <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                              <Check className="w-2.5 h-2.5 stroke-[2.5]" /> Claimed
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold bg-pink-500 text-white px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                              <Unlock className="w-2.5 h-2.5" /> Open 🎁
                            </span>
                          )
                        ) : (
                          <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-2 shrink-0 border-t border-border/40">
            {!chattedToday ? (
              <Button
                onClick={() => {
                  onOpenChange(false);
                  onStartChat?.();
                }}
                className="w-full h-11 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-rose-500 text-white font-bold gap-2 shadow-lg shadow-orange-500/25"
              >
                <Flame className="w-4 h-4 fill-white" />
                Chat Now & Save Streak
              </Button>
            ) : (
              <Button
                onClick={() => onOpenChange(false)}
                className="w-full h-11 rounded-2xl bg-primary text-primary-foreground font-bold shadow-md"
              >
                Keep Loving 💕
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Surprise Reward Popup Dialog */}
      {selectedSurprise && (
        <Dialog open={!!selectedSurprise} onOpenChange={(open) => !open && setSelectedSurprise(null)}>
          <DialogContent className="max-w-sm w-[90vw] p-6 bg-gradient-to-b from-background to-muted/50 border-2 border-pink-500/40 rounded-3xl shadow-2xl text-center overflow-hidden">
            {/* Confetti particles decoration */}
            <div className="absolute top-2 left-4 text-xl animate-bounce">🎉</div>
            <div className="absolute top-4 right-6 text-xl animate-pulse">✨</div>
            <div className="absolute bottom-4 left-6 text-lg animate-pulse">💖</div>
            <div className="absolute bottom-6 right-4 text-xl animate-bounce">🎁</div>

            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-400 flex items-center justify-center text-3xl shadow-lg shadow-pink-500/30 my-2 animate-pulse">
              {selectedSurprise.icon}
            </div>

            <DialogTitle className="text-xl font-black font-headline text-foreground mt-2">
              {selectedSurprise.rewardTitle}
            </DialogTitle>

            <DialogDescription className="text-xs text-foreground/80 mt-2 leading-relaxed bg-pink-500/10 p-3.5 rounded-2xl border border-pink-500/20 font-medium">
              "{selectedSurprise.rewardDescription}"
            </DialogDescription>

            {/* Voucher Code Box */}
            <div className="my-3 p-3 bg-muted/40 rounded-xl border border-primary/20 flex items-center justify-between">
              <div className="text-left">
                <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground block">
                  Official Couple Voucher
                </span>
                <span className="text-xs font-mono font-bold text-primary tracking-wider">
                  {selectedSurprise.rewardVoucher}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCopyVoucher(selectedSurprise.rewardVoucher)}
                className="h-7 text-[11px] font-bold rounded-lg gap-1 hover:bg-primary/10"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-primary" />
                    Copy
                  </>
                )}
              </Button>
            </div>

            <Button
              onClick={() => handleClaimReward(selectedSurprise)}
              className="w-full h-11 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:opacity-95 text-white font-bold shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 text-sm"
            >
              <PartyPopper className="w-4 h-4" />
              <span>
                {claimedCodes.includes(selectedSurprise.rewardVoucher)
                  ? "Send to Chat Again 💬"
                  : "Claim & Send to Chat 🥳"}
              </span>
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
