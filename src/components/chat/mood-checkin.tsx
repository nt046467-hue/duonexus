
"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface MoodCheckinProps {
  myId: string;
  myMoodToday: string | null;
  partnerMoodToday: string | null;
  partnerName: string;
  onSelectMood: (emoji: string) => void;
}

const MOODS = [
  { emoji: "🥰", label: "Loved" },
  { emoji: "😊", label: "Happy" },
  { emoji: "😌", label: "Calm" },
  { emoji: "😐", label: "Meh" },
  { emoji: "😴", label: "Tired" },
  { emoji: "😔", label: "Sad" },
  { emoji: "🤩", label: "Excited" },
  { emoji: "😭", label: "Emotional" },
];

export function MoodCheckin({
  myMoodToday,
  partnerMoodToday,
  partnerName,
  onSelectMood,
}: MoodCheckinProps) {
  const [dismissed, setDismissed] = useState(false);
  const [selected, setSelected] = useState<string | null>(myMoodToday);

  useEffect(() => {
    setSelected(myMoodToday);
  }, [myMoodToday]);

  const handleSelect = (emoji: string) => {
    setSelected(emoji);
    onSelectMood(emoji);
    setTimeout(() => setDismissed(true), 800);
  };

  // Don't show if already dismissed this session or already set today
  if (dismissed) return null;
  if (myMoodToday) return null;

  return (
    <div className="mx-4 mt-2 p-3 bg-card border border-primary/10 rounded-2xl relative animate-in slide-in-from-top-3 duration-300 shadow-sm">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2.5 right-2.5 text-muted-foreground/60 hover:text-primary transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <p className="text-[10px] font-headline uppercase tracking-widest text-primary mb-2">
        How are you feeling today?
      </p>

      <div className="flex items-center gap-1 flex-wrap">
        {MOODS.map(({ emoji, label }) => (
          <button
            key={emoji}
            onClick={() => handleSelect(emoji)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all text-[10px] font-headline",
              selected === emoji
                ? "bg-primary/15 scale-110 border border-primary/30"
                : "hover:bg-primary/8 hover:scale-105 active:scale-95"
            )}
          >
            <span className="text-lg leading-none">{emoji}</span>
            <span className="text-muted-foreground opacity-60 uppercase tracking-wider">
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Small mood badges shown in the header for both users */
export function MoodBadges({
  myMood,
  partnerMood,
  partnerName,
}: {
  myMood: string | null;
  partnerMood: string | null;
  partnerName: string;
}) {
  if (!myMood && !partnerMood) return null;

  return (
    <div className="flex items-center gap-1.5">
      {partnerMood && (
        <span
          title={`${partnerName}'s mood today`}
          className="text-base leading-none cursor-default select-none hover:scale-125 transition-transform"
        >
          {partnerMood}
        </span>
      )}
      {myMood && (
        <span
          title="Your mood today"
          className="text-base leading-none cursor-default select-none hover:scale-125 transition-transform opacity-60"
        >
          {myMood}
        </span>
      )}
    </div>
  );
}
