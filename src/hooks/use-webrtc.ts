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

export type CallType = "audio" | "video";
export type CallState = "idle" | "ringing" | "connecting" | "active" | "ended" | "declined" | "missed";
export type ConnectionQuality = "excellent" | "good" | "fair" | "poor";

/**
 * Production WebRTC Audio Constraints:
 * - Mono voice channel (channelCount: 1) guarantees browser hardware Acoustic Echo Cancellation (AEC).
 * - Noise suppression and Automatic Gain Control (AGC) enabled.
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

/**
 * Fallback audio constraints for legacy / strict browser engines.
 */
export const FALLBACK_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

/**
 * Prioritize audio RTCRtpSender:
 * - No artificial bitrate cap (preserves pristine voice fidelity).
 * - Set priority: "high" so voice packets are never dropped during network congestion.
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
 * Apply adaptive parameters to video RTCRtpSender:
 * - Adaptive maxBitrate according to connection quality.
 * - Priority set to "medium" (audio is always higher).
 * - degradationPreference: "maintain-framerate" on weak networks to avoid jarring frozen frames.
 */
export function applyVideoSenderParameters(
  sender: RTCRtpSender,
  targetBitrate: number = 1_200_000,
  degradation: RTCDegradationPreference = "maintain-framerate"
): Promise<void> {
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{
        maxBitrate: targetBitrate,
        priority: "medium",
      }];
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

interface UseWebRTCOptions {
  myId: string;
  partnerId: string;
  onIncomingCall?: (callId: string, type: CallType) => void;
  onCallEnded?: () => void;
  onCameraError?: (errorName: string) => void;
  /** Called once per call with outcome for chat persistence */
  onCallMessage?: (callType: CallType, callStatus: "completed" | "declined" | "missed", duration?: number, callId?: string) => void;
}

export function useWebRTC({
  myId,
  partnerId,
  onIncomingCall,
  onCallEnded,
  onCameraError,
  onCallMessage,
}: UseWebRTCOptions) {
  const db = useFirestore();

  const [callId, setCallId] = useState<string | null>(null);
  const [callType, setCallType] = useState<CallType>("audio");
  const [callState, setCallState] = useState<CallState>("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(false);
  const [isPartnerVideoEnabled, setIsPartnerVideoEnabled] = useState<boolean>(false);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>("excellent");
  const [isCaller, setIsCaller] = useState(false);

  // References to preserve state across asynchronous WebRTC and network events
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

  // ICE candidate tracking & deduplication
  const seenCandidateIdsRef = useRef<Set<string>>(new Set());
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // Recovery & Stats timers
  const iceRecoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callerRingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastQualityAdjustmentRef = useRef<number>(0);

  // Firestore unsubscribers
  const unsubCallRef = useRef<(() => void) | null>(null);
  const unsubCandidatesCallerRef = useRef<(() => void) | null>(null);
  const unsubCandidatesCalleeRef = useRef<(() => void) | null>(null);

  // Synchronize dynamic refs
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

  // Tab unload handler: cleanly mark call ended in Firestore
  useEffect(() => {
    const handleUnload = () => {
      const cid = callIdRef.current;
      if (cid && db && callStateRef.current !== "idle") {
        updateDoc(doc(db, "calls", cid), {
          status: "ended",
          endedAt: serverTimestamp(),
        }).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [db]);

  /**
   * Add ICE candidate safely with deduplication and state validation.
   */
  const addCandidateSafe = useCallback(async (pc: RTCPeerConnection, data: RTCIceCandidateInit) => {
    if (!data.candidate) return;

    // Deduplication key
    const candKey = `${data.candidate}_${data.sdpMid}_${data.sdpMLineIndex}`;
    if (seenCandidateIdsRef.current.has(candKey)) return;
    seenCandidateIdsRef.current.add(candKey);

    if (!pc.remoteDescription) {
      pendingCandidatesRef.current.push(data);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(data));
    } catch (err) {
      console.warn("[WebRTC] Ignorable addIceCandidate notice:", err);
    }
  }, []);

  /**
   * Flush pending candidates once remote description is set.
   */
  const flushPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const pending = [...pendingCandidatesRef.current];
    pendingCandidatesRef.current = [];
    for (const data of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data));
      } catch (err) {
        console.warn("[WebRTC] Ignorable flush candidate notice:", err);
      }
    }
  }, []);

  /**
   * Stop stats polling
   */
  const stopStatsMonitoring = useCallback(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
  }, []);

  /**
   * Complete, idempotent cleanup: release media devices, close PC, clear listeners.
   */
  const cleanUp = useCallback((finalState: CallState = "idle") => {
    console.log("[WebRTC] Cleanly disposing session & releasing media resources…");

    stopStatsMonitoring();

    if (callerRingTimerRef.current) {
      clearTimeout(callerRingTimerRef.current);
      callerRingTimerRef.current = null;
    }

    if (iceRecoveryTimerRef.current) {
      clearTimeout(iceRecoveryTimerRef.current);
      iceRecoveryTimerRef.current = null;
    }

    if (unsubCallRef.current) { unsubCallRef.current(); unsubCallRef.current = null; }
    if (unsubCandidatesCallerRef.current) { unsubCandidatesCallerRef.current(); unsubCandidatesCallerRef.current = null; }
    if (unsubCandidatesCalleeRef.current) { unsubCandidatesCalleeRef.current(); unsubCandidatesCalleeRef.current = null; }

    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    // Explicitly stop all local tracks so microphone & camera hardware LEDs immediately turn off
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      localStreamRef.current = null;
      setLocalStream(null);
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      remoteStreamRef.current = null;
      setRemoteStream(null);
    }

    lastRenegotiationAtRef.current = 0;
    setIsVideoEnabled(false);
    setIsPartnerVideoEnabled(false);
    pendingCandidatesRef.current = [];
    seenCandidateIdsRef.current.clear();
    callStartedAtRef.current = null;
    setCallId(null);
    callIdRef.current = null;
    setCallState(finalState);
    isCallerRef.current = false;
    setIsCaller(false);
    facingModeRef.current = "user";
    setConnectionQuality("excellent");

    onCallEndedRef.current?.();
  }, [stopStatsMonitoring]);

  /**
   * Production ICE Server Configuration: STUN + authenticated TURN (UDP, TCP, TLS)
   */
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
        iceServers.push({
          urls: url,
          username: turnUsername,
          credential: turnCredential,
        });
      });
      console.log("[WebRTC] Active Authenticated TURN relay configured:", urls);
    } else {
      console.warn("[WebRTC] TURN credentials missing. Relaying on STUN only.");
    }

    return {
      iceServers,
      iceCandidatePoolSize: 10,
    };
  }, []);

  /**
   * Monitor WebRTC stats (jitter, packet loss, RTT) and adapt video bitrate dynamically.
   */
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
            if (report.jitter) {
              currentJitterMs = report.jitter * 1000;
            }
          }

          if (report.type === "candidate-pair" && report.state === "succeeded") {
            if (report.currentRoundTripTime) {
              currentRttMs = report.currentRoundTripTime * 1000;
            }
          }
        });

        // Compute connection quality
        let grade: ConnectionQuality = "excellent";
        if (currentLossPercent > 8 || currentRttMs > 350 || currentJitterMs > 80) {
          grade = "poor";
        } else if (currentLossPercent > 3 || currentRttMs > 200 || currentJitterMs > 40) {
          grade = "fair";
        } else if (currentLossPercent > 1 || currentRttMs > 100 || currentJitterMs > 25) {
          grade = "good";
        }

        setConnectionQuality((prev) => (prev !== grade ? grade : prev));

        // Video bitrate adaptation with hysteresis cooldown (at least 6s between adjustments)
        const now = Date.now();
        if (now - lastQualityAdjustmentRef.current > 6000) {
          const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (videoSender) {
            let targetBitrate = 1_500_000;
            let degradation: RTCDegradationPreference = "maintain-framerate";

            if (grade === "poor") {
              targetBitrate = 350_000;
              degradation = "maintain-framerate";
            } else if (grade === "fair") {
              targetBitrate = 700_000;
              degradation = "maintain-framerate";
            } else if (grade === "good") {
              targetBitrate = 1_100_000;
              degradation = "maintain-framerate";
            }

            applyVideoSenderParameters(videoSender, targetBitrate, degradation);
            lastQualityAdjustmentRef.current = now;
          }
        }
      } catch {
        // Ignored: stats query errors during teardown
      }
    }, 2500);
  }, [stopStatsMonitoring]);

  /**
   * Setup RTCPeerConnection with track listeners, audio priority, and ICE recovery.
   */
  const setupPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(getIceConfiguration());
    pcRef.current = pc;

    // Stable remote stream reference
    const rStream = new MediaStream();
    remoteStreamRef.current = rStream;
    setRemoteStream(rStream);

    pc.ontrack = (event) => {
      console.log("[WebRTC] Inbound remote track received:", event.track.kind);
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((t) => {
          if (!rStream.getTrackById(t.id)) rStream.addTrack(t);
        });
      } else {
        if (!rStream.getTrackById(event.track.id)) rStream.addTrack(event.track);
      }
      setRemoteStream(new MediaStream(rStream.getTracks()));
    };

    // Attach local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, localStreamRef.current!);
        if (track.kind === "audio") {
          applyAudioSenderParameters(sender);
        } else if (track.kind === "video") {
          applyVideoSenderParameters(sender);
        }
      });
    }

    // ICE state changes & resilient recovery
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log("[WebRTC] ICE Connection State:", state);

      if (state === "connected" || state === "completed") {
        if (iceRecoveryTimerRef.current) {
          clearTimeout(iceRecoveryTimerRef.current);
          iceRecoveryTimerRef.current = null;
        }
        if (!callStartedAtRef.current) callStartedAtRef.current = Date.now();
        setCallState("active");
        startStatsMonitoring(pc);
      } else if (state === "disconnected") {
        // Grace period: allow 6 seconds for ICE to recover naturally or via restart
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
        console.warn("[WebRTC] ICE failed — immediately attempting restartIce()");
        try {
          pc.restartIce();
        } catch (e) {
          console.error("[WebRTC] restartIce error:", e);
        }
      } else if (state === "closed") {
        if (callStateRef.current !== "idle") cleanUp();
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        if (!callStartedAtRef.current) callStartedAtRef.current = Date.now();
        setCallState("active");
      }
    };

    return pc;
  }, [getIceConfiguration, cleanUp, startStatsMonitoring]);

  /**
   * Acquire local stream with adaptive capability detection and graceful fallbacks.
   */
  const getLocalStream = useCallback(async (type: CallType): Promise<MediaStream> => {
    // 1. Audio Constraints resolution with fallback
    let audioConstraints: boolean | MediaTrackConstraints = PRODUCTION_AUDIO_CONSTRAINTS;

    // Test microphone access first
    let audioStream: MediaStream;
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
    } catch (err: any) {
      console.warn("[WebRTC] Ideal audio constraints rejected, falling back to standard constraints:", err);
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: FALLBACK_AUDIO_CONSTRAINTS, video: false });
      } catch (fallbackErr) {
        console.warn("[WebRTC] Standard audio constraints rejected, falling back to basic audio:", fallbackErr);
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }
    }

    if (type === "audio") {
      return audioStream;
    }

    // 2. Video constraints resolution
    const currentFacing = facingModeRef.current;
    const videoConstraints = {
      facingMode: currentFacing,
      width: { ideal: 1280, max: 1280 },
      height: { ideal: 720, max: 720 },
      frameRate: { ideal: 30, max: 30 },
    };

    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
      });
      const videoTrack = videoStream.getVideoTracks()[0];
      if (videoTrack) audioStream.addTrack(videoTrack);
      return audioStream;
    } catch (err: any) {
      console.warn("[WebRTC] Ideal video constraints failed, trying basic video:", err);
      try {
        const fallbackVideoStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: currentFacing },
        });
        const fallbackVideoTrack = fallbackVideoStream.getVideoTracks()[0];
        if (fallbackVideoTrack) audioStream.addTrack(fallbackVideoTrack);
        return audioStream;
      } catch (videoErr: any) {
        console.error("[WebRTC] Video acquisition failed entirely:", videoErr);
        if (onCameraErrorRef.current) {
          onCameraErrorRef.current(videoErr.name || "CameraError");
        }
        // Voice continues even if camera fails!
        return audioStream;
      }
    }
  }, []);

  /**
   * Atomic call outcome logger: exactly ONE call log message is written per call across devices.
   */
  const logCallOutcome = useCallback(
    async (
      targetCallId: string | null,
      type: CallType,
      status: "completed" | "declined" | "missed",
      duration?: number
    ) => {
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
          if (!callSnap.exists()) {
            wonRace = true;
            return;
          }
          const callData = callSnap.data();
          if (callData.messageLogged) {
            wonRace = false;
            return;
          }
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

  /**
   * Perfect Negotiation Snapshot Handler:
   * Handles glare resolution, polite rollback, and renegotiation without corrupting signaling state.
   */
  const handleRenegotiationSnapshot = useCallback(
    async (pc: RTCPeerConnection, cid: string, data: any) => {
      if (!data?.renegotiation || !db) return;

      // Handle inbound offer from partner
      if (
        data.renegotiation.offer &&
        data.renegotiation.from !== myId &&
        data.renegotiation.version &&
        data.renegotiation.version !== lastRenegotiationAtRef.current
      ) {
        lastRenegotiationAtRef.current = data.renegotiation.version;
        console.log("[WebRTC] Inbound renegotiation offer from partner (version:", data.renegotiation.version, ")");

        try {
          // Glare check: polite peer rolls back local offer if offer collision happens
          if (pc.signalingState === "have-local-offer") {
            const isPolite = !isCallerRef.current;
            if (isPolite) {
              console.log("[WebRTC] Polite peer resolving glare by rolling back local offer");
              await pc.setLocalDescription({ type: "rollback" });
            } else {
              console.log("[WebRTC] Impolite peer ignoring inbound offer glare");
              return;
            }
          }

          await pc.setRemoteDescription(new RTCSessionDescription(data.renegotiation.offer));
          await flushPendingCandidates(pc);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          await updateDoc(doc(db, "calls", cid), {
            "renegotiation.answer": { sdp: answer.sdp, type: answer.type },
            "renegotiation.answeredBy": myId,
          });

          // Re-affirm priorities
          const vSender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (vSender) applyVideoSenderParameters(vSender);
          const aSender = pc.getSenders().find((s) => s.track?.kind === "audio");
          if (aSender) applyAudioSenderParameters(aSender);
        } catch (err) {
          console.error("[WebRTC] Error handling renegotiation offer:", err);
        }
      }

      // Handle inbound answer from partner
      if (
        data.renegotiation?.answer &&
        data.renegotiation.answeredBy !== myId &&
        pc.signalingState === "have-local-offer"
      ) {
        console.log("[WebRTC] Inbound renegotiation answer from partner");
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.renegotiation.answer));
          await flushPendingCandidates(pc);

          const vSender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (vSender) applyVideoSenderParameters(vSender);
          const aSender = pc.getSenders().find((s) => s.track?.kind === "audio");
          if (aSender) applyAudioSenderParameters(aSender);
        } catch (err) {
          console.error("[WebRTC] Error handling renegotiation answer:", err);
        }
      }
    },
    [db, myId, flushPendingCandidates]
  );

  /**
   * Start an outgoing call
   */
  const startCall = useCallback(async (type: CallType) => {
    if (!db || !myId || !partnerId) return;

    setCallState("ringing");
    setCallType(type);
    setIsVideoEnabled(type === "video");
    isCallerRef.current = true;
    setIsCaller(true);
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

      const pc = setupPeerConnection();

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(collection(db, "calls", newCallId, "callerCandidates"), event.candidate.toJSON());
        }
      };

      const offerDesc = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offerDesc);

      await setDoc(callDocRef, {
        callerId: myId,
        calleeId: partnerId,
        type,
        status: "ringing",
        [`cam_${myId}`]: type === "video",
        offer: { sdp: offerDesc.sdp, type: offerDesc.type },
        createdAt: serverTimestamp(),
      });

      // FCM push notification to wake up recipient device
      fetch("/api/trigger-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "incoming_call",
          recipientId: partnerId,
          senderName: myId === "nabin" ? "Nabin" : "Karu",
          callId: newCallId,
          callType: type,
        }),
      }).catch((err) => {
        console.warn("[WebRTC] Trigger push notification error:", err);
      });

      // Caller 75-second ringing timeout
      if (callerRingTimerRef.current) clearTimeout(callerRingTimerRef.current);
      callerRingTimerRef.current = setTimeout(() => {
        if (callStateRef.current === "ringing" && callIdRef.current === newCallId) {
          console.log("[WebRTC] Call ringing timed out — marking missed");
          logCallOutcome(newCallId, type, "missed");
          updateDoc(doc(db, "calls", newCallId), {
            status: "missed",
            endedAt: serverTimestamp(),
          }).catch(() => {});
          cleanUp("missed");
        }
      }, 75_000);

      // Listen for answer + partner state updates
      unsubCallRef.current = onSnapshot(callDocRef, async (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        if (data[`cam_${partnerId}`] !== undefined) {
          setIsPartnerVideoEnabled(Boolean(data[`cam_${partnerId}`]));
        }

        if (data.status === "declined") {
          console.log("[WebRTC] Call declined by partner");
          cleanUp("declined");
        } else if (data.status === "ended") {
          console.log("[WebRTC] Call ended by partner");
          cleanUp("ended");
        } else if (data.answer && pc.signalingState === "have-local-offer") {
          console.log("[WebRTC] Call answered by partner");
          if (callerRingTimerRef.current) {
            clearTimeout(callerRingTimerRef.current);
            callerRingTimerRef.current = null;
          }
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            await flushPendingCandidates(pc);
            setCallState("active");
          } catch (e) {
            console.error("[WebRTC] setRemoteDescription error:", e);
          }
        }

        await handleRenegotiationSnapshot(pc, newCallId, data);
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
      cleanUp();
    }
  }, [db, myId, partnerId, getLocalStream, setupPeerConnection, logCallOutcome, cleanUp, addCandidateSafe, flushPendingCandidates, handleRenegotiationSnapshot]);

  /**
   * Answer an incoming call
   */
  const answerCall = useCallback(async (incomingCallId: string) => {
    if (!db) return;

    setCallId(incomingCallId);
    callIdRef.current = incomingCallId;
    setCallState("connecting");
    isCallerRef.current = false;
    setIsCaller(false);
    pendingCandidatesRef.current = [];
    seenCandidateIdsRef.current.clear();

    try {
      const callDocRef = doc(db, "calls", incomingCallId);
      const callSnap = await getDoc(callDocRef);
      if (!callSnap.exists()) throw new Error("Call document not found");

      const callData = callSnap.data();
      const type = callData.type as CallType;
      setCallType(type);
      setIsVideoEnabled(type === "video");

      const stream = await getLocalStream(type);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = setupPeerConnection();

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(collection(db, "calls", incomingCallId, "calleeCandidates"), event.candidate.toJSON());
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
      await flushPendingCandidates(pc);

      const answerDesc = await pc.createAnswer();
      await pc.setLocalDescription(answerDesc);

      await updateDoc(callDocRef, {
        status: "active",
        [`cam_${myId}`]: type === "video",
        answer: { sdp: answerDesc.sdp, type: answerDesc.type },
      });

      setCallState("active");

      unsubCallRef.current = onSnapshot(callDocRef, async (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        if (data[`cam_${partnerId}`] !== undefined) {
          setIsPartnerVideoEnabled(Boolean(data[`cam_${partnerId}`]));
        }

        if (data.status === "missed") {
          logCallOutcome(incomingCallId, type, "missed");
          cleanUp("ended");
        } else if (data.status === "ended") {
          if (callStartedAtRef.current) {
            const durationSec = Math.round((Date.now() - callStartedAtRef.current) / 1000);
            logCallOutcome(incomingCallId, type, "completed", durationSec);
          }
          cleanUp("ended");
        }

        await handleRenegotiationSnapshot(pc, incomingCallId, data);
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
      try {
        await updateDoc(doc(db, "calls", incomingCallId), {
          status: "declined",
          endedAt: serverTimestamp(),
        });
      } catch {}
      cleanUp();
    }
  }, [db, myId, partnerId, getLocalStream, setupPeerConnection, logCallOutcome, cleanUp, addCandidateSafe, flushPendingCandidates, handleRenegotiationSnapshot]);

  /**
   * Decline an incoming call
   */
  const declineCall = useCallback(async (incomingCallId: string, incomingCallType?: CallType) => {
    if (!db) return;
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
    cleanUp();
  }, [db, cleanUp, logCallOutcome]);

  /**
   * End active call
   */
  const endCall = useCallback(async () => {
    const cid = callIdRef.current;
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
      } catch (e) {
        console.warn("[WebRTC] Error updating call ended in Firestore:", e);
      }
    }
    cleanUp("ended");
  }, [db, cleanUp, logCallOutcome]);

  /**
   * Seamless Camera Toggle (Off/On):
   * - Off: videoTrack.enabled = false and sender.replaceTrack(null) without SDP renegotiation.
   * - On: videoTrack.enabled = true and sender.replaceTrack(videoTrack) without renegotiation.
   * - If no video track existed (audio call): acquires camera, upgrades to video, and renegotiates cleanly.
   */
  const toggleVideo = useCallback(async () => {
    const pc = pcRef.current;
    const cid = callIdRef.current;
    const existingVideoTrack = localStreamRef.current?.getVideoTracks()[0];
    const isCurrentlyActive = !!existingVideoTrack && existingVideoTrack.enabled && isVideoEnabledRef.current;

    if (isCurrentlyActive) {
      // Turn Camera OFF
      console.log("[WebRTC] Camera turned OFF — disabling track and preserving audio");
      existingVideoTrack.enabled = false;
      if (pc) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video" || s.track === existingVideoTrack);
        if (sender) {
          try {
            await sender.replaceTrack(null);
          } catch (e) {
            console.warn("[WebRTC] replaceTrack(null) notice:", e);
          }
        }
      }
      setIsVideoEnabled(false);
      if (cid && db) {
        updateDoc(doc(db, "calls", cid), { [`cam_${myId}`]: false }).catch(() => {});
      }
      return;
    }

    // Turn Camera ON
    console.log("[WebRTC] Camera turned ON");

    // Case 1: Video track already exists — reactivate without renegotiation
    if (existingVideoTrack) {
      existingVideoTrack.enabled = true;
      if (pc) {
        const sender = pc.getSenders().find((s) => s.track === existingVideoTrack || s.track === null);
        if (sender) {
          try {
            await sender.replaceTrack(existingVideoTrack);
            await applyVideoSenderParameters(sender);
          } catch (e) {
            console.warn("[WebRTC] replaceTrack(existingTrack) notice:", e);
          }
        }
      }
      setIsVideoEnabled(true);
      if (cid && db) {
        updateDoc(doc(db, "calls", cid), { [`cam_${myId}`]: true }).catch(() => {});
      }
      return;
    }

    // Case 2: No video track exists yet (audio -> video mid-call upgrade)
    const currentFacing = facingModeRef.current;
    const videoConstraints = {
      facingMode: currentFacing,
      width: { ideal: 1280, max: 1280 },
      height: { ideal: 720, max: 720 },
      frameRate: { ideal: 30, max: 30 },
    };

    let newStream: MediaStream;
    try {
      newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: videoConstraints,
      });
    } catch (err: any) {
      console.warn("[WebRTC] toggleVideo ideal constraints failed, falling back:", err);
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: currentFacing },
        });
      } catch (fallbackErr: any) {
        console.error("[WebRTC] toggleVideo camera acquisition failed:", fallbackErr);
        if (onCameraErrorRef.current) {
          onCameraErrorRef.current(fallbackErr.name || "CameraError");
        }
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

    // Attach to RTCPeerConnection
    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
    if (sender) {
      try {
        await sender.replaceTrack(newVideoTrack);
        await applyVideoSenderParameters(sender);
      } catch (e) {
        console.warn("[WebRTC] Failed to replaceTrack on sender:", e);
      }
    } else {
      const newSender = pc.addTrack(newVideoTrack, localStreamRef.current!);
      await applyVideoSenderParameters(newSender);
    }

    // Ensure audio sender remains top priority
    const audioSender = pc.getSenders().find((s) => s.track?.kind === "audio");
    if (audioSender) {
      await applyAudioSenderParameters(audioSender);
    }

    // Dispatched renegotiation offer
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const version = Date.now();
      lastRenegotiationAtRef.current = version;

      await updateDoc(doc(db, "calls", cid), {
        type: "video",
        [`cam_${myId}`]: true,
        renegotiation: {
          offer: { sdp: offer.sdp, type: offer.type },
          from: myId,
          version,
        },
      });
      console.log("[WebRTC] Mid-call video upgrade renegotiation offer dispatched successfully");
    } catch (renegErr) {
      console.error("[WebRTC] Renegotiation error on video upgrade:", renegErr);
    }
  }, [db, myId]);

  /**
   * Smooth Camera Switching (Front <-> Rear):
   * Acquires new camera first -> replaces sender track -> stops old track only after replacement succeeds.
   */
  const switchCamera = useCallback(async () => {
    if (!localStreamRef.current) return;

    const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
    if (!oldVideoTrack) return;

    const nextFacing = facingModeRef.current === "user" ? "environment" : "user";
    console.log(`[WebRTC] Switching camera to ${nextFacing}…`);

    const videoConstraints = {
      facingMode: nextFacing,
      width: { ideal: 1280, max: 1280 },
      height: { ideal: 720, max: 720 },
      frameRate: { ideal: 30, max: 30 },
    };

    let newStream: MediaStream;
    try {
      newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: videoConstraints,
      });
    } catch (err: any) {
      console.warn("[WebRTC] switchCamera ideal constraints failed, trying fallback:", err);
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: nextFacing },
        });
      } catch (fallbackErr) {
        console.error("[WebRTC] switchCamera failed completely. Retaining current camera:", fallbackErr);
        return;
      }
    }

    const newVideoTrack = newStream.getVideoTracks()[0];
    if (!newVideoTrack) {
      newStream.getTracks().forEach((t) => t.stop());
      return;
    }

    // Replace track on sender without renegotiation
    if (pcRef.current) {
      const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
        try {
          await sender.replaceTrack(newVideoTrack);
          await applyVideoSenderParameters(sender);
        } catch (replaceErr) {
          console.error("[WebRTC] sender.replaceTrack failed during camera switch:", replaceErr);
          newVideoTrack.stop();
          return;
        }
      }
    }

    // Stop old track ONLY now that the new track has been successfully attached
    oldVideoTrack.stop();

    const stream = localStreamRef.current;
    stream.removeTrack(oldVideoTrack);
    stream.addTrack(newVideoTrack);
    setLocalStream(new MediaStream(stream.getTracks()));
    facingModeRef.current = nextFacing;
    console.log("[WebRTC] Camera switched smoothly to", nextFacing);
  }, []);

  /**
   * Listen for incoming calls (idle state only)
   */
  useEffect(() => {
    if (!db || !myId) return;

    const callsColl = collection(db, "calls");
    const q = query(
      callsColl,
      where("calleeId", "==", myId),
      where("status", "==", "ringing")
    );

    const seventyFiveSecondsAgo = new Date(Date.now() - 75 * 1000);

    const unsub = onSnapshot(q, (snapshot) => {
      if (callStateRef.current !== "idle") return;

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          const createdAt = data.createdAt?.toMillis?.() ?? 0;
          if (createdAt > seventyFiveSecondsAgo.getTime()) {
            console.log("[WebRTC] Incoming call detected:", change.doc.id, data.type);
            onIncomingCallRef.current?.(change.doc.id, data.type as CallType);
          }
        }
      });
    });

    return () => unsub();
  }, [db, myId]);

  /**
   * Visibility & Network interface recovery
   */
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && pcRef.current) {
        const ice = pcRef.current.iceConnectionState;
        if (ice === "disconnected" || ice === "failed") {
          console.log("[WebRTC] Visibility restored on disconnected ICE — triggering restartIce()");
          pcRef.current.restartIce();
        }
      }
    };

    const handleOnline = () => {
      console.log("[WebRTC] Network online event — ensuring ICE continuity");
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

  return {
    startCall,
    answerCall,
    declineCall,
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

