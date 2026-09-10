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
import { motion } from "framer-motion";
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
  date: string; // yyyy-MM-dd
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

  // Moods state
  const [myMood, setMyMood] = useState<MoodRecord | null>(null);
  const [partnerMood, setPartnerMood] = useState<MoodRecord | null>(null);
  const [isUpdatingMood, setIsUpdatingMood] = useState(false);

  // Key Dates state
  const [keyDates, setKeyDates] = useState<KeyDate[]>([]);
  const [isLoadingKeyDates, setIsLoadingKeyDates] = useState(true);

  // Random Resurfaced Memory
  const [resurfacedMemory, setResurfacedMemory] = useState<any | null>(null);

  // 1. Listen for today's moods
  useEffect(() => {
    if (!firestore || !myId || !partnerId) return;

    const myMoodRef = doc(firestore, "moods", `${myId}_${todayDateStr}`);
    const partnerMoodRef = doc(firestore, "moods", `${partnerId}_${todayDateStr}`);

    const unsubMy = onSnapshot(myMoodRef, (snap) => {
      if (snap.exists()) {
        setMyMood(snap.data() as MoodRecord);
      } else {
        setMyMood(null);
      }
    });

    const unsubPartner = onSnapshot(partnerMoodRef, (snap) => {
      if (snap.exists()) {
        setPartnerMood(snap.data() as MoodRecord);
      } else {
        setPartnerMood(null);
      }
    });

    return () => {
      unsubMy();
      unsubPartner();
    };
  }, [firestore, myId, partnerId, todayDateStr]);

  // 2. Listen for Key Dates
  useEffect(() => {
    if (!firestore) return;
    const datesRef = collection(firestore, "keyDates");
    const q = query(datesRef, orderBy("date", "asc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: KeyDate[] = [];
        snap.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as KeyDate);
        });
        setKeyDates(list);
        setIsLoadingKeyDates(false);
      },
      (err) => {
        console.warn("Error fetching key dates:", err);
        setIsLoadingKeyDates(false);
      }
    );

    return () => unsub();
  }, [firestore]);

  // 3. Resurface a random memory on mount
  useEffect(() => {
    if (memories && memories.length > 0 && !resurfacedMemory) {
      const randomItem = memories[Math.floor(Math.random() * memories.length)];
      setResurfacedMemory(randomItem);
    }
  }, [memories, resurfacedMemory]);

  // Handle Mood selection
  const handleSelectMood = async (emoji: string, label: string) => {
    if (!firestore || !myId || isUpdatingMood) return;
    setIsUpdatingMood(true);

    try {
      const moodRef = doc(firestore, "moods", `${myId}_${todayDateStr}`);
      await setDoc(
        moodRef,
        {
          userId: myId,
          date: todayDateStr,
          emoji,
          label,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      toast({
        title: `Logged as ${emoji} ${label}`,
        description: `${partnerName} can now see your vibe for today!`,
      });
    } catch (err) {
      console.error("Failed to update mood:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update mood.",
      });
    } finally {
      setIsUpdatingMood(false);
    }
  };

  // Find nearest upcoming key date
  const nextKeyDateInfo = useMemo(() => {
    if (!keyDates || keyDates.length === 0) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Compute next occurrence for each key date
    const calculated = keyDates.map((item) => {
      const itemDate = parseISO(item.date);
      // For anniversaries and birthdays, adjust year to next occurrence
      let targetDate = new Date(today.getFullYear(), itemDate.getMonth(), itemDate.getDate());
      if (differenceInCalendarDays(targetDate, today) < 0) {
        targetDate = new Date(today.getFullYear() + 1, itemDate.getMonth(), itemDate.getDate());
      }
      const daysLeft = differenceInCalendarDays(targetDate, today);
      return {
        ...item,
        targetDate,
        daysLeft,
      };
    });

    // Sort by smallest positive daysLeft
    calculated.sort((a, b) => a.daysLeft - b.daysLeft);
    return calculated[0];
  }, [keyDates]);

  return (
    <div className="flex-1 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl w-full mx-auto select-none">
      {/* 1. Couple Sanctuary Header */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-7 bg-gradient-to-r from-pink-500/15 via-purple-500/15 to-indigo-500/15 border border-pink-500/20 shadow-lg backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Couple Avatars with Connected Heart */}
          <div className="flex items-center gap-4">
            <div className="flex items-center -space-x-3">
              <div className="relative">
                <Avatar className="w-14 h-14 border-2 border-background shadow-md">
                  <AvatarImage src={myAvatar} />
                  <AvatarFallback>{myName[0]}</AvatarFallback>
                </Avatar>
              </div>

              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white shadow-md z-10 border-2 border-background">
                <Heart className="w-4 h-4 fill-white animate-pulse" />
              </div>

              <div className="relative">
                <Avatar className="w-14 h-14 border-2 border-background shadow-md">
                  <AvatarImage src={partnerAvatar} />
                  <AvatarFallback>{partnerName[0]}</AvatarFallback>
                </Avatar>
                {partnerPresence?.online && (
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-background rounded-full" />
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black font-headline text-foreground tracking-tight">
                  {myName} & {partnerName}
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {partnerPresence?.online
                  ? `${partnerName} is online with you right now 💚`
                  : "Your private couple sanctuary 💕"}
              </p>
            </div>
          </div>

          {/* Jump to Chat button */}
          <Button
            onClick={onNavigateToChat}
            className="rounded-2xl px-5 h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Open Chat</span>
          </Button>
        </div>
      </div>

      {/* 2. Top Stats Grid: Love Streak + Next Key Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Streak Card */}
        <div
          onClick={onOpenStreakModal}
          className="p-5 rounded-3xl bg-card border border-orange-500/20 shadow-sm hover:border-orange-500/40 transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/15 flex items-center justify-center text-orange-500">
              <Flame className="w-6 h-6 fill-orange-500 animate-pulse" />
            </div>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/25">
              TikTok Flame
            </span>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Love Streak
          </span>
          <div className="text-2xl font-black font-headline text-foreground mt-0.5 flex items-center gap-2">
            {isStreakLoaded ? `${streak} Days Strong 🔥` : "..."}
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 group-hover:text-primary transition-colors">
            Tap to view milestone rewards <ChevronRight className="w-3.5 h-3.5" />
          </p>
        </div>

        {/* Next Key Date Countdown */}
        <div
          onClick={() => onNavigateToTools("dates")}
          className="p-5 rounded-3xl bg-card border border-primary/20 shadow-sm hover:border-primary/40 transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center text-primary">
              <Calendar className="w-5 h-5" />
            </div>
            {nextKeyDateInfo ? (
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
                {nextKeyDateInfo.category || "Milestone"}
              </span>
            ) : (
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                Dates
              </span>
            )}
          </div>

          {nextKeyDateInfo ? (
            <>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block truncate">
                {nextKeyDateInfo.title}
              </span>
              <div className="text-2xl font-black font-headline text-foreground mt-0.5 flex items-center gap-2">
                {nextKeyDateInfo.daysLeft === 0 ? (
                  <span className="text-pink-500 flex items-center gap-1">
                    Today! 🎉
                  </span>
                ) : (
                  <span>{nextKeyDateInfo.daysLeft} {nextKeyDateInfo.daysLeft === 1 ? "day" : "days"} to go</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 group-hover:text-primary transition-colors">
                {format(nextKeyDateInfo.targetDate, "MMMM d")} • Manage dates <ChevronRight className="w-3.5 h-3.5" />
              </p>
            </>
          ) : (
            <>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                Next Milestone
              </span>
              <div className="text-lg font-bold text-foreground mt-0.5">
                Add an Anniversary or Birthday
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 group-hover:text-primary transition-colors">
                Tap to add special dates <ChevronRight className="w-3.5 h-3.5" />
              </p>
            </>
          )}
        </div>
      </div>

      {/* 3. Daily Mood Check-In Card (Side-by-Side) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-card border border-border shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-500">
              <Smile className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-foreground">
                Today's Mood Check-in
              </h3>
              <p className="text-xs text-muted-foreground">
                How you both are feeling today
              </p>
            </div>
          </div>
        </div>

        {/* Side-by-side comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* My Mood */}
          <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="w-6 h-6 border">
                  <AvatarImage src={myAvatar} />
                  <AvatarFallback>{myName[0]}</AvatarFallback>
                </Avatar>
                <span className="text-xs font-bold text-foreground">{myName} (You)</span>
              </div>
              {myMood && (
                <span className="text-xs font-semibold text-primary px-2 py-0.5 rounded-full bg-primary/10">
                  {myMood.label}
                </span>
              )}
            </div>

            {myMood ? (
              <div className="flex items-center gap-3">
                <span className="text-3xl leading-none">{myMood.emoji}</span>
                <div>
                  <p className="text-xs text-muted-foreground">Logged for today</p>
                  <button
                    onClick={() => setMyMood(null)}
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    Change mood
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Tap an emoji to log your vibe:</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {MOOD_OPTIONS.map((item) => (
                    <button
                      key={item.emoji}
                      onClick={() => handleSelectMood(item.emoji, item.label)}
                      className="w-8 h-8 rounded-xl bg-background hover:scale-125 active:scale-95 transition-all flex items-center justify-center text-lg border border-border/80 shadow-xs"
                      title={item.label}
                    >
                      {item.emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Partner's Mood */}
          <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="w-6 h-6 border">
                  <AvatarImage src={partnerAvatar} />
                  <AvatarFallback>{partnerName[0]}</AvatarFallback>
                </Avatar>
                <span className="text-xs font-bold text-foreground">{partnerName}</span>
              </div>
              {partnerMood && (
                <span className="text-xs font-semibold text-pink-500 px-2 py-0.5 rounded-full bg-pink-500/10">
                  {partnerMood.label}
                </span>
              )}
            </div>

            {partnerMood ? (
              <div className="flex items-center gap-3">
                <span className="text-3xl leading-none">{partnerMood.emoji}</span>
                <div>
                  <p className="text-xs text-foreground font-semibold">Feeling {partnerMood.label.toLowerCase()}</p>
                  <p className="text-[11px] text-muted-foreground">Updated today</p>
                </div>
              </div>
            ) : (
              <div className="py-2 text-center text-xs text-muted-foreground">
                <p>{partnerName} hasn't checked in yet today 🌸</p>
                <button
                  onClick={() => onNavigateToTools("nudges")}
                  className="mt-1.5 text-[11px] text-pink-500 font-semibold hover:underline inline-block"
                >
                  Send a gentle nudge 💭
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Real AI Love Sparks Ritual Card */}
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

      {/* 5. "On This Day" / Cherished Memory Resurfacing */}
      {resurfacedMemory ? (
        <div className="p-5 sm:p-6 rounded-3xl bg-card border border-border shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                <SparklesSvg className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-foreground">
                  Cherished Memory
                </h3>
                <p className="text-xs text-muted-foreground">
                  Resurfaced from your journey together
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={onOpenMemories}
              className="text-xs text-primary hover:bg-primary/10 rounded-xl"
            >
              All Memories ({memories.length})
            </Button>
          </div>

          <div
            onClick={onOpenMemories}
            className="p-4 rounded-2xl bg-muted/40 hover:bg-muted/60 transition-colors border border-border/80 cursor-pointer flex flex-col sm:flex-row gap-4 items-start sm:items-center"
          >
            {resurfacedMemory.photoURL ? (
              <img
                src={resurfacedMemory.photoURL}
                alt={resurfacedMemory.title}
                className="w-full sm:w-24 h-24 rounded-xl object-cover shadow-sm shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-pink-500/15 flex items-center justify-center text-pink-500 shrink-0">
                <PartyPopper className="w-6 h-6" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400">
                {resurfacedMemory.type || "Milestone"}
              </span>
              <h4 className="font-bold text-base text-foreground truncate mt-0.5">
                {resurfacedMemory.title}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {resurfacedMemory.date}
              </p>
              {resurfacedMemory.description && (
                <p className="text-xs text-foreground/80 mt-1 line-clamp-2">
                  {resurfacedMemory.description}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
