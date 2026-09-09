"use client";

import { useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Video } from "lucide-react";
import { startRingtone, stopRingtone } from "@/lib/callAudio";

interface IncomingCallProps {
  partnerName: string;
  partnerAvatar: string;
  callType: "audio" | "video";
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingCall({
  partnerName,
  partnerAvatar,
  callType,
  onAccept,
  onDecline,
}: IncomingCallProps) {
  // Start incoming ringtone on mount, stop unconditionally on unmount
  useEffect(() => {
    startRingtone();
    return () => {
      stopRingtone();
    };
  }, []);

  const handleDecline = () => {
    stopRingtone();
    onDecline();
  };

  const handleAccept = () => {
    stopRingtone();
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-xl flex flex-col items-center justify-between py-24 px-6 text-white safe-top safe-bottom animate-fade-in">
      {/* Caller Info */}
      <div className="flex flex-col items-center gap-6 mt-12">
        <div className="relative">
          {/* Subtle Elegance Ring (no obnoxious bouncing) */}
          <span className="absolute -inset-2 rounded-full bg-primary/20 animate-ping opacity-40 scale-110 pointer-events-none" />
          <Avatar className="w-28 h-28 border-4 border-primary/30 shadow-2xl">
            <AvatarImage src={partnerAvatar} className="object-cover" />
            <AvatarFallback className="bg-primary/15 text-primary text-4xl font-headline font-bold">
              {partnerName?.[0]?.toUpperCase() || "P"}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-2xl font-headline font-bold tracking-tight">{partnerName}</h2>
          <p className="text-xs uppercase tracking-widest text-primary font-headline font-semibold">
            Incoming {callType === "video" ? "Video Call" : "Audio Call"}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-14 mb-8">
        {/* Decline */}
        <div className="flex flex-col items-center gap-3">
          <Button
            onClick={handleDecline}
            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/30 flex items-center justify-center transition-transform active:scale-95"
            aria-label="Decline Call"
          >
            <PhoneOff className="w-6 h-6" />
          </Button>
          <span className="text-[10px] font-headline uppercase tracking-widest text-muted-foreground font-medium">Decline</span>
        </div>

        {/* Accept */}
        <div className="flex flex-col items-center gap-3">
          <Button
            onClick={handleAccept}
            className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/30 flex items-center justify-center transition-transform active:scale-95 hover:scale-105"
            aria-label="Accept Call"
          >
            {callType === "video" ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
          </Button>
          <span className="text-[10px] font-headline uppercase tracking-widest text-muted-foreground font-medium">Accept</span>
        </div>
      </div>
    </div>
  );
}

