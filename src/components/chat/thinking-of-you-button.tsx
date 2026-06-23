
"use client";

import { useState, useEffect, useRef } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThinkingOfYouButtonProps {
  onTap: () => void;
  cooldownSeconds?: number;
}

interface HeartParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  rotation: number;
  duration: number;
}

export function ThinkingOfYouButton({
  onTap,
  cooldownSeconds = 600,
}: ThinkingOfYouButtonProps) {
  const [particles, setParticles] = useState<HeartParticle[]>([]);
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [isPressed, setIsPressed] = useState(false);

  // Load cooldown from localStorage on mount
  useEffect(() => {
    const lastTap = localStorage.getItem("duonexus_nudge_last");
    if (lastTap) {
      const diff = (Date.now() - parseInt(lastTap)) / 1000;
      if (diff < cooldownSeconds) {
        setIsCoolingDown(true);
        setCooldownRemaining(Math.ceil(cooldownSeconds - diff));
      }
    }
  }, [cooldownSeconds]);

  // Countdown timer
  useEffect(() => {
    if (!isCoolingDown) return;
    const interval = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsCoolingDown(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isCoolingDown]);

  const handleTap = () => {
    if (isCoolingDown) return;

    // Burst animation
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 300);

    const newParticles: HeartParticle[] = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      x: (Math.random() - 0.5) * 160,
      y: -(40 + Math.random() * 120),
      size: 12 + Math.random() * 20,
      rotation: (Math.random() - 0.5) * 60,
      duration: 0.8 + Math.random() * 0.6,
    }));
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 1500);

    // Cooldown
    localStorage.setItem("duonexus_nudge_last", Date.now().toString());
    setIsCoolingDown(true);
    setCooldownRemaining(cooldownSeconds);

    onTap();
  };

  const formatCooldown = (s: number) => {
    if (s >= 60) return `${Math.ceil(s / 60)}m`;
    return `${s}s`;
  };

  return (
    <div className="relative flex items-center justify-center">
      {/* Floating heart particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute pointer-events-none"
          style={{
            animation: `heartFloat ${p.duration}s ease-out forwards`,
            transform: `translate(${p.x}px, 0px) rotate(${p.rotation}deg)`,
          }}
        >
          <Heart
            style={{ width: p.size, height: p.size }}
            className="text-primary fill-primary"
          />
        </div>
      ))}

      <button
        onClick={handleTap}
        disabled={isCoolingDown}
        className={cn(
          "relative w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-200",
          "bg-gradient-to-br from-primary to-pink-400",
          "hover:shadow-primary/40 hover:shadow-2xl",
          isPressed && "scale-90",
          !isPressed && !isCoolingDown && "hover:scale-110 active:scale-95",
          isCoolingDown && "opacity-60 cursor-not-allowed"
        )}
        title={
          isCoolingDown
            ? `Available in ${formatCooldown(cooldownRemaining)}`
            : "Send a thinking-of-you nudge ❤️"
        }
      >
        {/* Subtle pulse ring — only when not cooling down */}
        {!isCoolingDown && (
          <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-40 scale-90" />
        )}
        <Heart
          className={cn(
            "w-5 h-5 text-white transition-all",
            isPressed ? "fill-white scale-125" : "fill-white/80"
          )}
        />
        {isCoolingDown && (
          <span className="absolute -bottom-5 text-[8px] font-headline text-primary/70 whitespace-nowrap">
            {formatCooldown(cooldownRemaining)}
          </span>
        )}
      </button>

      <style jsx>{`
        @keyframes heartFloat {
          0% {
            opacity: 1;
            transform: translate(var(--tx, 0px), 0px) rotate(var(--r, 0deg)) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(var(--tx, 0px), var(--ty, -80px))
              rotate(var(--r, 0deg)) scale(0.5);
          }
        }
      `}</style>
    </div>
  );
}

/** Full-screen heart burst shown when your partner nudges you */
export function HeartBurstOverlay({ onDismiss }: { onDismiss: () => void }) {
  const [visible, setVisible] = useState(true);
  const hearts = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.5,
    size: 20 + Math.random() * 40,
    duration: 1.5 + Math.random() * 1,
  }));

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none"
      onClick={() => {
        setVisible(false);
        onDismiss();
      }}
    >
      {/* Floating hearts */}
      {hearts.map((h) => (
        <div
          key={h.id}
          className="absolute bottom-0 animate-bounce"
          style={{
            left: `${h.x}%`,
            animationDelay: `${h.delay}s`,
            animationDuration: `${h.duration}s`,
            animation: `riseUp ${h.duration}s ${h.delay}s ease-out forwards`,
          }}
        >
          <Heart
            style={{ width: h.size, height: h.size }}
            className="text-primary fill-primary drop-shadow-lg"
          />
        </div>
      ))}

      {/* Center message */}
      <div className="bg-background/90 backdrop-blur-xl rounded-[2.5rem] px-10 py-8 flex flex-col items-center gap-3 shadow-2xl border border-primary/10 animate-in zoom-in-50 duration-300">
        <Heart className="w-16 h-16 text-primary fill-primary animate-pulse" />
        <p className="font-headline text-xl font-bold tracking-tight text-center">
          Thinking of you 💕
        </p>
        <p className="text-xs text-muted-foreground text-center">
          Your partner is sending you love right now.
        </p>
      </div>

      <style jsx>{`
        @keyframes riseUp {
          0% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) scale(0.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
