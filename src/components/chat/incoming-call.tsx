"use client";

import { useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Video } from "lucide-react";
import { startRingtone, stopRingtone, playEndedBeep } from "@/lib/callAudio";

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
  // Start Messenger-style melodic ringtone on mount, stop on unmount
  useEffect(() => {
    startRingtone();
    return () => stopRingtone();
  }, []);

  const handleDecline = () => {
    stopRingtone();
    playEndedBeep();
    onDecline();
  };

  const handleAccept = () => {
    stopRingtone();
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex flex-col items-center justify-between py-24 px-6 text-white safe-top safe-bottom">
      {/* Caller Info */}
      <div className="flex flex-col items-center gap-6 mt-12">
        <div className="relative">
          {/* Pulsating Ring */}
          <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-70 scale-125" />
          <span className="absolute inset-0 rounded-full bg-primary/10 animate-pulse opacity-40 scale-150" />
          
          <Avatar className="w-28 h-28 border-4 border-primary/20 shadow-2xl">
            <AvatarImage src={partnerAvatar} className="object-cover" />
            <AvatarFallback className="bg-primary/15 text-primary text-4xl font-headline font-bold">
              {partnerName?.[0]?.toUpperCase() || "P"}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-2xl font-headline font-bold tracking-tight">{partnerName}</h2>
          <p className="text-xs uppercase tracking-widest text-primary font-headline animate-pulse font-semibold">
            Incoming {callType === "video" ? "Video Call" : "Audio Call"}...
          </p>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-12 mb-8">
        {/* Decline */}
        <div className="flex flex-col items-center gap-3">
          <Button
            onClick={handleDecline}
            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/30 flex items-center justify-center transition-transform active:scale-95"
            aria-label="Decline Call"
          >
            <PhoneOff className="w-6 h-6" />
          </Button>
          <span className="text-[10px] font-headline uppercase tracking-widest text-muted-foreground">Decline</span>
        </div>

        {/* Accept */}
        <div className="flex flex-col items-center gap-3">
          <Button
            onClick={handleAccept}
            className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-600/30 flex items-center justify-center transition-transform active:scale-95 animate-bounce"
            aria-label="Accept Call"
          >
            {callType === "video" ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
          </Button>
          <span className="text-[10px] font-headline uppercase tracking-widest text-muted-foreground">Accept</span>
        </div>
      </div>
    </div>
  );
}
