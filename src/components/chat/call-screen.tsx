"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
  Heart,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConnectionQuality } from "@/hooks/use-webrtc";

interface CallScreenProps {
  partnerName: string;
  partnerAvatar: string;
  callType: "audio" | "video";
  /** Full authoritative call state from useWebRTC */
  callState: "idle" | "ringing" | "connecting" | "active" | "ended" | "declined" | "missed" | "failed";
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionQuality?: ConnectionQuality;
  /** End/hang-up during active call */
  onHangUp: () => void;
  /** Cancel outgoing call while ringing (caller only) */
  onCancel?: () => void;
  onGenerateSpark?: () => Promise<string | undefined>;
  onSwitchCamera?: () => void;
  onToggleVideo?: () => void;
  isVideoEnabled?: boolean;
  isPartnerVideoEnabled?: boolean;
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
  connectionQuality = "excellent",
  onHangUp,
  onCancel,
  onGenerateSpark,
  onSwitchCamera,
  onToggleVideo,
  isVideoEnabled,
  isPartnerVideoEnabled,
}: CallScreenProps) {
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(() => {
    if (typeof isVideoEnabled === "boolean") return !isVideoEnabled;
    if (!localStream) return callType === "audio";
    const vTracks = localStream.getVideoTracks();
    return vTracks.length === 0 || !vTracks.some((t) => t.enabled);
  });
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [audioAutoplayBlocked, setAudioAutoplayBlocked] = useState(false);

  // Sync isCamOff with localStream video tracks and isVideoEnabled prop
  useEffect(() => {
    if (typeof isVideoEnabled === "boolean") {
      setIsCamOff(!isVideoEnabled);
      return;
    }
    if (!localStream) {
      setIsCamOff(callType === "audio");
      return;
    }
    const vTracks = localStream.getVideoTracks();
    if (vTracks.length === 0) {
      setIsCamOff(true);
    } else {
      setIsCamOff(!vTracks.some((t) => t.enabled));
    }
  }, [localStream, callType, isVideoEnabled]);

  const [activeFilter, setActiveFilter] = useState("none");
  const [showFilters, setShowFilters] = useState(false);
  const [sparkPrompt, setSparkPrompt] = useState<string | null>(null);
  const [isLoadingSpark, setIsLoadingSpark] = useState(false);
  const sparkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const isOutgoingRinging = callState === "ringing";
  const isConnecting = callState === "connecting";
  const isMissedOrFailed = callState === "missed" || callState === "failed";
  const isActive = callState === "active";

  // Call duration timer (active call only)
  useEffect(() => {
    if (callState !== "active") return;
    const interval = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callState]);

  // Reset duration counter on fresh call
  useEffect(() => {
    if (callState === "ringing" || callState === "connecting") {
      setDuration(0);
    }
  }, [callState]);

  // Check if remote stream has active video tracks
  const hasRemoteVideoTrack = Boolean(
    remoteStream &&
    remoteStream.getVideoTracks().length > 0 &&
    remoteStream.getVideoTracks().some((t) => t.enabled && t.readyState !== "ended")
  );

  const isPartnerShowingVideo = callType === "video" && (
    hasRemoteVideoTrack ||
    (typeof isPartnerVideoEnabled === "boolean" && isPartnerVideoEnabled) ||
    Boolean(remoteStream && remoteStream.getVideoTracks().length > 0)
  );

  const isShowingVideo = callType === "video" || !isCamOff || isPartnerShowingVideo;

  // ── Helper: Attach Local Stream ─────────────────────────────────────────────
  // IMPORTANT: Only pass VIDEO tracks to the local <video> preview.
  // Never put audio tracks in a <video> element — it would loop the mic back to the speaker.
  const attachLocalStream = useCallback((videoEl: HTMLVideoElement | null) => {
    localVideoRef.current = videoEl;
    if (videoEl && localStream && !isCamOff) {
      // Strip audio so the local mic is NEVER audible on the local device
      const videoOnlyStream = new MediaStream(localStream.getVideoTracks());
      videoEl.srcObject = videoOnlyStream;
      videoEl.muted = true;
      videoEl.defaultMuted = true;
      videoEl.play().catch(() => { });
    } else if (videoEl) {
      videoEl.srcObject = null;
    }
  }, [localStream, isCamOff]);

  // ── Helper: Attach Remote Video Stream ──────────────────────────────────────
  // CRITICAL: Only pass VIDEO tracks here. The full remoteStream contains both
  // audio+video — assigning it to <video> even with muted=true can still cause
  // mobile browsers (WebKit/Chrome) to decode and render audio, producing an echo
  // when the dedicated <audio> element also plays the same audio track.
  const attachRemoteVideo = useCallback((videoEl: HTMLVideoElement | null) => {
    remoteVideoRef.current = videoEl;
    if (videoEl && remoteStream) {
      const videoOnlyStream = new MediaStream(remoteStream.getVideoTracks());
      videoEl.muted = true;
      videoEl.defaultMuted = true;
      videoEl.srcObject = videoOnlyStream;
      videoEl.play().catch(() => { });
    } else if (videoEl) {
      videoEl.srcObject = null;
    }
  }, [remoteStream]);

  // ── Helper: Attach Remote Audio Stream ──────────────────────────────────────
  // Only audio tracks go here — this is the single source of remote audio output.
  const attachRemoteAudio = useCallback((audioEl: HTMLAudioElement | null) => {
    remoteAudioRef.current = audioEl;
    if (audioEl && remoteStream) {
      // Strictly audio-only so there is zero chance of a second video-element
      // rendering audio in parallel.
      const audioOnlyStream = new MediaStream(remoteStream.getAudioTracks());
      audioEl.volume = 1.0;
      audioEl.muted = false;
      audioEl.srcObject = audioOnlyStream;
      const p = audioEl.play();
      if (p !== undefined) {
        p.then(() => setAudioAutoplayBlocked(false)).catch(() => {
          setAudioAutoplayBlocked(true);
        });
      }
    } else if (audioEl) {
      audioEl.srcObject = null;
    }
  }, [remoteStream]);

  // Synchronize local preview whenever localStream, isCamOff, or callState changes
  useEffect(() => {
    attachLocalStream(localVideoRef.current);
  }, [localStream, isCamOff, callState, attachLocalStream]);

  // Synchronize remote video whenever remoteStream, isPartnerShowingVideo, or callState changes
  useEffect(() => {
    attachRemoteVideo(remoteVideoRef.current);
  }, [remoteStream, isPartnerShowingVideo, callState, attachRemoteVideo]);

  // Synchronize remote audio whenever remoteStream or callState changes
  useEffect(() => {
    attachRemoteAudio(remoteAudioRef.current);
  }, [remoteStream, callState, attachRemoteAudio]);

  // Global touch/click unlock for mobile audio autoplay
  useEffect(() => {
    const handleInteractionUnlock = () => {
      const audioEl = remoteAudioRef.current;
      if (audioEl && audioEl.paused && remoteStream) {
        audioEl
          .play()
          .then(() => setAudioAutoplayBlocked(false))
          .catch(() => { });
      }
    };
    window.addEventListener("pointerdown", handleInteractionUnlock);
    window.addEventListener("touchstart", handleInteractionUnlock);
    window.addEventListener("click", handleInteractionUnlock);

    return () => {
      window.removeEventListener("pointerdown", handleInteractionUnlock);
      window.removeEventListener("touchstart", handleInteractionUnlock);
      window.removeEventListener("click", handleInteractionUnlock);
    };
  }, [remoteStream]);

  // Toggle microphone mute
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
    if (onToggleVideo) {
      onToggleVideo();
    } else if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsCamOff((prev) => !prev);
    }
  };

  // Speaker toggle for audio calls
  const toggleSpeaker = async () => {
    if (!remoteAudioRef.current) return;
    const isSinkIdSupported = typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

    if (isSinkIdSupported) {
      try {
        const audioEl = remoteAudioRef.current as any;
        if (isSpeakerOn) {
          await audioEl.setSinkId("");
          setIsSpeakerOn(false);
        } else {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const outputDevices = devices.filter((d) => d.kind === "audiooutput");
          const targetDevice = outputDevices.find((d) => d.deviceId !== "default") || outputDevices[0];
          if (targetDevice) {
            await audioEl.setSinkId(targetDevice.deviceId);
          }
          setIsSpeakerOn(true);
        }
      } catch {
        setIsSpeakerOn(!isSpeakerOn);
      }
    } else {
      setIsSpeakerOn(!isSpeakerOn);
    }
  };

  const formatDuration = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const currentFilterClass = FILTERS.find((f) => f.id === activeFilter)?.class || "";

  // Render minimal connection quality badge
  const renderQualityIndicator = () => {
    switch (connectionQuality) {
      case "excellent":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-[10px] font-headline font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            HD
          </span>
        );
      case "good":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400/90 text-[10px] font-headline">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Good
          </span>
        );
      case "fair":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/20 text-amber-400 text-[10px] font-headline">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Fair
          </span>
        );
      case "poor":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-headline font-semibold animate-pulse">
            <WifiOff className="w-3 h-3" />
            Weak
          </span>
        );
    }
  };

  // Auto-dismiss screen on "No answer" or "failed" after 4 seconds if untouched
  useEffect(() => {
    if (isMissedOrFailed) {
      const timer = setTimeout(() => {
        onHangUp();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isMissedOrFailed, onHangUp]);

  return (
    <div className="fixed inset-0 z-[250] bg-zinc-950 flex flex-col justify-between text-white safe-top safe-bottom select-none">
      {/* Permanent audio element — always in DOM tree so audio streams never pause or drop */}
      <audio
        ref={attachRemoteAudio}
        autoPlay
        playsInline
        aria-hidden="true"
        style={{
          position: "fixed",
          top: "-9999px",
          left: "-9999px",
          width: "1px",
          height: "1px",
          opacity: 0.01,
          pointerEvents: "none",
        }}
      />

      {/* ── OUTGOING RINGING / CONNECTING / NO ANSWER OVERLAY ── */}
      {(isOutgoingRinging || isConnecting || isMissedOrFailed) && (
        <div className="absolute inset-0 z-50 bg-zinc-950 flex flex-col items-center justify-between py-24 px-6 text-white safe-top safe-bottom select-none animate-fade-in">
          <div className="flex flex-col items-center gap-6 mt-12">
            <div className="relative">
              {isOutgoingRinging && (
                <span className="absolute -inset-3 rounded-full bg-primary/15 animate-ping opacity-30 scale-110 pointer-events-none" />
              )}
              <Avatar className="w-28 h-28 border-4 border-primary/20 shadow-2xl">
                <AvatarImage src={partnerAvatar} className="object-cover" />
                <AvatarFallback className="bg-primary/15 text-primary text-4xl font-headline font-bold">
                  {partnerName?.[0]?.toUpperCase() || "P"}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-2xl font-headline font-bold tracking-tight">{partnerName}</h2>
              {isOutgoingRinging && (
                <>
                  <p className="text-sm text-primary/80 uppercase tracking-widest font-headline animate-pulse">Calling…</p>
                  <p className="text-xs text-white/40 font-headline">{callType === "video" ? "Video call" : "Voice call"}</p>
                </>
              )}
              {isConnecting && (
                <p className="text-sm text-emerald-400/80 uppercase tracking-widest font-headline animate-pulse">Connecting…</p>
              )}
              {isMissedOrFailed && (
                <>
                  <p className="text-sm text-red-400 font-headline font-semibold">No answer</p>
                  <p className="text-xs text-white/40 font-headline">Call ended</p>
                </>
              )}
            </div>
          </div>

          <div className="mb-8 flex flex-col items-center gap-3">
            <Button
              onClick={onCancel || onHangUp}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/30 flex items-center justify-center transition-transform active:scale-95"
              aria-label={isMissedOrFailed ? "Close" : "Cancel Call"}
            >
              <PhoneOff className="w-6 h-6" />
            </Button>
            <span className="text-[10px] font-headline uppercase tracking-widest text-muted-foreground font-medium">
              {isMissedOrFailed ? "Close" : "Cancel"}
            </span>
          </div>
        </div>
      )}

      {/* ── ACTIVE / CONNECTED CALL SCREEN ── */}
      {isActive && (
        <>
          {/* Autoplay restriction recovery banner */}
          {audioAutoplayBlocked && (
            <button
              onClick={() => {
                remoteAudioRef.current?.play().then(() => setAudioAutoplayBlocked(false)).catch(() => { });
              }}
              className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-zinc-950 px-4 py-1.5 rounded-full text-xs font-headline font-bold shadow-2xl flex items-center gap-2 hover:bg-amber-400 transition-all active:scale-95"
            >
              <Volume2 className="w-4 h-4" />
              <span>Tap to enable audio</span>
            </button>
          )}

          {/* ── AUDIO CALL VIEW ── */}
          {!isShowingVideo && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 mt-12">
              <Avatar className="w-32 h-32 border-4 border-primary/20 shadow-2xl">
                <AvatarImage src={partnerAvatar} className="object-cover" />
                <AvatarFallback className="bg-primary/15 text-primary text-5xl font-headline font-bold">
                  {partnerName?.[0]?.toUpperCase() || "P"}
                </AvatarFallback>
              </Avatar>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-headline font-bold">{partnerName}</h2>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-sm text-primary/80 uppercase tracking-widest font-headline">
                    {formatDuration(duration)}
                  </p>
                  {renderQualityIndicator()}
                </div>
              </div>
            </div>
          )}

          {/* ── VIDEO CALL VIEW ── */}
          {isShowingVideo && (
            <div className="absolute inset-0 z-0 bg-black overflow-hidden animate-fade-in">
              {/* Remote Video (Fullscreen) or Partner Camera Off Placeholder */}
              {remoteStream && isPartnerShowingVideo ? (
                <video
                  ref={attachRemoteVideo}
                  autoPlay
                  playsInline
                  muted
                  className={cn(
                    "w-full h-full object-cover transition-all duration-300",
                    currentFilterClass
                  )}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/95 backdrop-blur-xl gap-6 animate-fade-in">
                  <div className="relative">
                    <Avatar className="w-32 h-32 border-4 border-white/10 shadow-2xl">
                      <AvatarImage src={partnerAvatar} className="object-cover" />
                      <AvatarFallback className="bg-primary/15 text-primary text-5xl font-headline font-bold">
                        {partnerName?.[0]?.toUpperCase() || "P"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-2 -right-2 bg-zinc-900 border-2 border-white/20 rounded-full p-2.5 shadow-xl">
                      <VideoOff className="w-5 h-5 text-red-400" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-2xl font-headline font-bold text-white tracking-wide">{partnerName}</h3>
                    <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/10 border border-white/10 text-white/70 text-xs font-headline uppercase tracking-widest">
                      <VideoOff className="w-3.5 h-3.5 text-red-400" />
                      <span>Camera is off</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Picture-in-Picture Local Preview */}
              {localStream && !isCamOff ? (
                <div className="absolute top-16 right-4 w-28 aspect-[3/4] rounded-2xl overflow-hidden border border-white/15 shadow-2xl z-20 transition-all duration-300 bg-zinc-900">
                  <video
                    ref={attachLocalStream}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover [transform:scaleX(-1)]"
                  />
                </div>
              ) : isShowingVideo ? (
                <div className="absolute top-16 right-4 w-24 aspect-[3/4] rounded-2xl overflow-hidden border border-white/10 bg-zinc-900/80 backdrop-blur-md shadow-2xl z-20 flex flex-col items-center justify-center p-2 text-center transition-all duration-300">
                  <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center mb-1 border border-red-500/20">
                    <VideoOff className="w-4 h-4 text-red-400" />
                  </div>
                  <span className="text-[10px] text-white/70 font-headline font-medium leading-tight">Your camera off</span>
                </div>
              ) : null}
            </div>
          )}

          {/* Header (Top Info Overlay) for Video Call */}
          {isShowingVideo && (
            <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-headline font-bold text-sm">{partnerName}</span>
                  {renderQualityIndicator()}
                </div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                  {formatDuration(duration)}
                </span>
              </div>

              {/* AI Love Spark trigger */}
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  if (!onGenerateSpark || isLoadingSpark) return;
                  setIsLoadingSpark(true);
                  try {
                    const prompt = await onGenerateSpark();
                    if (prompt) {
                      setSparkPrompt(prompt);
                      if (sparkTimerRef.current) clearTimeout(sparkTimerRef.current);
                      sparkTimerRef.current = setTimeout(() => setSparkPrompt(null), 7000);
                    }
                  } finally {
                    setIsLoadingSpark(false);
                  }
                }}
                className={cn(
                  "w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors",
                  isLoadingSpark && "animate-pulse",
                  sparkPrompt && "bg-primary text-primary-foreground"
                )}
              >
                <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
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

          {/* ── AI LOVE SPARK OVERLAY ── */}
          {sparkPrompt && (
            <div className="absolute top-20 left-4 right-4 z-40 animate-in slide-in-from-top-2 fade-in duration-300">
              <div className="bg-black/80 backdrop-blur-xl border border-primary/30 rounded-2xl p-4 shadow-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-3.5 h-3.5 text-primary fill-primary animate-pulse" />
                  <span className="text-[10px] font-headline uppercase tracking-widest text-primary">Love Spark ❤️</span>
                  <button
                    onClick={() => setSparkPrompt(null)}
                    className="ml-auto text-white/40 hover:text-white/80 text-xs"
                  >✕</button>
                </div>
                <p className="text-sm text-white/90 leading-snug font-medium">{sparkPrompt}</p>
              </div>
            </div>
          )}

          {/* ── CALL CONTROLS BAR ── */}
          <div className="absolute bottom-6 left-0 right-0 z-40 px-6 flex items-center justify-center gap-4">
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

            {/* Toggle Video (Camera Off/On) */}
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

            {/* Switch Camera Button (Video mode only) */}
            {isShowingVideo && !isCamOff && onSwitchCamera && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onSwitchCamera}
                className="w-12 h-12 rounded-full border border-white/10 text-white hover:bg-white/10 bg-white/10 transition-transform active:scale-95"
                aria-label="Switch Camera"
              >
                <RefreshCw className="w-5 h-5" />
              </Button>
            )}

            {/* Speaker Toggle (Audio Call only) */}
            {!isShowingVideo && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSpeaker}
                className={cn(
                  "w-12 h-12 rounded-full border border-white/10 text-white hover:bg-white/10",
                  !isSpeakerOn ? "bg-red-600/35 hover:bg-red-600/40 text-red-400 border-red-500/20" : "bg-white/10"
                )}
                aria-label="Toggle Speaker"
              >
                {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </Button>
            )}

            {/* Hang Up (Clean, silent termination) */}
            <Button
              onClick={onHangUp}
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/30 flex items-center justify-center transition-transform active:scale-95"
              aria-label="Hang Up Call"
            >
              <PhoneOff className="w-6 h-6" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}



