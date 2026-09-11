"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Heart,
  Flame,
  Calendar,
  Smile,
  MessageCircle,
  Clock,
  Plus,
  ChevronRight,
  PartyPopper,
  Image as ImageIcon,
  CheckCircle2,
  Lock,
  Unlock,
  Send,
  Sparkles,
  Compass,
} from "lucide-react";
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Firestore,
} from "firebase/firestore";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SparklesSvg } from "@/components/ui/sparkles-svg";
import { LoveSparksRitual } from "@/components/sparks/love-sparks-ritual";
import { toast } from "@/hooks/use-toast";

interface MoodRecord {
  userId: string;
  date: string;
  emoji: string;
  label: string;
  updatedAt?: any;
}

interface KeyDate {
  id: string;
  title: string;
  date: string;
  category: "anniversary" | "birthday" | "milestone" | "trip" | "custom";
  notes?: string;
}

interface HomeDashboardProps {
  firestore: Firestore | null;
  myId: string;
  partnerId: string;
  myName: string;
  partnerName: string;
  myAvatar?: string;
  partnerAvatar?: string;
  partnerPresence?: { online?: boolean; lastSeen?: any };
  streak: number;
  isStreakLoaded?: boolean;
  onOpenStreakModal: () => void;
  onNavigateToChat: () => void;
  onNavigateToTools: (subTab?: string) => void;
  onOpenMemories: () => void;
  memories?: any[];
  messages?: any[];
  darkMode?: boolean;
}

const MOOD_OPTIONS = [
  { emoji: "🥰", label: "Loved" },
  { emoji: "😊", label: "Happy" },
  { emoji: "😌", label: "Peaceful" },
  { emoji: "🤩", label: "Excited" },
  { emoji: "😴", label: "Tired" },
  { emoji: "😐", label: "Meh" },
  { emoji: "😔", label: "Down" },
  { emoji: "😭", label: "Emotional" },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: "easeOut" as const, delay },
});

export function HomeDashboard({
  firestore,
  myId,
  partnerId,
  myName,
  partnerName,
  myAvatar,
  partnerAvatar,
  partnerPresence,
  streak,
  isStreakLoaded = true,
  onOpenStreakModal,
  onNavigateToChat,
  onNavigateToTools,
  onOpenMemories,
  memories = [],
  messages = [],
  darkMode = true,
}: HomeDashboardProps) {
  const todayDateStr = format(new Date(), "yyyy-MM-dd");

  const [myMood, setMyMood] = useState<MoodRecord | null>(null);
  const [partnerMood, setPartnerMood] = useState<MoodRecord | null>(null);
  const [isUpdatingMood, setIsUpdatingMood] = useState(false);
  const [keyDates, setKeyDates] = useState<KeyDate[]>([]);
  const [isLoadingKeyDates, setIsLoadingKeyDates] = useState(true);
  const [resurfacedMemory, setResurfacedMemory] = useState<any | null>(null);

  useEffect(() => {
    if (!firestore || !myId || !partnerId) return;
    const myMoodRef = doc(firestore, "moods", `${myId}_${todayDateStr}`);
    const partnerMoodRef = doc(firestore, "moods", `${partnerId}_${todayDateStr}`);
    const unsubMy = onSnapshot(myMoodRef, (snap) =>
      setMyMood(snap.exists() ? (snap.data() as MoodRecord) : null)
    );
    const unsubPartner = onSnapshot(partnerMoodRef, (snap) =>
      setPartnerMood(snap.exists() ? (snap.data() as MoodRecord) : null)
    );
    return () => { unsubMy(); unsubPartner(); };
  }, [firestore, myId, partnerId, todayDateStr]);

  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, "keyDates"), orderBy("date", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: KeyDate[] = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as KeyDate));
      setKeyDates(list);
      setIsLoadingKeyDates(false);
    }, (err) => {
      console.warn("Error fetching key dates:", err);
      setIsLoadingKeyDates(false);
    });
    return () => unsub();
  }, [firestore]);

  useEffect(() => {
    if (memories && memories.length > 0 && !resurfacedMemory) {
      setResurfacedMemory(memories[Math.floor(Math.random() * memories.length)]);
    }
  }, [memories, resurfacedMemory]);

  const handleSelectMood = async (emoji: string, label: string) => {
    if (!firestore || !myId || isUpdatingMood) return;
    setIsUpdatingMood(true);
    try {
      const moodRef = doc(firestore, "moods", `${myId}_${todayDateStr}`);
      await setDoc(moodRef, { userId: myId, date: todayDateStr, emoji, label, updatedAt: serverTimestamp() }, { merge: true });
      toast({ title: `Logged as ${emoji} ${label}`, description: `${partnerName} can now see your vibe!` });
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update mood." });
    } finally {
      setIsUpdatingMood(false);
    }
  };

  const nextKeyDateInfo = useMemo(() => {
    if (!keyDates || keyDates.length === 0) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const calculated = keyDates.map((item) => {
      const itemDate = parseISO(item.date);
      let targetDate = new Date(today.getFullYear(), itemDate.getMonth(), itemDate.getDate());
      if (differenceInCalendarDays(targetDate, today) < 0) {
        targetDate = new Date(today.getFullYear() + 1, itemDate.getMonth(), itemDate.getDate());
      }
      return { ...item, targetDate, daysLeft: differenceInCalendarDays(targetDate, today) };
    });
    calculated.sort((a, b) => a.daysLeft - b.daysLeft);
    return calculated[0];
  }, [keyDates]);

  const isPartnerOnline = partnerPresence?.online;

  return (
    <div className="w-full pb-32 sm:pb-24">
      <div className="px-3.5 sm:px-5 space-y-3 sm:space-y-4 pt-1">

        {/* ═══ HERO BANNER — standalone couple card (never overlaps) ═══ */}
        <motion.div
          {...fadeUp(0)}
          className="relative overflow-hidden rounded-3xl border border-pink-500/20 bg-gradient-to-br from-pink-500/15 via-purple-600/10 to-indigo-500/10 p-3.5 sm:p-4 shadow-sm backdrop-blur-md"
        >
          {/* Ambient gradient blob */}
          <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-pink-500/15 blur-2xl pointer-events-none" />

          <div className="relative flex items-center justify-between gap-3">
            {/* Avatars + names */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
              {/* Stacked avatars */}
              <div className="relative flex items-center shrink-0">
                <Avatar className="w-11 h-11 sm:w-12 sm:h-12 border-2 border-background shadow-md ring-2 ring-primary/30">
                  <AvatarImage src={myAvatar} />
                  <AvatarFallback className="text-sm font-bold">{myName[0]}</AvatarFallback>
                </Avatar>
                {/* Heart connector */}
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-md border-2 border-background -ml-2 -mr-2 z-10">
                  <Heart className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-white text-white" />
                </div>
                <div className="relative">
                  <Avatar className="w-11 h-11 sm:w-12 sm:h-12 border-2 border-background shadow-md ring-2 ring-pink-500/30">
                    <AvatarImage src={partnerAvatar} />
                    <AvatarFallback className="text-sm font-bold">{partnerName[0]}</AvatarFallback>
                  </Avatar>
                  {isPartnerOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-emerald-400 border-2 border-background rounded-full shadow-sm" />
                  )}
                </div>
              </div>

              {/* Names + status */}
              <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-base font-black text-foreground leading-tight tracking-tight truncate">
                  {myName} <span className="text-pink-400">&</span> {partnerName}
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isPartnerOnline ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                      Active now
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-muted-foreground truncate">
                      Connected 💕
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Open Chat CTA */}
            <button
              onClick={onNavigateToChat}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-bold shadow-md shadow-pink-500/25 active:scale-95 transition-all shrink-0"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Chat</span>
            </button>
          </div>
        </motion.div>

        {/* ═══ STATS ROW — streak + next date ═══ */}
        <motion.div {...fadeUp(0.05)} className="grid grid-cols-2 gap-2.5 sm:gap-3">

          {/* Streak tile */}
          <button
            onClick={onOpenStreakModal}
            className="relative overflow-hidden p-4 rounded-3xl bg-gradient-to-br from-orange-500/20 to-rose-500/10 border border-orange-500/25 active:scale-95 transition-all text-left flex flex-col justify-between min-h-[136px]"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-2xl bg-orange-500/20 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-orange-400 fill-orange-400" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-orange-400 bg-orange-500/15 px-2 py-0.5 rounded-full">
                  Streak
                </span>
              </div>
              <div className="text-2xl font-black text-foreground leading-none">
                {isStreakLoaded ? streak : "—"}
              </div>
              <div className="text-[11px] text-orange-300 font-semibold mt-1">days strong 🔥</div>
            </div>
            <div className="text-[10px] text-muted-foreground mt-2 flex items-center gap-0.5">
              <span>View rewards</span>
              <ChevronRight className="w-3 h-3 shrink-0" />
            </div>
          </button>

          {/* Next key date tile */}
          <button
            onClick={() => onNavigateToTools("dates")}
            className="relative overflow-hidden p-4 rounded-3xl bg-gradient-to-br from-primary/20 to-purple-500/10 border border-primary/25 active:scale-95 transition-all text-left flex flex-col justify-between min-h-[136px]"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-2xl bg-primary/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                {nextKeyDateInfo ? (
                  <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/15 px-2 py-0.5 rounded-full truncate max-w-[70px]">
                    {nextKeyDateInfo.category}
                  </span>
                ) : (
                  <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/15 px-2 py-0.5 rounded-full">
                    Dates
                  </span>
                )}
              </div>
              {nextKeyDateInfo ? (
                <>
                  <div className="text-2xl font-black text-foreground leading-none">
                    {nextKeyDateInfo.daysLeft === 0 ? "🎉" : nextKeyDateInfo.daysLeft}
                  </div>
                  <div className="text-[11px] text-primary font-semibold mt-1 truncate">
                    {nextKeyDateInfo.daysLeft === 0 ? "Today!" : "days to go"}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-black text-foreground leading-none">
                    +
                  </div>
                  <div className="text-[11px] text-primary font-semibold mt-1 truncate">
                    Add milestone
                  </div>
                </>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground mt-2 flex items-center gap-0.5 truncate">
              <span className="truncate">{nextKeyDateInfo ? nextKeyDateInfo.title : "Set a date"}</span>
              <ChevronRight className="w-3 h-3 shrink-0" />
            </div>
          </button>
        </motion.div>

        {/* ═══ QUICK ACTIONS — native app-style grid ═══ */}
        <motion.div {...fadeUp(0.10)}>
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: MessageCircle, label: "Chat", color: "from-blue-500/20 to-blue-600/10", iconColor: "text-blue-400", action: onNavigateToChat },
              { icon: Heart, label: "Nudge", color: "from-pink-500/20 to-rose-500/10", iconColor: "text-pink-400", action: () => onNavigateToTools("nudges") },
              { icon: Compass, label: "Bucket", color: "from-emerald-500/20 to-teal-500/10", iconColor: "text-emerald-400", action: () => onNavigateToTools("bucket") },
              { icon: Lock, label: "Capsule", color: "from-purple-500/20 to-indigo-500/10", iconColor: "text-purple-400", action: () => onNavigateToTools("capsules") },
            ].map(({ icon: Icon, label, color, iconColor, action }) => (
              <button
                key={label}
                onClick={action}
                className={`flex flex-col items-center gap-1.5 py-3.5 px-2 rounded-2xl bg-gradient-to-br ${color} border border-white/5 active:scale-95 transition-all`}
              >
                <div className={`w-8 h-8 rounded-xl bg-background/30 flex items-center justify-center ${iconColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-foreground">{label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* ═══ MOOD CHECK-IN — horizontal emoji row ═══ */}
        <motion.div {...fadeUp(0.14)} className="rounded-3xl bg-card border border-border shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-pink-500/15 flex items-center justify-center">
                  <Smile className="w-4 h-4 text-pink-400" />
                </div>
                <span className="text-sm font-bold text-foreground">Today's Vibe</span>
              </div>
              {/* Partner mood pill */}
              {partnerMood && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-pink-500/10 rounded-full border border-pink-500/20">
                  <span className="text-sm leading-none">{partnerMood.emoji}</span>
                  <span className="text-[11px] font-semibold text-pink-400">{partnerName}</span>
                </div>
              )}
            </div>

            {/* My mood — big emoji or picker row */}
            {myMood ? (
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 border border-border/60">
                <span className="text-4xl leading-none">{myMood.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-foreground">Feeling {myMood.label}</div>
                  <div className="text-[11px] text-muted-foreground">Logged for today</div>
                </div>
                <button
                  onClick={() => setMyMood(null)}
                  className="text-[11px] text-primary font-semibold px-2.5 py-1 rounded-xl bg-primary/10 active:scale-95 transition-all"
                >
                  Change
                </button>
              </div>
            ) : (
              <div>
                <p className="text-[11px] text-muted-foreground mb-2">How are you feeling today?</p>
                <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1.5 pt-0.5 overscroll-x-contain snap-x snap-mandatory touch-pan-x">
                  {MOOD_OPTIONS.map((item) => (
                    <button
                      key={item.emoji}
                      onClick={() => handleSelectMood(item.emoji, item.label)}
                      disabled={isUpdatingMood}
                      className="flex flex-col items-center gap-1 shrink-0 snap-start active:scale-90 transition-all touch-manipulation"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-muted/60 border border-border/60 flex items-center justify-center text-2xl hover:bg-primary/10 hover:border-primary/30 transition-colors shadow-xs">
                        {item.emoji}
                      </div>
                      <span className="text-[10px] font-semibold text-muted-foreground">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Partner not checked in nudge */}
            {!partnerMood && (
              <button
                onClick={() => onNavigateToTools("nudges")}
                className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-muted/40 border border-dashed border-border text-xs font-semibold text-muted-foreground hover:border-pink-500/30 hover:text-pink-400 active:scale-95 transition-all touch-manipulation"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{partnerName} hasn't checked in yet — send a nudge 💭</span>
              </button>
            )}
          </div>
        </motion.div>

        {/* ═══ LOVE SPARKS RITUAL ═══ */}
        <motion.div {...fadeUp(0.18)}>
          <LoveSparksRitual
            firestore={firestore}
            myId={myId}
            partnerId={partnerId}
            myName={myName}
            partnerName={partnerName}
            myAvatar={myAvatar}
            partnerAvatar={partnerAvatar}
            messages={messages}
            memories={memories}
            keyDates={keyDates}
            darkMode={darkMode}
            onOpenMemories={onOpenMemories}
          />
        </motion.div>

        {/* ═══ RESURFACED MEMORY ═══ */}
        <AnimatePresence>
          {resurfacedMemory && (
            <motion.div
              {...fadeUp(0.22)}
              className="rounded-3xl bg-card border border-border shadow-sm overflow-hidden"
            >
              <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-purple-500/15 flex items-center justify-center">
                    <SparklesSvg className="w-4 h-4 text-purple-400" />
                  </div>
                  <span className="text-sm font-bold text-foreground">Cherished Memory</span>
                </div>
                <button
                  onClick={onOpenMemories}
                  className="text-[11px] text-primary font-semibold px-2.5 py-1 rounded-xl bg-primary/10 active:scale-95 transition-all"
                >
                  All ({memories.length})
                </button>
              </div>

              <button
                onClick={onOpenMemories}
                className="w-full px-4 pb-4 text-left active:opacity-80 transition-opacity"
              >
                <div className="flex gap-3 items-center mt-2 p-3.5 rounded-2xl bg-muted/40 border border-border/60">
                  {resurfacedMemory.photoURL ? (
                    <img
                      src={resurfacedMemory.photoURL}
                      alt={resurfacedMemory.title}
                      className="w-16 h-16 rounded-xl object-cover shadow-sm shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-pink-500/15 flex items-center justify-center text-pink-500 shrink-0">
                      <PartyPopper className="w-6 h-6" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-black uppercase tracking-widest text-pink-400">
                      {resurfacedMemory.type || "Milestone"}
                    </span>
                    <h4 className="font-bold text-sm text-foreground truncate mt-0.5">
                      {resurfacedMemory.title}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{resurfacedMemory.date}</p>
                    {resurfacedMemory.description && (
                      <p className="text-[11px] text-foreground/70 mt-1 line-clamp-2">
                        {resurfacedMemory.description}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

