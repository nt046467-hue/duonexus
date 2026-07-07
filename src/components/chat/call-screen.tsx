"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  PhoneOff,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { startDialTone, stopDialTone, stopRingtone, playConnectedChime, playEndedBeep } from "@/lib/callAudio";


interface CallScreenProps {
  partnerName: string;
  partnerAvatar: string;
  callType: "audio" | "video";
  callState: "idle" | "ringing" | "connecting" | "active" | "ended" | "declined" | "missed";
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onHangUp: () => void;
}

const FILTERS = [
  { id: "none", label: "Normal", class: "" },
  { id: "warm", label: "Warm Love", class: "sepia-[0.3] saturate-[1.2] hue-rotate-[-10deg]" },
  { id: "vintage", label: "Vintage", class: "contrast-[0.85] brightness-[1.1] sepia-[0.25]" },
  { id: "soft", label: "Soft Glow", class: "contrast-[0.9] brightness-[1.05] blur-[0.3px]" },
  { id: "bw", label: "Classic B&W", class: "grayscale contrast-[1.1] brightness-[0.95]" },
];

export function CallScreen({
  partnerName,
  partnerAvatar,
  callType,
  callState,
  localStream,
  remoteStream,
  onHangUp,
}: CallScreenProps) {
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(callType === "audio");
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [activeFilter, setActiveFilter] = useState("none");
  const [showFilters, setShowFilters] = useState(false);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Call timer (only when active)
  useEffect(() => {
    if (callState !== "active") return;
    const interval = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callState]);

  // Outgoing dial tone when ringing (ensures full clean up)
  useEffect(() => {
    if (callState === "ringing") {
      startDialTone();
    } else {
      stopDialTone();
    }
    return () => {
      stopDialTone();
      stopRingtone();
    };
  }, [callState]);

  // Connected chime — fires once when call transitions to active
  const prevCallStateRef = useRef<string>(callState);
  useEffect(() => {
    if (prevCallStateRef.current !== "active" && callState === "active") {
      playConnectedChime();
    }
    prevCallStateRef.current = callState;
  }, [callState]);

  // Dynamically check if remote peer has active/unmuted video track
  useEffect(() => {
    if (!remoteStream) {
      setRemoteHasVideo(false);
      return;
    }
    const checkVideo = () => {
      const videoTrack = remoteStream.getVideoTracks()[0];
      setRemoteHasVideo(!!videoTrack && videoTrack.enabled && videoTrack.readyState === "live" && !videoTrack.muted);
    };
    checkVideo();

    const tracks = remoteStream.getVideoTracks();
    tracks.forEach((track) => {
      track.onmute = checkVideo;
      track.onunmute = checkVideo;
      track.onended = checkVideo;
    });

    const interval = setInterval(checkVideo, 1000);
    return () => {
      clearInterval(interval);
      tracks.forEach((track) => {
        track.onmute = null;
        track.onunmute = null;
        track.onended = null;
      });
    };
  }, [remoteStream]);

  // Connect local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isCamOff]);

  // Connect remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream && remoteHasVideo) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, remoteHasVideo]);

  // Mute local tracks
  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  // Toggle camera
  const toggleCam = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsCamOff(!isCamOff);
    }
  };

  const formatDuration = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const currentFilterClass = FILTERS.find((f) => f.id === activeFilter)?.class || "";

  // The call layout becomes a video call if either side turns on video or it was initiated as video
  const isShowingVideo = callType === "video" || !isCamOff || remoteHasVideo;

  return (
    <div className="fixed inset-0 z-[250] bg-zinc-950 flex flex-col justify-between text-white safe-top safe-bottom select-none">
      
      {/* ── AUDIO CALL VIEW ── */}
      {!isShowingVideo && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 mt-12">
          <Avatar className="w-32 h-32 border-4 border-primary/20 shadow-2xl animate-pulse">
            <AvatarImage src={partnerAvatar} className="object-cover" />
            <AvatarFallback className="bg-primary/15 text-primary text-5xl font-headline font-bold">
              {partnerName?.[0]?.toUpperCase() || "P"}
            </AvatarFallback>
          </Avatar>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-headline font-bold">{partnerName}</h2>
            <p className="text-sm text-muted-foreground uppercase tracking-widest font-headline">
              {callState === "active" ? formatDuration(duration) : "Connecting..."}
            </p>
          </div>
        </div>
      )}

      {/* ── VIDEO CALL VIEW ── */}
      {isShowingVideo && (
        <div className="absolute inset-0 z-0 bg-black overflow-hidden animate-fade-in">
          {/* Remote Video (Fullscreen) or Placeholder */}
          {remoteStream && remoteHasVideo ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={cn(
                "w-full h-full object-cover transition-all duration-300",
                currentFilterClass
              )}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 gap-4">
              <Avatar className="w-24 h-24 border border-white/10 shadow-2xl">
                <AvatarImage src={partnerAvatar} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-primary text-3xl font-headline font-bold">
                  {partnerName?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p className="text-xs font-headline uppercase tracking-widest text-muted-foreground/60">
                {partnerName}'s camera is off
              </p>
            </div>
          )}

          {/* Draggable Picture-in-Picture Local Preview */}
          {localStream && !isCamOff && (
            <div className="absolute top-16 right-4 w-28 aspect-[3/4] rounded-2xl overflow-hidden border border-white/15 shadow-2xl z-20">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover [transform:scaleX(-1)]"
              />
            </div>
          )}
        </div>
      )}

      {/* Header (Top Info Overlay) for Video Call */}
      {isShowingVideo && callState === "active" && (
        <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-headline font-bold text-sm">{partnerName}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
              {formatDuration(duration)}
            </span>
          </div>
          {/* Filters trigger */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors",
              showFilters && "bg-primary text-primary-foreground"
            )}
          >
            <Sparkles className="w-5 h-5" />
          </Button>
        </div>
      )}

      {/* ── COLOR FILTERS BAR ── */}
      {isShowingVideo && showFilters && (
        <div className="absolute bottom-28 left-0 right-0 z-30 px-4 py-3 bg-black/75 backdrop-blur-md flex items-center gap-3 overflow-x-auto scrollbar-hide border-y border-white/5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-headline uppercase tracking-wider border shrink-0 transition-all active:scale-95",
                activeFilter === f.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white/10 text-white border-transparent hover:bg-white/20"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* ── CALL CONTROLS BAR ── */}
      <div className="absolute bottom-6 left-0 right-0 z-10 px-6 flex items-center justify-center gap-4">
        {/* Toggle Audio (Mute) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMute}
          className={cn(
            "w-12 h-12 rounded-full border border-white/10 text-white hover:bg-white/10",
            isMuted ? "bg-red-600/35 hover:bg-red-600/40 text-red-400 border-red-500/20" : "bg-white/10"
          )}
          aria-label="Toggle Microphone"
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>

        {/* Toggle Video (Camera Off/On) - Always visible so user can upgrade voice to video */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCam}
          className={cn(
            "w-12 h-12 rounded-full border border-white/10 text-white hover:bg-white/10",
            isCamOff ? "bg-red-600/35 hover:bg-red-600/40 text-red-400 border-red-500/20" : "bg-white/10"
          )}
          aria-label="Toggle Camera"
        >
          {isCamOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </Button>

        {/* Speaker Toggle (Audio Call only) */}
        {!isShowingVideo && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            className={cn(
              "w-12 h-12 rounded-full border border-white/10 text-white hover:bg-white/10",
              !isSpeakerOn ? "bg-red-600/35 hover:bg-red-600/40 text-red-400 border-red-500/20" : "bg-white/10"
            )}
            aria-label="Toggle Speaker"
          >
            {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </Button>
        )}

        {/* Hang Up */}
        <Button
          onClick={() => {
            stopDialTone();
            stopRingtone();
            playEndedBeep();
            onHangUp();
          }}
          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/30 flex items-center justify-center transition-transform active:scale-95"
          aria-label="Hang Up Call"
        >
          <PhoneOff className="w-6 h-6" />
        </Button>
      </div>

    </div>
  );
}

