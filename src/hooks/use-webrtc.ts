"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useFirestore } from "@/firebase";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  addDoc,
  serverTimestamp,
  getDoc,
  query,
  where,
  runTransaction,
} from "firebase/firestore";
import {
  startRingtone,
  stopRingtone,
  startOutgoingTone,
  stopOutgoingTone,
  stopAllCallSounds,
} from "@/lib/callAudio";

// ─── Call Lifecycle Types ──────────────────────────────────────────────────────

export type CallType = "audio" | "video";

/**
 * Authoritative single call state machine.
 * Only valid transitions are allowed — terminal states are irreversible.
 */
export type CallState =
  | "idle"
  | "ringing"      // caller: outgoing, callee: incoming (ringing)
  | "connecting"   // callee accepted, establishing WebRTC
  | "active"       // WebRTC media connected
  | "ended"        // call completed normally
  | "declined"     // callee explicitly declined
  | "missed"       // nobody answered within timeout
  | "failed";      // ICE/media error

export type ConnectionQuality = "excellent" | "good" | "fair" | "poor";

/** Terminal states — once here, no event can reactivate the call */
const TERMINAL_STATES: ReadonlySet<CallState> = new Set([
  "ended",
  "declined",
  "missed",
  "failed",
  "idle",
]);

/** 30-second ring timeout matching production calling apps */
export const CALL_RING_TIMEOUT_MS = 30_000;

/** Stale call protection: ignore calls older than this */
const MAX_CALL_AGE_MS = 35_000;

// ─── WebRTC Audio/Video Constraints ───────────────────────────────────────────

/**
 * Production WebRTC Audio Constraints:
 * - Mono voice channel (channelCount: 1) guarantees browser hardware AEC.
 * - Noise suppression and AGC enabled.
 * - 48kHz sampling rate for studio-grade Opus fidelity.
 */
export const PRODUCTION_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: { ideal: true },
  noiseSuppression: { ideal: true },
  autoGainControl: { ideal: true },
  channelCount: { ideal: 1 },
  sampleRate: { ideal: 48000 },
  sampleSize: { ideal: 16 },
};

export const FALLBACK_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

// ─── Sender Parameter Helpers ──────────────────────────────────────────────────

/**
 * Prioritize audio RTCRtpSender — high priority, no artificial bitrate cap.
 */
export function applyAudioSenderParameters(sender: RTCRtpSender): Promise<void> {
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{ priority: "high" }];
    } else {
      params.encodings.forEach((enc) => {
        delete enc.maxBitrate;
        enc.priority = "high";
        (enc as any).networkPriority = "high";
      });
    }
    return sender.setParameters(params).catch((err) => {
      console.warn("[WebRTC] Failed to set audio sender parameters:", err);
    });
  } catch (err) {
    console.warn("[WebRTC] Error configuring audio sender parameters:", err);
    return Promise.resolve();
  }
}

/**
 * Apply adaptive parameters to video RTCRtpSender.
 */
export function applyVideoSenderParameters(
  sender: RTCRtpSender,
  targetBitrate: number = 2_500_000,
  degradation: RTCDegradationPreference = "balanced"
): Promise<void> {
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{ maxBitrate: targetBitrate, priority: "medium" }];
    } else {
      params.encodings[0].maxBitrate = targetBitrate;
      params.encodings[0].priority = "medium";
      (params.encodings[0] as any).networkPriority = "medium";
    }
    params.degradationPreference = degradation;
    return sender.setParameters(params).catch((err) => {
      console.warn("[WebRTC] Failed to set video sender parameters:", err);
    });
  } catch (err) {
    console.warn("[WebRTC] Error configuring video sender parameters:", err);
    return Promise.resolve();
  }
}

/**
 * Optimize SDP for studio-grade voice clarity and WebRTC Forward Error Correction (FEC):
 * - useinbandfec=1: Enables FEC, preventing voice packet loss cutouts
 * - maxaveragebitrate=64000: Studio voice quality (64 kbps Opus)
 * - stereo=0: Clean mono voice
 * - cbr=1: Constant bitrate for stability
 * - minptime=10: Ultra-low latency 10ms audio packets
 */
export function optimizeSdp(sdp: string): string {
  if (!sdp) return sdp;
  let modified = sdp;
  const opusMatch = modified.match(/a=rtpmap:(\d+)\s+opus\/48000\/2/i);
  if (opusMatch) {
    const pt = opusMatch[1];
    const fmtpRegex = new RegExp(`a=fmtp:${pt}\\s+(.*)`, "i");
    const fmtpMatch = modified.match(fmtpRegex);
    const opusParams = "minptime=10;useinbandfec=1;stereo=0;sprop-stereo=0;maxaveragebitrate=64000;cbr=1";
    if (fmtpMatch) {
      modified = modified.replace(fmtpRegex, `a=fmtp:${pt} ${fmtpMatch[1]};${opusParams}`);
    } else {
      modified = modified.replace(opusMatch[0], `${opusMatch[0]}\r\na=fmtp:${pt} ${opusParams}`);
    }
  }
  return modified;
}

// ─── Hook Interface ────────────────────────────────────────────────────────────

interface UseWebRTCOptions {
  myId: string;
  partnerId: string;
  onIncomingCall?: (callId: string, type: CallType) => void;
  onCallEnded?: () => void;
  onCameraError?: (errorName: string) => void;
  /** Called once per call with outcome for chat persistence */
  onCallMessage?: (callType: CallType, callStatus: "completed" | "declined" | "missed", duration?: number, callId?: string) => void;
}

// ─── useWebRTC Hook ────────────────────────────────────────────────────────────

export function useWebRTC({
  myId,
  partnerId,
  onIncomingCall,
  onCallEnded,
  onCameraError,
  onCallMessage,
}: UseWebRTCOptions) {
  const db = useFirestore();

  // ── Reactive State ─────────────────────────────────────────────────────────
  const [callId, setCallId] = useState<string | null>(null);
  const [callType, setCallType] = useState<CallType>("audio");
  const [callState, setCallState] = useState<CallState>("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(false);
  const [isPartnerVideoEnabled, setIsPartnerVideoEnabled] = useState<boolean>(false);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>("excellent");
  const [isCaller, setIsCaller] = useState(false);

  // ── Refs (preserve state across async events) ──────────────────────────────
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const callStateRef = useRef<CallState>("idle");
  const callIdRef = useRef<string | null>(null);
  const callTypeRef = useRef<CallType>("audio");
  const isVideoEnabledRef = useRef<boolean>(false);
  const isCallerRef = useRef<boolean>(false);
  const facingModeRef = useRef<"user" | "environment">("user");
  const callStartedAtRef = useRef<number | null>(null);
  const lastRenegotiationAtRef = useRef<number>(0);
  const loggedCallIdsRef = useRef<Set<string>>(new Set());

  // Finalization guard — prevents duplicate terminal transitions
  const finalizingRef = useRef<boolean>(false);

  // ICE candidate tracking & deduplication
  const seenCandidateIdsRef = useRef<Set<string>>(new Set());
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // Recovery & Stats timers
  const iceRecoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastQualityAdjustmentRef = useRef<number>(0);

  // Firestore unsubscribers
  const unsubCallRef = useRef<(() => void) | null>(null);
  const unsubCandidatesCallerRef = useRef<(() => void) | null>(null);
  const unsubCandidatesCalleeRef = useRef<(() => void) | null>(null);
  // Callee also subscribes to the specific call doc to catch caller-cancel
  const unsubIncomingCallDocRef = useRef<(() => void) | null>(null);

  // Synchronize dynamic refs immediately
  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { callIdRef.current = callId; }, [callId]);
  useEffect(() => { callTypeRef.current = callType; }, [callType]);
  useEffect(() => { isVideoEnabledRef.current = isVideoEnabled; }, [isVideoEnabled]);

  const onIncomingCallRef = useRef(onIncomingCall);
  useEffect(() => { onIncomingCallRef.current = onIncomingCall; }, [onIncomingCall]);

  const onCallEndedRef = useRef(onCallEnded);
  useEffect(() => { onCallEndedRef.current = onCallEnded; }, [onCallEnded]);

  const onCameraErrorRef = useRef(onCameraError);
  useEffect(() => { onCameraErrorRef.current = onCameraError; }, [onCameraError]);

  const onCallMessageRef = useRef(onCallMessage);
  useEffect(() => { onCallMessageRef.current = onCallMessage; }, [onCallMessage]);

  // ── Utility: Is state terminal ─────────────────────────────────────────────
  const isTerminal = useCallback((state: CallState): boolean => {
    return TERMINAL_STATES.has(state);
  }, []);

  // ── Tab unload: mark call ended in Firestore (only if page is truly closing) ─
  useEffect(() => {
    const handleUnload = () => {
      const cid = callIdRef.current;
      const state = callStateRef.current;
      if (cid && db && !isTerminal(state) && state !== "idle") {
        updateDoc(doc(db, "calls", cid), {
          status: "ended",
          endedAt: serverTimestamp(),
        }).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [db, isTerminal]);

  // ── Stats Monitoring ───────────────────────────────────────────────────────
  const stopStatsMonitoring = useCallback(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
  }, []);

  const startStatsMonitoring = useCallback((pc: RTCPeerConnection) => {
    stopStatsMonitoring();

    let prevPacketsLost = 0;
    let prevPacketsReceived = 0;

    statsIntervalRef.current = setInterval(async () => {
      if (!pc || pc.connectionState === "closed") return;
      try {
        const stats = await pc.getStats();
        let currentLossPercent = 0;
        let currentJitterMs = 0;
        let currentRttMs = 0;

        stats.forEach((report) => {
          if (report.type === "inbound-rtp" && report.kind === "audio") {
            const deltaLost = (report.packetsLost || 0) - prevPacketsLost;
            const deltaReceived = (report.packetsReceived || 0) - prevPacketsReceived;
            prevPacketsLost = report.packetsLost || 0;
            prevPacketsReceived = report.packetsReceived || 0;
            const total = deltaReceived + Math.max(0, deltaLost);
            if (total > 0 && deltaLost > 0) {
              currentLossPercent = (deltaLost / total) * 100;
            }
            if (report.jitter) currentJitterMs = report.jitter * 1000;
          }
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            if (report.currentRoundTripTime) currentRttMs = report.currentRoundTripTime * 1000;
          }
        });

        let grade: ConnectionQuality = "excellent";
        if (currentLossPercent > 8 || currentRttMs > 350 || currentJitterMs > 80) grade = "poor";
        else if (currentLossPercent > 3 || currentRttMs > 200 || currentJitterMs > 40) grade = "fair";
        else if (currentLossPercent > 1 || currentRttMs > 100 || currentJitterMs > 25) grade = "good";

        setConnectionQuality((prev) => (prev !== grade ? grade : prev));

        const now = Date.now();
        if (now - lastQualityAdjustmentRef.current > 6000) {
          const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (videoSender) {
            let targetBitrate = 2_800_000;
            let degradation: RTCDegradationPreference = "balanced";
            if (grade === "poor") { targetBitrate = 600_000; degradation = "maintain-framerate"; }
            else if (grade === "fair") { targetBitrate = 1_400_000; degradation = "balanced"; }
            else if (grade === "good") { targetBitrate = 2_200_000; degradation = "balanced"; }
            else { targetBitrate = 3_200_000; degradation = "balanced"; }
            applyVideoSenderParameters(videoSender, targetBitrate, degradation);
            lastQualityAdjustmentRef.current = now;
          }
        }
      } catch {
        // Ignored: stats query errors during teardown
      }
    }, 2500);
  }, [stopStatsMonitoring]);

  // ── Ring Timeout Management ────────────────────────────────────────────────
  const clearRingTimeout = useCallback(() => {
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
  }, []);

  // ── Clean up browser notifications tied to a callId ───────────────────────
  const dismissCallNotification = useCallback((targetCallId: string) => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.getNotifications({ tag: `call-${targetCallId}` }).then((notifications) => {
        notifications.forEach((n) => n.close());
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  // ── Idempotent cleanup ─────────────────────────────────────────────────────
  const cleanUp = useCallback((finalState: CallState = "idle") => {
    // Guard: if already finalizing or already terminal, skip
    if (finalizingRef.current) return;
    finalizingRef.current = true;

    console.log(`[WebRTC] Cleanup → ${finalState}`);

    stopAllCallSounds();
    clearRingTimeout();
    stopStatsMonitoring();

    if (iceRecoveryTimerRef.current) {
      clearTimeout(iceRecoveryTimerRef.current);
      iceRecoveryTimerRef.current = null;
    }

    if (unsubCallRef.current) { unsubCallRef.current(); unsubCallRef.current = null; }
    if (unsubCandidatesCallerRef.current) { unsubCandidatesCallerRef.current(); unsubCandidatesCallerRef.current = null; }
    if (unsubCandidatesCalleeRef.current) { unsubCandidatesCalleeRef.current(); unsubCandidatesCalleeRef.current = null; }
    if (unsubIncomingCallDocRef.current) { unsubIncomingCallDocRef.current(); unsubIncomingCallDocRef.current = null; }

    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch {} });
      localStreamRef.current = null;
      setLocalStream(null);
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch {} });
      remoteStreamRef.current = null;
      setRemoteStream(null);
    }

    lastRenegotiationAtRef.current = 0;
    setIsVideoEnabled(false);
    setIsPartnerVideoEnabled(false);
    pendingCandidatesRef.current = [];
    seenCandidateIdsRef.current.clear();
    callStartedAtRef.current = null;

    const closingCallId = callIdRef.current;
    if (closingCallId) {
      dismissCallNotification(closingCallId);
    }

    setCallId(null);
    callIdRef.current = null;
    setCallState(finalState);
    callStateRef.current = finalState;
    isCallerRef.current = false;
    setIsCaller(false);
    facingModeRef.current = "user";
    setConnectionQuality("excellent");

    // Reset finalization guard after state is set
    setTimeout(() => { finalizingRef.current = false; }, 200);

    onCallEndedRef.current?.();
  }, [stopStatsMonitoring, clearRingTimeout, dismissCallNotification]);

  // ── ICE Servers ───────────────────────────────────────────────────────────
  const getIceConfiguration = useCallback((): RTCConfiguration => {
    const iceServers: RTCIceServer[] = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
    ];

    const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
    const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
    const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

    if (turnUrl && turnUsername && turnCredential) {
      const urls = turnUrl.split(",").map((u) => u.trim());
      urls.forEach((url) => {
        iceServers.push({ urls: url, username: turnUsername, credential: turnCredential });
      });
    }

    return { iceServers, iceCandidatePoolSize: 10 };
  }, []);

  // ── ICE Candidate Helpers ─────────────────────────────────────────────────
  const sanitizeCandidate = (candidate: RTCIceCandidate): Record<string, any> => {
    const json = candidate.toJSON();
    const res: Record<string, any> = {};
    if (json.candidate !== undefined && json.candidate !== null) res.candidate = json.candidate;
    if (json.sdpMid !== undefined && json.sdpMid !== null) res.sdpMid = json.sdpMid;
    if (json.sdpMLineIndex !== undefined && json.sdpMLineIndex !== null) res.sdpMLineIndex = json.sdpMLineIndex;
    if (json.usernameFragment !== undefined && json.usernameFragment !== null) res.usernameFragment = json.usernameFragment;
    return res;
  };

  const addCandidateSafe = useCallback(async (pc: RTCPeerConnection, data: RTCIceCandidateInit) => {
    if (!data || !data.candidate) return;
    if (!pc || pc.signalingState === "closed") return;
    const candKey = `${data.candidate}_${data.sdpMid}_${data.sdpMLineIndex}`;
    if (seenCandidateIdsRef.current.has(candKey)) return;
    seenCandidateIdsRef.current.add(candKey);

    if (!pc.remoteDescription) {
      pendingCandidatesRef.current.push(data);
      return;
    }
    try {
      if ((pc.signalingState as string) === "closed") return;
      await pc.addIceCandidate(new RTCIceCandidate(data));
    } catch (err) {
      console.warn("[WebRTC] Ignorable addIceCandidate notice:", err);
    }
  }, []);

  const flushPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
    if (!pc || (pc.signalingState as string) === "closed") return;
    const pending = [...pendingCandidatesRef.current];
    pendingCandidatesRef.current = [];
    for (const data of pending) {
      try {
        if ((pc.signalingState as string) === "closed") return;
        await pc.addIceCandidate(new RTCIceCandidate(data));
      } catch (err) {
        console.warn("[WebRTC] Ignorable flush candidate notice:", err);
      }
    }
  }, []);

  // ── PeerConnection Setup ───────────────────────────────────────────────────
  const setupPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(getIceConfiguration());
    pcRef.current = pc;

    const rStream = new MediaStream();
    remoteStreamRef.current = rStream;
    setRemoteStream(rStream);

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((t) => {
          if (!rStream.getTrackById(t.id)) rStream.addTrack(t);
        });
      } else {
        if (!rStream.getTrackById(event.track.id)) rStream.addTrack(event.track);
      }
      setRemoteStream(new MediaStream(rStream.getTracks()));
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, localStreamRef.current!);
        if (track.kind === "audio") applyAudioSenderParameters(sender);
        else if (track.kind === "video") applyVideoSenderParameters(sender);
      });
    }

    // Prioritize hardware-accelerated HD video codecs (H.264 / VP9 / VP8)
    if (typeof RTCRtpSender.getCapabilities === "function") {
      try {
        const capabilities = RTCRtpSender.getCapabilities("video");
        if (capabilities && capabilities.codecs) {
          const preferredOrder = ["video/H264", "video/VP9", "video/VP8"];
          const sortedCodecs = [...capabilities.codecs].sort((a, b) => {
            const idxA = preferredOrder.indexOf(a.mimeType);
            const idxB = preferredOrder.indexOf(b.mimeType);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return 0;
          });
          const videoTransceiver = pc.getTransceivers().find((t) => t.sender.track?.kind === "video");
          if (videoTransceiver && typeof videoTransceiver.setCodecPreferences === "function") {
            videoTransceiver.setCodecPreferences(sortedCodecs);
          }
        }
      } catch (e) {
        console.warn("[WebRTC] setCodecPreferences notice:", e);
      }
    }

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log("[WebRTC] ICE State:", state);

      if (state === "connected" || state === "completed") {
        if (iceRecoveryTimerRef.current) {
          clearTimeout(iceRecoveryTimerRef.current);
          iceRecoveryTimerRef.current = null;
        }
        if (!callStartedAtRef.current) callStartedAtRef.current = Date.now();
        setCallState("active");
        callStateRef.current = "active";
        stopAllCallSounds();
        startStatsMonitoring(pc);
      } else if (state === "disconnected") {
        console.warn("[WebRTC] ICE disconnected — initiating recovery window");
        if (!iceRecoveryTimerRef.current) {
          iceRecoveryTimerRef.current = setTimeout(() => {
            if (pc.iceConnectionState === "disconnected") {
              console.warn("[WebRTC] Attempting ICE restart after disconnection window");
              pc.restartIce();
            }
          }, 6000);
        }
      } else if (state === "failed") {
        console.warn("[WebRTC] ICE failed — attempting restartIce()");
        try { pc.restartIce(); } catch (e) { console.error("[WebRTC] restartIce error:", e); }
      } else if (state === "closed") {
        if (!isTerminal(callStateRef.current)) cleanUp("ended");
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        if (!callStartedAtRef.current) callStartedAtRef.current = Date.now();
        setCallState("active");
        callStateRef.current = "active";
        stopAllCallSounds();
      }
    };

    return pc;
  }, [getIceConfiguration, cleanUp, startStatsMonitoring, isTerminal]);

  // ── Local Stream Acquisition ───────────────────────────────────────────────
  const getLocalStream = useCallback(async (type: CallType): Promise<MediaStream> => {
    const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const currentFacing = facingModeRef.current;

    // Production HD video constraints (adaptive for mobile portrait 9:16 and desktop landscape 16:9)
    const idealWidth = isMobile ? 720 : 1280;
    const idealHeight = isMobile ? 1280 : 720;
    const hdVideoConstraints: MediaTrackConstraints = {
      facingMode: currentFacing,
      width: { ideal: idealWidth, min: 480 },
      height: { ideal: idealHeight, min: 480 },
      frameRate: { ideal: 30, min: 24 },
      aspectRatio: { ideal: isMobile ? 9 / 16 : 16 / 9 },
    };

    if (type === "video") {
      // 1. Try unified acquisition with HD video + studio audio in a single atomic prompt
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: PRODUCTION_AUDIO_CONSTRAINTS,
          video: hdVideoConstraints,
        });
        stream.getAudioTracks().forEach((t) => (t.enabled = true));
        stream.getVideoTracks().forEach((t) => (t.enabled = true));
        return stream;
      } catch (hdErr) {
        console.warn("[WebRTC] HD unified acquisition failed, falling back to standard video:", hdErr);
      }

      // 2. Fallback to basic video + standard audio in a single prompt
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: FALLBACK_AUDIO_CONSTRAINTS,
          video: { facingMode: currentFacing },
        });
        stream.getAudioTracks().forEach((t) => (t.enabled = true));
        stream.getVideoTracks().forEach((t) => (t.enabled = true));
        return stream;
      } catch (videoErr: any) {
        console.warn("[WebRTC] Video hardware unavailable, falling back to voice-only channel:", videoErr);
        if (onCameraErrorRef.current) {
          onCameraErrorRef.current(videoErr?.name || "CameraError");
        }
      }
    }

    // Audio-only acquisition (for voice calls, or graceful fallback if camera is unavailable)
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: PRODUCTION_AUDIO_CONSTRAINTS,
        video: false,
      });
      audioStream.getAudioTracks().forEach((t) => (t.enabled = true));
      return audioStream;
    } catch (err) {
      console.warn("[WebRTC] Production audio constraints rejected, trying fallback:", err);
      try {
        const fbAudio = await navigator.mediaDevices.getUserMedia({
          audio: FALLBACK_AUDIO_CONSTRAINTS,
          video: false,
        });
        fbAudio.getAudioTracks().forEach((t) => (t.enabled = true));
        return fbAudio;
      } catch {
        const basicAudio = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        basicAudio.getAudioTracks().forEach((t) => (t.enabled = true));
        return basicAudio;
      }
    }
  }, []);

  // ── Atomic Call Outcome Logger ─────────────────────────────────────────────
  const logCallOutcome = useCallback(
    async (targetCallId: string | null, type: CallType, status: "completed" | "declined" | "missed", duration?: number) => {
      if (!targetCallId || !db) {
        onCallMessageRef.current?.(type, status, duration, targetCallId || undefined);
        return;
      }

      if (loggedCallIdsRef.current.has(targetCallId)) return;
      loggedCallIdsRef.current.add(targetCallId);

      try {
        const callDocRef = doc(db, "calls", targetCallId);
        let wonRace = false;

        await runTransaction(db, async (transaction) => {
          const callSnap = await transaction.get(callDocRef);
          if (!callSnap.exists()) { wonRace = true; return; }
          const callData = callSnap.data();
          if (callData.messageLogged) { wonRace = false; return; }
          transaction.update(callDocRef, { messageLogged: true });
          wonRace = true;
        });

        if (wonRace) {
          onCallMessageRef.current?.(type, status, duration, targetCallId);
        }
      } catch (err) {
        console.error("[WebRTC] Error in atomic call-log transaction guard:", err);
        onCallMessageRef.current?.(type, status, duration, targetCallId);
      }
    },
    [db]
  );

  // ── Perfect Negotiation / Renegotiation ────────────────────────────────────
  const handleRenegotiationSnapshot = useCallback(
    async (pc: RTCPeerConnection, cid: string, data: any) => {
      if (!data?.renegotiation || !db) return;
      if (!pc || (pc.signalingState as string) === "closed" || isTerminal(callStateRef.current)) return;

      if (
        data.renegotiation.offer &&
        data.renegotiation.from !== myId &&
        data.renegotiation.version &&
        data.renegotiation.version !== lastRenegotiationAtRef.current
      ) {
        lastRenegotiationAtRef.current = data.renegotiation.version;
        try {
          if (!pc || (pc.signalingState as string) === "closed") return;
          if (pc.signalingState === "have-local-offer") {
            const isPolite = !isCallerRef.current;
            if (isPolite) {
              await pc.setLocalDescription({ type: "rollback" });
            } else {
              return;
            }
          }
          if (!pc || (pc.signalingState as string) === "closed") return;
          await pc.setRemoteDescription(new RTCSessionDescription(data.renegotiation.offer));
          if (!pc || (pc.signalingState as string) === "closed") return;
          await flushPendingCandidates(pc);
          const answer = await pc.createAnswer();
          const optAnswerSdp = optimizeSdp(answer.sdp || "");
          const finalAnswer = new RTCSessionDescription({ type: answer.type || "answer", sdp: optAnswerSdp });
          if (!pc || (pc.signalingState as string) === "closed") return;
          await pc.setLocalDescription(finalAnswer);
          if (finalAnswer?.sdp && cid) {
            await updateDoc(doc(db, "calls", cid), {
              "renegotiation.answer": { sdp: finalAnswer.sdp, type: finalAnswer.type || "answer" },
              "renegotiation.answeredBy": myId,
            }).catch((e) => console.warn("[WebRTC] Renegotiation answer write notice:", e));
          }
          const vSender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (vSender) applyVideoSenderParameters(vSender);
          const aSender = pc.getSenders().find((s) => s.track?.kind === "audio");
          if (aSender) applyAudioSenderParameters(aSender);
        } catch (err) {
          console.warn("[WebRTC] Ignorable renegotiation offer notice:", err);
        }
      }

      if (
        data.renegotiation?.answer &&
        data.renegotiation.answeredBy !== myId &&
        pc.signalingState === "have-local-offer"
      ) {
        try {
          if (!pc || (pc.signalingState as string) === "closed") return;
          await pc.setRemoteDescription(new RTCSessionDescription(data.renegotiation.answer));
          if (!pc || (pc.signalingState as string) === "closed") return;
          await flushPendingCandidates(pc);
          const vSender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (vSender) applyVideoSenderParameters(vSender);
          const aSender = pc.getSenders().find((s) => s.track?.kind === "audio");
          if (aSender) applyAudioSenderParameters(aSender);
        } catch (err) {
          console.warn("[WebRTC] Ignorable renegotiation answer notice:", err);
        }
      }
    },
    [db, myId, flushPendingCandidates, isTerminal]
  );

  // ── Send a push notification ───────────────────────────────────────────────
  const sendPush = useCallback((payload: Record<string, string>) => {
    fetch("/api/trigger-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch((err) => console.warn("[WebRTC] Push notification error:", err));
  }, []);

  // ── Start Outgoing Call ────────────────────────────────────────────────────
  const startCall = useCallback(async (type: CallType) => {
    if (!db || !myId || !partnerId) return;
    if (!isTerminal(callStateRef.current) && callStateRef.current !== "idle") {
      console.warn("[WebRTC] Cannot start call — current state:", callStateRef.current);
      return;
    }

    setCallState("ringing");
    callStateRef.current = "ringing";
    setCallType(type);
    setIsVideoEnabled(type === "video");
    isCallerRef.current = true;
    setIsCaller(true);
    finalizingRef.current = false;
    pendingCandidatesRef.current = [];
    seenCandidateIdsRef.current.clear();

    try {
      const stream = await getLocalStream(type);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const callDocRef = doc(collection(db, "calls"));
      const newCallId = callDocRef.id;
      setCallId(newCallId);
      callIdRef.current = newCallId;

      // Start outgoing ringback tone for caller
      startOutgoingTone(newCallId);

      const pc = setupPeerConnection();

      pc.onicecandidate = (event) => {
        if (event.candidate && event.candidate.candidate) {
          const cleanCand = sanitizeCandidate(event.candidate);
          addDoc(collection(db, "calls", newCallId, "callerCandidates"), cleanCand).catch((err) => {
            console.warn("[WebRTC] Candidate write notice:", err);
          });
        }
      };

      const offerDesc = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      const optimizedOfferSdp = optimizeSdp(offerDesc.sdp || "");
      const finalOffer = new RTCSessionDescription({ type: offerDesc.type, sdp: optimizedOfferSdp });
      await pc.setLocalDescription(finalOffer);

      await setDoc(callDocRef, {
        callerId: myId,
        calleeId: partnerId,
        type,
        status: "ringing",
        [`cam_${myId}`]: type === "video",
        offer: { sdp: finalOffer.sdp, type: finalOffer.type },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // FCM push to wake up recipient
      sendPush({
        type: "incoming_call",
        recipientId: partnerId,
        senderName: myId === "nabin" ? "Nabin" : "Karu",
        callId: newCallId,
        callType: type,
      });

      // 30-second ring timeout (caller side)
      clearRingTimeout();
      ringTimeoutRef.current = setTimeout(() => {
        // Only act if this specific call is still ringing
        if (callStateRef.current === "ringing" && callIdRef.current === newCallId) {
          console.log("[WebRTC] Call timed out — marking missed");
          stopOutgoingTone(newCallId);
          logCallOutcome(newCallId, type, "missed");
          updateDoc(doc(db, "calls", newCallId), {
            status: "missed",
            endedAt: serverTimestamp(),
          }).catch(() => {});
          // Send missed-call push to callee
          sendPush({
            type: "missed_call",
            recipientId: partnerId,
            senderName: myId === "nabin" ? "Nabin" : "Karu",
            callId: newCallId,
            callType: type,
          });
          cleanUp("missed");
        }
      }, CALL_RING_TIMEOUT_MS);

      // Listen for answer + partner state updates
      unsubCallRef.current = onSnapshot(callDocRef, async (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        // Guard: ignore events for calls we've already finalized
        if (callIdRef.current !== newCallId) return;

        if (data[`cam_${partnerId}`] !== undefined) {
          setIsPartnerVideoEnabled(Boolean(data[`cam_${partnerId}`]));
        }

        const status = data.status;

        if (status === "declined") {
          if (!isTerminal(callStateRef.current)) {
            console.log("[WebRTC] Call declined by partner");
            stopOutgoingTone(newCallId);
            clearRingTimeout();
            cleanUp("declined");
          }
          return;
        } else if (status === "ended") {
          if (!isTerminal(callStateRef.current)) {
            console.log("[WebRTC] Call ended by partner");
            cleanUp("ended");
          }
          return;
        } else if (status === "missed") {
          if (!isTerminal(callStateRef.current)) {
            cleanUp("missed");
          }
          return;
        } else if (data.answer && pc.signalingState === "have-local-offer" && callStateRef.current === "ringing") {
          console.log("[WebRTC] Call answered by partner");
          // Cancel timeout — call was answered
          clearRingTimeout();
          stopOutgoingTone(newCallId);
          setCallState("connecting");
          callStateRef.current = "connecting";
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            await flushPendingCandidates(pc);
          } catch (e) {
            console.warn("[WebRTC] setRemoteDescription notice:", e);
          }
        }

        if (pc && pc.signalingState !== "closed" && !isTerminal(callStateRef.current)) {
          await handleRenegotiationSnapshot(pc, newCallId, data);
        }
      });

      // Inbound Callee ICE candidates
      unsubCandidatesCalleeRef.current = onSnapshot(
        collection(db, "calls", newCallId, "calleeCandidates"),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              addCandidateSafe(pc, change.doc.data() as RTCIceCandidateInit);
            }
          });
        }
      );
    } catch (err) {
      console.error("[WebRTC] Failed to start call:", err);
      stopOutgoingTone();
      cleanUp();
    }
  }, [db, myId, partnerId, getLocalStream, setupPeerConnection, logCallOutcome, cleanUp, clearRingTimeout, addCandidateSafe, flushPendingCandidates, handleRenegotiationSnapshot, sendPush, isTerminal]);

  // ── Answer Incoming Call ───────────────────────────────────────────────────
  const answerCall = useCallback(async (incomingCallId: string) => {
    if (!db) return;

    // Stale protection: if already in a call or finalizing, reject
    if (!isTerminal(callStateRef.current) && callStateRef.current !== "idle") {
      console.warn("[WebRTC] Cannot answer — already in state:", callStateRef.current);
      return;
    }

    // If document is in background/hidden (e.g. focused from mobile notification click),
    // wait a brief moment for document visibility to avoid NotAllowedError on mobile
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      await new Promise<void>((resolve) => {
        const onVisible = () => {
          if (document.visibilityState === "visible") {
            document.removeEventListener("visibilitychange", onVisible);
            resolve();
          }
        };
        document.addEventListener("visibilitychange", onVisible);
        setTimeout(() => {
          document.removeEventListener("visibilitychange", onVisible);
          resolve();
        }, 800);
      });
    }

    // Verify the call is still ringing before answering
    try {
      const callDocRef = doc(db, "calls", incomingCallId);
      const callSnap = await getDoc(callDocRef);
      if (!callSnap.exists()) {
        console.warn("[WebRTC] answerCall: call document not found");
        return;
      }
      const callData = callSnap.data();
      if (callData.status !== "ringing") {
        console.warn("[WebRTC] answerCall: call is no longer ringing, status:", callData.status);
        // Stop any lingering ringtone and dismiss incoming UI
        stopRingtone(incomingCallId);
        dismissCallNotification(incomingCallId);
        onCallEndedRef.current?.();
        return;
      }

      // Stop incoming ringtone immediately on accept
      stopRingtone(incomingCallId);
      dismissCallNotification(incomingCallId);
      clearRingTimeout();

      setCallId(incomingCallId);
      callIdRef.current = incomingCallId;
      setCallState("connecting");
      callStateRef.current = "connecting";
      isCallerRef.current = false;
      setIsCaller(false);
      finalizingRef.current = false;
      pendingCandidatesRef.current = [];
      seenCandidateIdsRef.current.clear();

      const type = callData.type as CallType;
      setCallType(type);
      setIsVideoEnabled(type === "video");

      const stream = await getLocalStream(type);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = setupPeerConnection();

      pc.onicecandidate = (event) => {
        if (event.candidate && event.candidate.candidate) {
          const cleanCand = sanitizeCandidate(event.candidate);
          addDoc(collection(db, "calls", incomingCallId, "calleeCandidates"), cleanCand).catch((err) => {
            console.warn("[WebRTC] Callee candidate write notice:", err);
          });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
      await flushPendingCandidates(pc);

      const answerDesc = await pc.createAnswer();
      const optimizedAnswerSdp = optimizeSdp(answerDesc.sdp || "");
      const finalAnswer = new RTCSessionDescription({ type: answerDesc.type, sdp: optimizedAnswerSdp });
      await pc.setLocalDescription(finalAnswer);

      await updateDoc(callDocRef, {
        status: "active",
        answeredAt: serverTimestamp(),
        [`cam_${myId}`]: type === "video",
        answer: { sdp: finalAnswer.sdp, type: finalAnswer.type },
      });

      setCallState("active");
      callStateRef.current = "active";
      if (!callStartedAtRef.current) callStartedAtRef.current = Date.now();

      unsubCallRef.current = onSnapshot(callDocRef, async (snapshot) => {
        const data = snapshot.data();
        if (!data) return;
        if (callIdRef.current !== incomingCallId) return;

        if (data[`cam_${partnerId}`] !== undefined) {
          setIsPartnerVideoEnabled(Boolean(data[`cam_${partnerId}`]));
        }

        const status = data.status;

        if (status === "missed") {
          // This shouldn't happen after we answered, but guard anyway
          if (!isTerminal(callStateRef.current)) {
            logCallOutcome(incomingCallId, type, "missed");
            cleanUp("ended");
          }
          return;
        } else if (status === "ended" || status === "cancelled") {
          if (!isTerminal(callStateRef.current)) {
            if (callStartedAtRef.current) {
              const durationSec = Math.round((Date.now() - callStartedAtRef.current) / 1000);
              logCallOutcome(incomingCallId, type, "completed", durationSec);
            }
            cleanUp("ended");
          }
          return;
        }

        if (pc && pc.signalingState !== "closed" && !isTerminal(callStateRef.current)) {
          await handleRenegotiationSnapshot(pc, incomingCallId, data);
        }
      });

      // Inbound Caller ICE candidates
      unsubCandidatesCallerRef.current = onSnapshot(
        collection(db, "calls", incomingCallId, "callerCandidates"),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              addCandidateSafe(pc, change.doc.data() as RTCIceCandidateInit);
            }
          });
        }
      );
    } catch (err) {
      console.error("[WebRTC] Failed to answer call:", err);
      stopAllCallSounds();
      // Never mark status as "declined" on technical/media failure — mark failed so caller knows it was an error
      try {
        await updateDoc(doc(db, "calls", incomingCallId), {
          status: "failed",
          endedAt: serverTimestamp(),
        });
      } catch {}
      cleanUp("failed");
    }
  }, [db, myId, partnerId, getLocalStream, setupPeerConnection, logCallOutcome, cleanUp, clearRingTimeout, dismissCallNotification, addCandidateSafe, flushPendingCandidates, handleRenegotiationSnapshot, isTerminal]);

  // ── Decline Incoming Call ──────────────────────────────────────────────────
  const declineCall = useCallback(async (incomingCallId: string, incomingCallType?: CallType) => {
    if (!db) return;

    stopRingtone(incomingCallId);
    dismissCallNotification(incomingCallId);
    clearRingTimeout();

    const logType = incomingCallType || callTypeRef.current;
    logCallOutcome(incomingCallId, logType, "declined");

    try {
      await updateDoc(doc(db, "calls", incomingCallId), {
        status: "declined",
        endedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("[WebRTC] Decline call error:", e);
    }
    cleanUp("declined");
  }, [db, cleanUp, clearRingTimeout, dismissCallNotification, logCallOutcome]);

  // ── Cancel Outgoing Call (caller presses Cancel while ringing) ─────────────
  const cancelCall = useCallback(async () => {
    const cid = callIdRef.current;
    if (!cid || !db) { cleanUp(); return; }

    // Idempotency guard
    if (isTerminal(callStateRef.current)) return;

    console.log("[WebRTC] Caller cancelled outgoing call");
    stopOutgoingTone(cid);
    clearRingTimeout();

    try {
      await updateDoc(doc(db, "calls", cid), {
        status: "cancelled",
        endedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn("[WebRTC] Cancel call Firestore error:", e);
    }

    // Send a silent cancellation push to dismiss callee notification
    sendPush({
      type: "call_cancelled",
      recipientId: partnerId,
      callId: cid,
      senderName: myId === "nabin" ? "Nabin" : "Karu",
      callType: callTypeRef.current,
    });

    cleanUp("ended");
  }, [db, myId, partnerId, cleanUp, clearRingTimeout, sendPush, isTerminal]);

  // ── End Active Call ────────────────────────────────────────────────────────
  const endCall = useCallback(async () => {
    const cid = callIdRef.current;

    // Idempotency guard
    if (isTerminal(callStateRef.current)) return;

    if (callStartedAtRef.current) {
      const durationSec = Math.round((Date.now() - callStartedAtRef.current) / 1000);
      logCallOutcome(cid, callTypeRef.current, "completed", durationSec);
    }

    if (db && cid) {
      try {
        await updateDoc(doc(db, "calls", cid), {
          status: "ended",
          endedAt: serverTimestamp(),
        });
        // Silent end push to dismiss callee notifications
        sendPush({
          type: "call_ended",
          recipientId: partnerId,
          callId: cid,
          senderName: myId === "nabin" ? "Nabin" : "Karu",
          callType: callTypeRef.current,
        });
      } catch (e) {
        console.warn("[WebRTC] Error updating call ended in Firestore:", e);
      }
    }
    cleanUp("ended");
  }, [db, myId, partnerId, cleanUp, logCallOutcome, sendPush, isTerminal]);

  // ── Camera Toggle ──────────────────────────────────────────────────────────
  const toggleVideo = useCallback(async () => {
    const pc = pcRef.current;
    const cid = callIdRef.current;
    const existingVideoTrack = localStreamRef.current?.getVideoTracks()[0];
    const isCurrentlyActive = !!existingVideoTrack && existingVideoTrack.enabled && isVideoEnabledRef.current;

    if (isCurrentlyActive) {
      existingVideoTrack.enabled = false;
      if (pc) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video" || s.track === existingVideoTrack);
        if (sender) { try { await sender.replaceTrack(null); } catch {} }
      }
      setIsVideoEnabled(false);
      if (cid && db) {
        updateDoc(doc(db, "calls", cid), { [`cam_${myId}`]: false }).catch(() => {});
      }
      return;
    }

    if (existingVideoTrack) {
      existingVideoTrack.enabled = true;
      if (pc) {
        const sender = pc.getSenders().find((s) => s.track === existingVideoTrack || s.track === null);
        if (sender) {
          try {
            await sender.replaceTrack(existingVideoTrack);
            await applyVideoSenderParameters(sender);
          } catch {}
        }
      }
      setIsVideoEnabled(true);
      if (cid && db) {
        updateDoc(doc(db, "calls", cid), { [`cam_${myId}`]: true }).catch(() => {});
      }
      return;
    }

    // Audio → Video mid-call upgrade
    const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const currentFacing = facingModeRef.current;
    const videoConstraints: MediaTrackConstraints = {
      facingMode: currentFacing,
      width: { ideal: isMobile ? 720 : 1280, min: 480 },
      height: { ideal: isMobile ? 1280 : 720, min: 480 },
      frameRate: { ideal: 30, min: 24 },
      aspectRatio: { ideal: isMobile ? 9 / 16 : 16 / 9 },
    };

    let newStream: MediaStream;
    try {
      newStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: videoConstraints });
    } catch (err: any) {
      try {
        newStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: currentFacing } });
      } catch (fallbackErr: any) {
        console.error("[WebRTC] toggleVideo camera acquisition failed:", fallbackErr);
        if (onCameraErrorRef.current) onCameraErrorRef.current(fallbackErr.name || "CameraError");
        return;
      }
    }

    const newVideoTrack = newStream.getVideoTracks()[0];
    if (!newVideoTrack) return;

    if (localStreamRef.current) {
      localStreamRef.current.addTrack(newVideoTrack);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    } else {
      const ms = new MediaStream([newVideoTrack]);
      localStreamRef.current = ms;
      setLocalStream(ms);
    }

    setCallType("video");
    callTypeRef.current = "video";
    setIsVideoEnabled(true);

    if (!pc || !cid || !db) return;

    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
    if (sender) {
      try { await sender.replaceTrack(newVideoTrack); await applyVideoSenderParameters(sender); } catch {}
    } else {
      const newSender = pc.addTrack(newVideoTrack, localStreamRef.current!);
      await applyVideoSenderParameters(newSender);
    }

    const audioSender = pc.getSenders().find((s) => s.track?.kind === "audio");
    if (audioSender) await applyAudioSenderParameters(audioSender);

    try {
      const offer = await pc.createOffer();
      const optOfferSdp = optimizeSdp(offer.sdp || "");
      const finalOffer = new RTCSessionDescription({ type: offer.type || "offer", sdp: optOfferSdp });
      await pc.setLocalDescription(finalOffer);
      const version = Date.now();
      lastRenegotiationAtRef.current = version;
      if (finalOffer?.sdp) {
        await updateDoc(doc(db, "calls", cid), {
          type: "video",
          [`cam_${myId}`]: true,
          renegotiation: { offer: { sdp: finalOffer.sdp, type: finalOffer.type || "offer" }, from: myId, version },
        }).catch((e) => console.warn("[WebRTC] Video upgrade update notice:", e));
      }
    } catch (renegErr) {
      console.warn("[WebRTC] Renegotiation notice on video upgrade:", renegErr);
    }
  }, [db, myId]);

  // ── Camera Switch ──────────────────────────────────────────────────────────
  const switchCamera = useCallback(async () => {
    if (!localStreamRef.current) return;
    const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
    if (!oldVideoTrack) return;

    const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const nextFacing = facingModeRef.current === "user" ? "environment" : "user";
    const videoConstraints: MediaTrackConstraints = {
      facingMode: nextFacing,
      width: { ideal: isMobile ? 720 : 1280, min: 480 },
      height: { ideal: isMobile ? 1280 : 720, min: 480 },
      frameRate: { ideal: 30, min: 24 },
      aspectRatio: { ideal: isMobile ? 9 / 16 : 16 / 9 },
    };

    let newStream: MediaStream;
    try {
      newStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: videoConstraints });
    } catch {
      try {
        newStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: nextFacing } });
      } catch {
        return;
      }
    }

    const newVideoTrack = newStream.getVideoTracks()[0];
    if (!newVideoTrack) { newStream.getTracks().forEach((t) => t.stop()); return; }

    if (pcRef.current) {
      const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
        try {
          await sender.replaceTrack(newVideoTrack);
          await applyVideoSenderParameters(sender);
        } catch {
          newVideoTrack.stop();
          return;
        }
      }
    }

    oldVideoTrack.stop();
    const stream = localStreamRef.current;
    stream.removeTrack(oldVideoTrack);
    stream.addTrack(newVideoTrack);
    setLocalStream(new MediaStream(stream.getTracks()));
    facingModeRef.current = nextFacing;
  }, []);

  // ── Listen for Incoming Calls (idle state only) ────────────────────────────
  useEffect(() => {
    if (!db || !myId) return;

    const callsColl = collection(db, "calls");
    const q = query(
      callsColl,
      where("calleeId", "==", myId),
      where("status", "==", "ringing")
    );

    const thirtyFiveSecondsAgo = new Date(Date.now() - MAX_CALL_AGE_MS);

    const unsub = onSnapshot(q, (snapshot) => {
      // Only process incoming calls while we're idle
      if (callStateRef.current !== "idle") return;

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          const createdAt = data.createdAt?.toMillis?.() ?? 0;
          if (createdAt > thirtyFiveSecondsAgo.getTime()) {
            const incomingId = change.doc.id;
            const incomingType = data.type as CallType;
            console.log("[WebRTC] Incoming call detected:", incomingId, incomingType);

            // Subscribe directly to THIS call doc so we detect if caller cancels
            if (unsubIncomingCallDocRef.current) {
              unsubIncomingCallDocRef.current();
              unsubIncomingCallDocRef.current = null;
            }
            unsubIncomingCallDocRef.current = onSnapshot(doc(db, "calls", incomingId), (callSnap) => {
              // If this call is no longer relevant (we started a different call), unsubscribe
              if (callStateRef.current !== "idle" && callIdRef.current !== incomingId) {
                unsubIncomingCallDocRef.current?.();
                unsubIncomingCallDocRef.current = null;
                return;
              }
              const callData = callSnap.data();
              if (!callData) return;
              const callStatus = callData.status;
              // Caller cancelled, timed out, or declined before we answered
              if (
                callStatus === "cancelled" ||
                callStatus === "ended" ||
                callStatus === "missed" ||
                callStatus === "declined"
              ) {
                stopRingtone(incomingId);
                dismissCallNotification(incomingId);
                clearRingTimeout();
                unsubIncomingCallDocRef.current?.();
                unsubIncomingCallDocRef.current = null;
                // If we showed incoming call UI, dismiss it
                if (callStateRef.current === "idle") {
                  onCallEndedRef.current?.();
                }
              }
            });

            onIncomingCallRef.current?.(incomingId, incomingType);
          }
        }
      });
    });

    return () => unsub();
  }, [db, myId, clearRingTimeout, dismissCallNotification]);

  // ── Visibility & Network Recovery ─────────────────────────────────────────
  // IMPORTANT: visibility events must NEVER terminate a legitimate call.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && pcRef.current) {
        const ice = pcRef.current.iceConnectionState;
        if (ice === "disconnected" || ice === "failed") {
          console.log("[WebRTC] Visibility restored on disconnected ICE — triggering restartIce()");
          pcRef.current.restartIce();
        }
      }
      // Do NOT call cleanUp or endCall here — calls survive background/foreground transitions
    };

    const handleOnline = () => {
      console.log("[WebRTC] Network online — ensuring ICE continuity");
      if (pcRef.current) {
        pcRef.current.restartIce();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  // ── Return Public API ──────────────────────────────────────────────────────
  return {
    startCall,
    answerCall,
    declineCall,
    cancelCall,
    endCall,
    switchCamera,
    toggleVideo,
    isVideoEnabled,
    isPartnerVideoEnabled,
    connectionQuality,
    callId,
    callType,
    callState,
    localStream,
    remoteStream,
    isCaller,
  };
}
