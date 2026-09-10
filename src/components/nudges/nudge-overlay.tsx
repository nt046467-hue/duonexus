"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, X } from "lucide-react";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp,
  Firestore,
  orderBy,
  limit,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface NudgeItem {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  emoji: string;
  timestamp?: any;
  read?: boolean;
}

interface NudgeOverlayProps {
  firestore: Firestore | null;
  myId: string;
  partnerId: string;
  myName: string;
  partnerName: string;
  partnerAvatar?: string;
}

export function NudgeOverlay({
  firestore,
  myId,
  partnerId,
  myName,
  partnerName,
  partnerAvatar,
}: NudgeOverlayProps) {
  const [activeNudge, setActiveNudge] = useState<NudgeItem | null>(null);
  const chimeAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Pleasant notification chime
    chimeAudioRef.current = new Audio(
      "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"
    );
  }, []);

  useEffect(() => {
    if (!firestore || !myId) return;

    // Listen for incoming unread nudges for me
    const nudgesRef = collection(firestore, "nudges");
    const q = query(
      nudgesRef,
      where("recipientId", "==", myId),
      where("read", "==", false),
      limit(1)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const data = { id: docSnap.id, ...docSnap.data() } as NudgeItem;
        setActiveNudge(data);

        // Play subtle gentle chime
        try {
          if (chimeAudioRef.current) {
            chimeAudioRef.current.currentTime = 0;
            chimeAudioRef.current.play().catch(() => {});
          }
        } catch {
          // ignore autoplay restrictions
        }
      } else {
        setActiveNudge(null);
      }
    });

    return () => unsub();
  }, [firestore, myId]);

  const handleDismiss = async () => {
    if (!firestore || !activeNudge) return;
    try {
      await updateDoc(doc(firestore, "nudges", activeNudge.id), {
        read: true,
      });
      setActiveNudge(null);
    } catch (err) {
      console.warn("Failed to mark nudge as read:", err);
      setActiveNudge(null);
    }
  };

  const handleNudgeBack = async () => {
    if (!firestore || !activeNudge) return;
    try {
      // Mark received as read
      await updateDoc(doc(firestore, "nudges", activeNudge.id), {
        read: true,
      });

      // Send reciprocal nudge
      await addDoc(collection(firestore, "nudges"), {
        senderId: myId,
        recipientId: partnerId,
        text: "Thinking of you too 💕",
        emoji: "🥰",
        timestamp: serverTimestamp(),
        read: false,
      });

      setActiveNudge(null);
    } catch (err) {
      console.warn("Failed to send nudge back:", err);
      setActiveNudge(null);
    }
  };

  if (!activeNudge) return null;

  return (
    <AnimatePresence>
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] max-w-sm w-[92%] sm:w-full pointer-events-auto select-none">
        <motion.div
          initial={{ opacity: 0, y: -40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="relative p-4 rounded-3xl bg-card/95 backdrop-blur-2xl border border-pink-500/30 shadow-2xl shadow-pink-500/20 overflow-hidden flex items-center justify-between gap-3"
        >
          {/* Ambient particle glow */}
          <div className="absolute -top-6 -left-6 w-24 h-24 bg-pink-500/20 rounded-full blur-xl pointer-events-none" />
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-purple-500/20 rounded-full blur-xl pointer-events-none" />

          {/* Avatar & Message */}
          <div className="flex items-center gap-3 min-w-0 z-10">
            <div className="relative">
              <Avatar className="w-11 h-11 border-2 border-pink-500/40 shadow-sm">
                <AvatarImage src={partnerAvatar} />
                <AvatarFallback>{partnerName[0]}</AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-1 -right-1 text-base leading-none">
                {activeNudge.emoji || "💭"}
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold font-headline text-foreground truncate">
                  {partnerName} poked you!
                </h4>
                <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500 animate-pulse shrink-0" />
              </div>
              <p className="text-sm font-medium text-pink-400 truncate mt-0.5">
                "{activeNudge.text}"
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0 z-10">
            <Button
              size="sm"
              onClick={handleNudgeBack}
              className="h-8 rounded-xl px-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-pink-500/20 gap-1"
            >
              <span>Nudge Back</span>
              <span>💕</span>
            </Button>
            <button
              onClick={handleDismiss}
              className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
