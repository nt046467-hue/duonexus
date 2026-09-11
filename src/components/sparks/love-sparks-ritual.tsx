"use client";

import React, { useState, useEffect } from "react";
import {
  Heart,
  Lock,
  Unlock,
  Send,
  Calendar,
  CheckCircle2,
  Clock,
  Archive,
  ChevronRight,
  Flame,
  Share2,
} from "lucide-react";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  Firestore,
} from "firebase/firestore";
import { SparklesSvg } from "@/components/ui/sparkles-svg";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { dailyAiConversationPrompt } from "@/ai/flows/daily-ai-conversation-prompt";
import { toast } from "@/hooks/use-toast";

export interface SparkAnswer {
  text: string;
  answeredAt?: any;
}

export interface SparkData {
  id: string; // date string yyyy-MM-dd
  date: string;
  question: string;
  createdAt?: any;
  answers?: Record<string, SparkAnswer>;
  revealed?: boolean;
  savedToMemories?: boolean;
}

interface LoveSparksRitualProps {
  firestore: Firestore | null;
  myId: string;
  partnerId: string;
  myName: string;
  partnerName: string;
  myAvatar?: string;
  partnerAvatar?: string;
  messages?: any[];
  memories?: any[];
  keyDates?: any[];
  darkMode?: boolean;
  onOpenMemories?: () => void;
}

export function LoveSparksRitual({
  firestore,
  myId,
  partnerId,
  myName,
  partnerName,
  myAvatar,
  partnerAvatar,
  messages = [],
  memories = [],
  keyDates = [],
  darkMode = true,
  onOpenMemories,
}: LoveSparksRitualProps) {
  const todayDateStr = format(new Date(), "yyyy-MM-dd");
  const [sparkData, setSparkData] = useState<SparkData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [myAnswerText, setMyAnswerText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Realtime subscription to today's spark document
  useEffect(() => {
    if (!firestore) return;
    const sparkRef = doc(firestore, "sparks", todayDateStr);

    const unsub = onSnapshot(
      sparkRef,
      async (docSnap) => {
        setIsLoading(false);
        if (docSnap.exists()) {
          const data = docSnap.data() as SparkData;
          setSparkData(data);

          // Check if both answered and not yet revealed or not yet saved to memories
          const answers = data.answers || {};
          const myAns = answers[myId]?.text;
          const partnerAns = answers[partnerId]?.text;
          const bothAnswered = Boolean(myAns && partnerAns);

          if (bothAnswered && !data.revealed) {
            // Update to revealed
            try {
              await updateDoc(sparkRef, { revealed: true });
              setShowCelebration(true);
            } catch (err) {
              console.warn("Failed to set revealed state:", err);
            }
          }

          // Auto-archive to memories if both answered and not yet saved
          if (bothAnswered && !data.savedToMemories) {
            try {
              await updateDoc(sparkRef, { savedToMemories: true });
              await addDoc(collection(firestore, "memories"), {
                title: `Love Spark: ${data.question.slice(0, 60)}...`,
                date: todayDateStr,
                type: "favorite",
                photoURL: null,
                sparkQuestion: data.question,
                sparkAnswers: {
                  [myName]: myAns,
                  [partnerName]: partnerAns,
                },
                createdAt: serverTimestamp(),
              });
              toast({
                title: "Spark Saved to Memories 💕",
                description: "Your daily ritual answers are safely archived forever.",
              });
            } catch (err) {
              console.warn("Failed to auto-archive spark:", err);
            }
          }
        } else {
          setSparkData(null);
        }
      },
      (err) => {
        console.warn("Error listening to sparks:", err);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [firestore, todayDateStr, myId, partnerId, myName, partnerName]);

  // Generate today's spark with rich couple context
  const handleGenerateTodaySpark = async () => {
    if (!firestore || isGenerating) return;
    setIsGenerating(true);

    try {
      // Gather rich context from recent messages, memories, and key dates
      const recentChatExcerpts = messages
        .filter((m) => m.content && m.type === "text")
        .slice(-8)
        .map((m) => `${m.senderRole === myId ? myName : partnerName}: "${m.content}"`)
        .join(" | ");

      const randomMemory =
        memories.length > 0
          ? memories[Math.floor(Math.random() * memories.length)]
          : null;
      const memorySnippet = randomMemory
        ? `Cherished Milestone: "${randomMemory.title}" (${randomMemory.date})`
        : "";

      const upcomingDate = keyDates.length > 0 ? keyDates[0] : null;
      const keyDateSnippet = upcomingDate
        ? `Upcoming Date: "${upcomingDate.title}" on ${upcomingDate.date}`
        : "";

      const contextParts = [
        recentChatExcerpts ? `Recent Chat Topics: ${recentChatExcerpts}` : "",
        memorySnippet,
        keyDateSnippet,
      ]
        .filter(Boolean)
        .join("\n");

      const res = await dailyAiConversationPrompt({
        pastChatHistory: contextParts.length > 0 ? contextParts : undefined,
      });

      const newQuestion = res.prompt;
      const sparkRef = doc(firestore, "sparks", todayDateStr);

      await setDoc(
        sparkRef,
        {
          id: todayDateStr,
          date: todayDateStr,
          question: newQuestion,
          answers: {},
          revealed: false,
          savedToMemories: false,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      toast({
        title: "Today's Love Spark is Ready! ✨",
        description: "Answer the question to start today's ritual.",
      });
    } catch (err) {
      console.error("Failed to generate spark:", err);
      // Fallback
      const sparkRef = doc(firestore, "sparks", todayDateStr);
      await setDoc(
        sparkRef,
        {
          id: todayDateStr,
          date: todayDateStr,
          question: "What is one little thing I did recently that secretly made your day? 💕",
          answers: {},
          revealed: false,
          savedToMemories: false,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Submit my answer
  const handleSubmitAnswer = async () => {
    if (!firestore || !sparkData || !myAnswerText.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const sparkRef = doc(firestore, "sparks", todayDateStr);
      await updateDoc(sparkRef, {
        [`answers.${myId}`]: {
          text: myAnswerText.trim(),
          answeredAt: serverTimestamp(),
        },
      });

      setMyAnswerText("");
      toast({
        title: "Answer Sealed with Love 🔒",
        description: "Your answer is locked until both of you answer!",
      });
    } catch (err) {
      console.error("Failed to submit spark answer:", err);
      toast({
        variant: "destructive",
        title: "Submission Error",
        description: "Could not save your answer. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const myAnswer = sparkData?.answers?.[myId];
  const partnerAnswer = sparkData?.answers?.[partnerId];
  const hasMyAnswer = Boolean(myAnswer?.text);
  const hasPartnerAnswer = Boolean(partnerAnswer?.text);
  const isRevealed = sparkData?.revealed || (hasMyAnswer && hasPartnerAnswer);

  return (
    <div className="w-full relative overflow-hidden rounded-3xl border border-pink-500/25 bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-indigo-500/10 p-4 sm:p-6 backdrop-blur-xl shadow-xl">
      {/* Background ambient glow */}
      <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-pink-500/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-44 h-44 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />

      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-pink-500/25 shrink-0">
            <SparklesSvg className="w-5 h-5 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-headline font-bold text-base sm:text-lg text-foreground truncate">
                Daily Love Spark
              </h3>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/30 shrink-0">
                Daily Ritual
              </span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              {format(new Date(), "EEEE, MMMM d")}
            </p>
          </div>
        </div>

        {/* Status Pill */}
        {sparkData && (
          <div className="text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0 bg-background/80 border border-border shadow-xs">
            {isRevealed ? (
              <>
                <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Revealed ✨</span>
              </>
            ) : hasMyAnswer ? (
              <>
                <Lock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="text-amber-400 font-medium">Waiting for {partnerName}</span>
              </>
            ) : hasPartnerAnswer ? (
              <>
                <Clock className="w-3.5 h-3.5 text-blue-400 animate-bounce" />
                <span className="text-blue-400 font-medium">{partnerName} answered!</span>
              </>
            ) : (
              <>
                <Clock className="w-3.5 h-3.5 text-pink-400" />
                <span className="text-pink-400 font-medium">Unanswered</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* STATE 1: No Spark generated yet today */}
      {!sparkData && (
        <div className="text-center py-6 px-4 sm:px-6 bg-background/50 rounded-2xl border border-pink-500/15 shadow-sm space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-pink-500/20 via-rose-500/15 to-purple-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400 shadow-inner">
            <Heart className="w-7 h-7 fill-pink-400/40 animate-pulse" />
          </div>
          <div className="max-w-md mx-auto">
            <h4 className="font-bold text-base sm:text-lg text-foreground">
              Today's Ritual Awaits 💕
            </h4>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              Generate today's personalized couple prompt. You both answer secretly — answers stay sealed until you both submit!
            </p>
          </div>

          <div className="pt-1 flex flex-col items-center gap-2 max-w-sm mx-auto w-full">
            <Button
              onClick={handleGenerateTodaySpark}
              disabled={isGenerating}
              className="w-full sm:w-auto min-h-[50px] h-auto py-3 px-6 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-500 to-purple-600 hover:from-rose-600 hover:to-purple-700 text-white font-bold text-sm sm:text-base shadow-lg shadow-pink-500/30 hover:shadow-pink-500/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
            >
              {isGenerating ? (
                <>
                  <SparklesSvg className="w-5 h-5 animate-spin shrink-0" />
                  <span>Thinking of something romantic...</span>
                </>
              ) : (
                <>
                  <SparklesSvg className="w-5 h-5 shrink-0 animate-pulse" />
                  <span>Start Today's Love Spark</span>
                </>
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground/80 flex items-center justify-center gap-1.5">
              <Lock className="w-3 h-3 text-pink-400 shrink-0" />
              <span>Answers remain hidden until both submit</span>
            </p>
          </div>
        </div>
      )}

      {/* STATE 2: Spark exists */}
      {sparkData && (
        <div className="space-y-4">
          {/* Question Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-background/80 border border-pink-500/25 shadow-sm relative overflow-hidden">
            <div className="flex items-start gap-3">
              <span className="text-2xl select-none leading-none mt-0.5 shrink-0">💬</span>
              <p className="text-base sm:text-lg font-medium text-foreground leading-relaxed">
                {sparkData.question}
              </p>
            </div>
          </div>

          {/* SIMULTANEOUS REVEAL AREA */}
          {isRevealed ? (
            /* BOTH REVEALED */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5 rounded-xl">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> Both answered! Answers revealed ✨
                </span>
                {onOpenMemories && (
                  <button
                    onClick={onOpenMemories}
                    className="hover:underline flex items-center gap-1 text-primary active:scale-95 transition-transform"
                  >
                    View in Memories <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* My Answer */}
                <div className="p-4 rounded-2xl bg-background/85 border border-primary/25 shadow-sm space-y-2">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="w-7 h-7 border border-primary/30">
                      <AvatarImage src={myAvatar} />
                      <AvatarFallback>{myName[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-bold text-foreground">{myName} (You)</span>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed font-sans italic pl-2 border-l-2 border-primary/40">
                    "{myAnswer?.text}"
                  </p>
                </div>

                {/* Partner Answer */}
                <div className="p-4 rounded-2xl bg-background/85 border border-pink-500/25 shadow-sm space-y-2">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="w-7 h-7 border border-pink-500/30">
                      <AvatarImage src={partnerAvatar} />
                      <AvatarFallback>{partnerName[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-bold text-foreground">{partnerName}</span>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed font-sans italic pl-2 border-l-2 border-pink-500/40">
                    "{partnerAnswer?.text}"
                  </p>
                </div>
              </div>

              <p className="text-center text-xs text-muted-foreground pt-1">
                Come back tomorrow for your next ritual question! 🌸
              </p>
            </motion.div>
          ) : hasMyAnswer ? (
            /* YOU ANSWERED, WAITING FOR PARTNER */
            <div className="p-5 rounded-2xl bg-background/70 border border-amber-500/25 text-center space-y-3.5">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Lock className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">
                  Your Answer is Sealed 🔒
                </h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
                  {hasPartnerAnswer
                    ? `${partnerName} just answered! Revealing both answers now...`
                    : `Waiting for ${partnerName} to submit their answer. Both will unlock together so you can read them at the same time!`}
                </p>
              </div>

              {/* Show preview of my own sealed answer */}
              <div className="p-3 bg-muted/40 rounded-xl max-w-md mx-auto text-left border border-border/70">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Your submitted answer:
                </span>
                <p className="text-xs text-foreground/80 italic">"{myAnswer?.text}"</p>
              </div>
            </div>
          ) : (
            /* NOT YET ANSWERED BY YOU */
            <div className="space-y-3">
              {hasPartnerAnswer && (
                <div className="text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3.5 py-2.5 rounded-xl flex items-center gap-2">
                  <Unlock className="w-4 h-4 shrink-0" />
                  <span>{partnerName} has already answered! Submit yours to reveal both 💕</span>
                </div>
              )}

              <div className="space-y-2.5">
                <Textarea
                  value={myAnswerText}
                  onChange={(e) => setMyAnswerText(e.target.value)}
                  placeholder={`Write your secret answer here... (Neither sees the other's answer until both submit)`}
                  className="min-h-[96px] bg-background/90 rounded-2xl border-pink-500/25 focus-visible:ring-pink-500/30 text-base sm:text-sm resize-none p-3.5 leading-relaxed"
                />

                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pt-0.5">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Lock className="w-3 h-3 text-pink-400" /> Sealed until simultaneous reveal
                  </span>
                  <Button
                    onClick={handleSubmitAnswer}
                    disabled={!myAnswerText.trim() || isSubmitting}
                    className="w-full sm:w-auto rounded-xl px-5 h-11 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-pink-500/20 gap-1.5 active:scale-95 transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {isSubmitting ? "Sealing..." : "Submit Answer"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
