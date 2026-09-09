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

export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1, // Enforces mono voice channel so hardware/browser Acoustic Echo Cancellation (AEC) is active
};

interface UseWebRTCOptions {
  myId: string;
  partnerId: string;
  onIncomingCall?: (callId: string, type: CallType) => void;
  onCallEnded?: () => void;
  onCameraError?: (errorName: string) => void;
  /** Called once per call with the outcome so the chat thread can persist a log message */
  onCallMessage?: (callType: CallType, callStatus: "completed" | "declined" | "missed", duration?: number, callId?: string) => void;
}

export function useWebRTC({ myId, partnerId, onIncomingCall, onCallEnded, onCameraError, onCallMessage }: UseWebRTCOptions) {
  const db = useFirestore();
  const [callId, setCallId] = useState<string | null>(null);
  const [callType, setCallType] = useState<CallType>("audio");
  const [callState, setCallState] = useState<CallState>("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(false);
  const [isPartnerVideoEnabled, setIsPartnerVideoEnabled] = useState<boolean>(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callStateRef = useRef<CallState>("idle");
  const facingModeRef = useRef<"user" | "environment">("user");
  // callIdRef mirrors callId state — prevents stale closures in async callbacks
  const callIdRef = useRef<string | null>(null);
  const isCallerRef = useRef<boolean>(false);
  // Tracks the wall-clock moment ICE became active — used to compute call duration
  const callStartedAtRef = useRef<number | null>(null);
  // Tracks the callType at the time the call was started to avoid stale closure in endCall
  const callTypeRef = useRef<CallType>("audio");
  const isVideoEnabledRef = useRef<boolean>(false);
  const lastRenegotiationAtRef = useRef<number>(0);
  const loggedCallIdsRef = useRef<Set<string>>(new Set());

  const unsubCallRef = useRef<(() => void) | null>(null);
  const unsubCandidatesCallerRef = useRef<(() => void) | null>(null);
  const unsubCandidatesCalleeRef = useRef<(() => void) | null>(null);

  // ICE candidate buffer — holds candidates that arrive before setRemoteDescription
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const [isCaller, setIsCaller] = useState(false);

  // Keep refs updated
  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { callIdRef.current = callId; }, [callId]);
  useEffect(() => { callTypeRef.current = callType; }, [callType]);
  useEffect(() => { isVideoEnabledRef.current = isVideoEnabled; }, [isVideoEnabled]);

  const onIncomingCallRef = useRef(onIncomingCall);
  useEffect(() => {
    onIncomingCallRef.current = onIncomingCall;
  }, [onIncomingCall]);

  const onCallEndedRef = useRef(onCallEnded);
  useEffect(() => {
    onCallEndedRef.current = onCallEnded;
  }, [onCallEnded]);

  const onCameraErrorRef = useRef(onCameraError);
  useEffect(() => {
    onCameraErrorRef.current = onCameraError;
  }, [onCameraError]);

  const onCallMessageRef = useRef(onCallMessage);
  useEffect(() => {
    onCallMessageRef.current = onCallMessage;
  }, [onCallMessage]);

  // Clean up and mark call as ended in Firestore if user reloads the tab or closes the window
  useEffect(() => {
    const handleUnload = () => {
      const cid = callIdRef.current;
      if (cid && db && callStateRef.current !== "idle") {
        const callDocRef = doc(db, "calls", cid);
        updateDoc(callDocRef, {
          status: "ended",
          endedAt: serverTimestamp(),
        }).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [db]);

  /** Safely add an ICE candidate — buffers if remote description not yet set */
  const addCandidateSafe = useCallback(async (pc: RTCPeerConnection, data: RTCIceCandidateInit) => {
    if (!pc.remoteDescription) {
      pendingCandidatesRef.current.push(data);
      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(data));
    } catch (err) {
      console.warn("[WebRTC] addIceCandidate error (ignorable):", err);
    }
  }, []);

  /** Flush buffered ICE candidates after setRemoteDescription */
  const flushPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const pending = [...pendingCandidatesRef.current];
    pendingCandidatesRef.current = [];
    for (const data of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data));
      } catch (err) {
        console.warn("[WebRTC] flushCandidate error (ignorable):", err);
      }
    }
  }, []);

  // Clean up WebRTC peer connection and tracks
  const cleanUp = useCallback((finalState: CallState = "idle") => {
    console.log("[WebRTC] Cleaning up session…");
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

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    lastRenegotiationAtRef.current = 0;
    setIsVideoEnabled(false);
    setIsPartnerVideoEnabled(false);
    pendingCandidatesRef.current = [];
    callStartedAtRef.current = null;
    setRemoteStream(null);
    setCallId(null);
    callIdRef.current = null;
    setCallState(finalState);
    isCallerRef.current = false;
    setIsCaller(false);
    facingModeRef.current = "user";

    onCallEndedRef.current?.();
  }, []);

  // Get ICE Servers configuration
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
      // Support comma-separated list of TURN URLs (e.g. "turn:relay.example.com:80,turns:relay.example.com:443")
      const urls = turnUrl.split(",").map((u) => u.trim());
      urls.forEach((url) => {
        iceServers.push({ urls: url, username: turnUsername, credential: turnCredential });
      });
      console.log("[WebRTC] Using authenticated TURN relay:", urls);
    } else {
      // ⚠️  No TURN credentials configured — calls may fail across different networks / symmetric NAT.
      // Set NEXT_PUBLIC_TURN_URL, NEXT_PUBLIC_TURN_USERNAME, NEXT_PUBLIC_TURN_CREDENTIAL in .env.local
      // (Metered.ca free tier works great: https://www.metered.ca)
      console.warn(
        "[WebRTC] TURN env vars not set (NEXT_PUBLIC_TURN_URL / USERNAME / CREDENTIAL). "
        + "Calls will rely on STUN only, which may fail on cellular or symmetric NAT."
      );
    }

    return { iceServers, iceCandidatePoolSize: 10 };
  }, []);

  // Setup peer connection
  const setupPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(getIceConfiguration());
    pcRef.current = pc;

    // Remote stream — collect ALL tracks (audio + video)
    const rStream = new MediaStream();
    setRemoteStream(rStream);

    pc.ontrack = (event) => {
      console.log("[WebRTC] Remote track:", event.track.kind);
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((track) => {
          if (!rStream.getTrackById(track.id)) rStream.addTrack(track);
        });
      } else {
        if (!rStream.getTrackById(event.track.id)) rStream.addTrack(event.track);
      }
      // Re-instantiate MediaStream reference so React state and downstream components update instantly
      setRemoteStream(new MediaStream(rStream.getTracks()));
    };

    // Add local tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        if (localStreamRef.current) {
          const sender = pc.addTrack(track, localStreamRef.current);
          if (track.kind === "video") {
            try {
              const params = sender.getParameters();
              params.encodings = [{
                maxBitrate: 2_000_000,
                priority: "high",
              }];
              // Prefer dropping framerate over resolution on congested links
              (params as any).degradationPreference = "maintain-resolution";
              sender.setParameters(params).then(() => {
                console.log("[WebRTC] Initial video bitrate constraint of 2Mbps set successfully");
              }).catch((err) => {
                console.warn("[WebRTC] Failed to set initial video bitrate constraint:", err);
              });
            } catch (err) {
              console.warn("[WebRTC] Error setting initial video encoding parameters:", err);
            }
          }
        }
      });
    }

    // ICE connection state monitoring
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log("[WebRTC] ICE state:", state);
      if (state === "connected" || state === "completed") {
        // Record the moment the call became active for duration calculation
        if (!callStartedAtRef.current) callStartedAtRef.current = Date.now();
        setCallState("active");
      } else if (state === "failed") {
        console.warn("[WebRTC] ICE failed — attempting restart");
        pc.restartIce();
      } else if (state === "disconnected") {
        setTimeout(() => {
          if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
            const cid = callIdRef.current;
            if (cid && db && callStateRef.current === "active") {
              updateDoc(doc(db, "calls", cid), { status: "ended", endedAt: serverTimestamp() }).catch(() => {});
              cleanUp();
            }
          }
        }, 5000);
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
  }, [getIceConfiguration, db, cleanUp]);

  // Update call status in Firestore — uses callIdRef (not state) to avoid stale closure
  const updateCallStatus = useCallback(async (status: CallState) => {
    const cid = callIdRef.current;
    if (!db || !cid) return;
    try {
      const updates: any = { status };
      if (status === "ended" || status === "declined" || status === "missed") {
        updates.endedAt = serverTimestamp();
      }
      await updateDoc(doc(db, "calls", cid), updates);
    } catch (e) {
      console.error("[WebRTC] Failed to update call status:", e);
    }
    if (status === "ended" || status === "declined" || status === "missed") {
      cleanUp();
    }
  }, [db, cleanUp]);

  // Atomic call outcome logger — guarantees exactly ONE call log message is written per call across devices
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

      // In-memory guard to prevent duplicate local execution
      if (loggedCallIdsRef.current.has(targetCallId)) {
        console.log(`[WebRTC] In-memory guard skipped duplicate log for call ${targetCallId}`);
        return;
      }
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
        } else {
          console.log(`[WebRTC] Call log already recorded by partner for call: ${targetCallId}, skipping duplicate write.`);
        }
      } catch (err) {
        console.error("[WebRTC] Error in atomic call-log transaction guard:", err);
        // Fallback so logs are not lost on network errors
        onCallMessageRef.current?.(type, status, duration, targetCallId);
      }
    },
    [db]
  );

  // Handle mid-call renegotiation offer/answer snapshots from partner
  const handleRenegotiationSnapshot = useCallback(
    async (pc: RTCPeerConnection, cid: string, data: any) => {
      if (!data?.renegotiation || !db) return;

      // 1. Check for renegotiation offer from partner
      if (
        data.renegotiation.offer &&
        data.renegotiation.from !== myId &&
        data.renegotiation.version &&
        data.renegotiation.version !== lastRenegotiationAtRef.current
      ) {
        lastRenegotiationAtRef.current = data.renegotiation.version;
        console.log("[WebRTC] Received renegotiation offer from partner:", data.renegotiation.version);
        try {
          if (pc.signalingState === "have-local-offer") {
            // WebRTC glare resolution: rollback local offer
            await pc.setLocalDescription({ type: "rollback" });
          }
          await pc.setRemoteDescription(new RTCSessionDescription(data.renegotiation.offer));
          await flushPendingCandidates(pc);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          await updateDoc(doc(db, "calls", cid), {
            "renegotiation.answer": { sdp: answer.sdp, type: answer.type },
            "renegotiation.answeredBy": myId,
          });
          console.log("[WebRTC] Renegotiation answer sent to partner");
        } catch (err) {
          console.error("[WebRTC] Error handling renegotiation offer:", err);
        }
      }

      // 2. Check for renegotiation answer from partner
      if (
        data.renegotiation?.answer &&
        data.renegotiation.answeredBy !== myId &&
        pc.signalingState === "have-local-offer"
      ) {
        console.log("[WebRTC] Received renegotiation answer from partner");
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.renegotiation.answer));
          await flushPendingCandidates(pc);
          console.log("[WebRTC] Renegotiation remote answer applied");
        } catch (err) {
          console.error("[WebRTC] Error handling renegotiation answer:", err);
        }
      }
    },
    [db, myId, flushPendingCandidates]
  );

  // Get local user media (explicit noise suppression, echo cancellation, autoGainControl)
  const getLocalStream = useCallback(async (type: CallType): Promise<MediaStream> => {
    if (type === "audio") {
      // Never request camera for pure audio calls
      return navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS, video: false });
    }

    const currentFacing = facingModeRef.current;
    const videoConstraints = {
      facingMode: currentFacing,
      width: { ideal: 1280, max: 1280 },
      height: { ideal: 720, max: 720 },
      frameRate: { ideal: 30, max: 30 },
    };

    try {
      return await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS, video: videoConstraints });
    } catch (err: any) {
      console.warn("[WebRTC] getUserMedia with ideal constraints failed, attempting fallback:", err);
      if (err.name === "OverconstrainedError" || err.name === "ConstraintNotSatisfiedError") {
        try {
          return await navigator.mediaDevices.getUserMedia({
            audio: AUDIO_CONSTRAINTS,
            video: { facingMode: currentFacing },
          });
        } catch (fallbackErr) {
          console.warn("[WebRTC] getUserMedia fallback failed:", fallbackErr);
        }
      }
      if (onCameraErrorRef.current) {
        onCameraErrorRef.current(err.name || "Error");
      }
      return navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS, video: false });
    }
  }, []);

  // Caller-side ringing timeout ref
  const callerRingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start an outgoing call
  const startCall = useCallback(async (type: CallType) => {
    if (!db || !myId || !partnerId) return;
    setCallState("ringing");
    setCallType(type);
    setIsVideoEnabled(type === "video");
    isCallerRef.current = true;
    setIsCaller(true);
    pendingCandidatesRef.current = [];

    try {
      const stream = await getLocalStream(type);
      localStreamRef.current = stream;
      setLocalStream(stream);

      // Create call document
      const callCollRef = collection(db, "calls");
      const callDocRef = doc(callCollRef);
      const newCallId = callDocRef.id;
      setCallId(newCallId);
      callIdRef.current = newCallId;

      const pc = setupPeerConnection();

      // ICE Candidates → callerCandidates sub-collection
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(collection(db, "calls", newCallId, "callerCandidates"), event.candidate.toJSON());
        }
      };

      // Create offer
      const offerDesc = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
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

      // Dispatch high-priority FCM push notification to wake callee's device
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

      // Caller-side 90-second ring timeout → atomic logCallOutcome so callee also doesn't duplicate
      if (callerRingTimerRef.current) clearTimeout(callerRingTimerRef.current);
      callerRingTimerRef.current = setTimeout(() => {
        if (callStateRef.current === "ringing" && callIdRef.current === newCallId) {
          console.log("[WebRTC] Ringing timeout — marking missed");
          logCallOutcome(newCallId, type, "missed");
          updateDoc(doc(db, "calls", newCallId), {
            status: "missed",
            endedAt: serverTimestamp(),
          }).catch(() => {});
          cleanUp("missed");
        }
      }, 90_000);

      // Listen for answer + status changes + mid-call renegotiations
      unsubCallRef.current = onSnapshot(callDocRef, async (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        // Monitor partner's camera on/off state in real time
        if (data[`cam_${partnerId}`] !== undefined) {
          setIsPartnerVideoEnabled(Boolean(data[`cam_${partnerId}`]));
        }

        if (data.status === "declined") {
          console.log("[WebRTC] Call declined");
          if (callerRingTimerRef.current) { clearTimeout(callerRingTimerRef.current); callerRingTimerRef.current = null; }
          cleanUp("declined");
        } else if (data.status === "ended") {
          console.log("[WebRTC] Call ended by partner");
          if (callerRingTimerRef.current) { clearTimeout(callerRingTimerRef.current); callerRingTimerRef.current = null; }
          cleanUp("ended");
        } else if (data.answer && pc.signalingState === "have-local-offer") {
          console.log("[WebRTC] Answer received");
          if (callerRingTimerRef.current) { clearTimeout(callerRingTimerRef.current); callerRingTimerRef.current = null; }
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            await flushPendingCandidates(pc);
            setCallState("active");
          } catch (e) {
            console.error("[WebRTC] setRemoteDescription error:", e);
          }
        }

        // Handle mid-call audio-to-video upgrade renegotiations
        await handleRenegotiationSnapshot(pc, newCallId, data);
      });

      // Listen for callee ICE candidates
      unsubCandidatesCalleeRef.current = onSnapshot(
        collection(db, "calls", newCallId, "calleeCandidates"),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") addCandidateSafe(pc, change.doc.data() as RTCIceCandidateInit);
          });
        }
      );

    } catch (err) {
      console.error("[WebRTC] Failed to start call:", err);
      if (callerRingTimerRef.current) { clearTimeout(callerRingTimerRef.current); callerRingTimerRef.current = null; }
      cleanUp();
    }
  }, [db, myId, partnerId, setupPeerConnection, getLocalStream, cleanUp, addCandidateSafe, flushPendingCandidates, logCallOutcome, handleRenegotiationSnapshot]);

  // Answer an incoming call
  const answerCall = useCallback(async (incomingCallId: string) => {
    if (!db) return;
    setCallId(incomingCallId);
    callIdRef.current = incomingCallId;
    setCallState("connecting");
    pendingCandidatesRef.current = [];

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

      // ICE candidates → calleeCandidates sub-collection
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(collection(db, "calls", incomingCallId, "calleeCandidates"), event.candidate.toJSON());
        }
      };

      // Set caller's offer as remote description
      await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
      await flushPendingCandidates(pc);

      // Create and set answer
      const answerDesc = await pc.createAnswer();
      await pc.setLocalDescription(answerDesc);

      // Push answer + active status to Firestore
      await updateDoc(callDocRef, {
        status: "active",
        [`cam_${myId}`]: type === "video",
        answer: { sdp: answerDesc.sdp, type: answerDesc.type },
      });

      setCallState("active");

      // Listen for call end by caller + mid-call renegotiations
      unsubCallRef.current = onSnapshot(callDocRef, async (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        // Monitor partner's camera on/off state in real time
        if (data[`cam_${partnerId}`] !== undefined) {
          setIsPartnerVideoEnabled(Boolean(data[`cam_${partnerId}`]));
        }

        if (data.status === "missed") {
          console.log("[WebRTC] Call missed (callee perspective)");
          logCallOutcome(incomingCallId, type, "missed");
          cleanUp("ended");
        } else if (data.status === "ended") {
          console.log("[WebRTC] Call ended by caller");
          if (callStartedAtRef.current) {
            const durationSec = Math.round((Date.now() - callStartedAtRef.current) / 1000);
            logCallOutcome(incomingCallId, type, "completed", durationSec);
          }
          cleanUp("ended");
        }

        // Handle mid-call audio-to-video upgrade renegotiations
        await handleRenegotiationSnapshot(pc, incomingCallId, data);
      });

      // Listen for caller ICE candidates
      unsubCandidatesCallerRef.current = onSnapshot(
        collection(db, "calls", incomingCallId, "callerCandidates"),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") addCandidateSafe(pc, change.doc.data() as RTCIceCandidateInit);
          });
        }
      );

    } catch (err) {
      console.error("[WebRTC] Failed to answer call:", err);
      try {
        await updateDoc(doc(db, "calls", incomingCallId), { status: "declined", endedAt: serverTimestamp() });
      } catch {}
      cleanUp();
    }
  }, [db, setupPeerConnection, getLocalStream, cleanUp, addCandidateSafe, flushPendingCandidates, logCallOutcome, handleRenegotiationSnapshot]);

  // Decline an incoming call
  const declineCall = useCallback(async (incomingCallId: string, incomingCallType?: CallType) => {
    if (!db) return;
    const logType = incomingCallType || callTypeRef.current;
    logCallOutcome(incomingCallId, logType, "declined");
    try {
      await updateDoc(doc(db, "calls", incomingCallId), { status: "declined", endedAt: serverTimestamp() });
    } catch (e) {
      console.error("[WebRTC] Decline call error:", e);
    }
    cleanUp();
  }, [db, cleanUp, logCallOutcome]);

  // End an active or ringing call
  const endCall = useCallback(() => {
    const cid = callIdRef.current;
    if (callStartedAtRef.current) {
      const durationSec = Math.round((Date.now() - callStartedAtRef.current) / 1000);
      logCallOutcome(cid, callTypeRef.current, "completed", durationSec);
    }
    updateCallStatus("ended");
  }, [updateCallStatus, logCallOutcome]);

  // Monitor incoming calls (runs continuously once per session)
  useEffect(() => {
    if (!db || !myId) return;

    // Listen only for fresh ringing calls directed to me
    const callsColl = collection(db, "calls");
    const q = query(
      callsColl,
      where("calleeId", "==", myId),
      where("status", "==", "ringing")
    );

    // Mirror the caller's 90-second timeout: only surface calls created in the last 90 s
    const ninetySecondsAgo = new Date(Date.now() - 90 * 1000);
    
    const unsub = onSnapshot(q, (snapshot) => {
      // Check if we are currently idle before triggering notification
      if (callStateRef.current !== "idle") return;

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          const createdAt = data.createdAt?.toMillis?.() ?? 0;
          if (createdAt > ninetySecondsAgo.getTime()) {
            console.log("[WebRTC] Fresh incoming call detected:", change.doc.id, data.type);
            onIncomingCallRef.current?.(change.doc.id, data.type as CallType);
          } else {
            console.log("[WebRTC] Ignoring stale ringing call:", change.doc.id);
          }
        }
      });
    });

    return () => unsub();
  }, [db, myId]);

  // Handle network reconnection and tab visibility changes
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        if (pcRef.current && (pcRef.current.iceConnectionState === "disconnected" || pcRef.current.iceConnectionState === "failed")) {
          console.log("[WebRTC] Tab became visible, restarting ICE");
          pcRef.current.restartIce();
        }
      }
    };

    const handleOnline = () => {
      console.log("[WebRTC] Network online detected, restarting ICE");
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

  // Flip between front and rear cameras (only when video track is present)
  const switchCamera = useCallback(async () => {
    if (!localStreamRef.current) return;

    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (!videoTrack) return;

    const nextFacing = facingModeRef.current === "user" ? "environment" : "user";
    console.log(`[WebRTC] Switching camera from ${facingModeRef.current} to ${nextFacing}`);

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
      console.warn("[WebRTC] switchCamera with ideal constraints failed, retrying...", err);
      if (err.name === "OverconstrainedError" || err.name === "ConstraintNotSatisfiedError") {
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: nextFacing },
          });
        } catch (fallbackErr) {
          console.error("[WebRTC] switchCamera fallback failed:", fallbackErr);
          return;
        }
      } else {
        console.error("[WebRTC] switchCamera failed:", err);
        return;
      }
    }

    const newVideoTrack = newStream.getVideoTracks()[0];
    if (!newVideoTrack) {
      newStream.getTracks().forEach((track) => track.stop());
      return;
    }

    if (pcRef.current) {
      const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
        try {
          await sender.replaceTrack(newVideoTrack);
          console.log("[WebRTC] RTCRtpSender video track successfully replaced.");
          const params = sender.getParameters();
          params.encodings = [{
            maxBitrate: 2_000_000,
            priority: "high",
          }];
          (params as any).degradationPreference = "maintain-resolution";
          await sender.setParameters(params);
        } catch (e) {
          console.error("[WebRTC] RTCRtpSender.replaceTrack failed:", e);
          newVideoTrack.stop();
          return;
        }
      }
    }

    videoTrack.stop();

    const oldStream = localStreamRef.current;
    oldStream.removeTrack(videoTrack);
    oldStream.addTrack(newVideoTrack);

    setLocalStream(new MediaStream(oldStream.getTracks()));
    facingModeRef.current = nextFacing;
  }, []);

  // Real Camera On/Off Toggle — supports dynamic mid-call upgrade from audio-only to video with renegotiation
  const toggleVideo = useCallback(async () => {
    const pc = pcRef.current;
    const cid = callIdRef.current;

    const existingVideoTrack = localStreamRef.current?.getVideoTracks()[0];
    const isCurrentlyActive = !!existingVideoTrack && existingVideoTrack.enabled && isVideoEnabledRef.current;

    if (isCurrentlyActive) {
      // Turn camera OFF
      console.log("[WebRTC] Turning camera OFF");
      existingVideoTrack.enabled = false;
      if (pc) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video" || s.track === existingVideoTrack);
        if (sender) {
          try {
            await sender.replaceTrack(null);
          } catch (e) {
            console.warn("[WebRTC] Failed to replaceTrack with null:", e);
          }
        }
      }
      setIsVideoEnabled(false);
      if (cid && db) {
        updateDoc(doc(db, "calls", cid), { [`cam_${myId}`]: false }).catch(() => {});
      }
      return;
    }

    // Turn camera ON
    console.log("[WebRTC] Turning camera ON");

    // Case A: video track already exists on localStream, re-enable it
    if (existingVideoTrack) {
      existingVideoTrack.enabled = true;
      if (pc) {
        const sender = pc.getSenders().find((s) => s.track === existingVideoTrack || s.track === null);
        if (sender) {
          try {
            await sender.replaceTrack(existingVideoTrack);
          } catch (e) {
            console.warn("[WebRTC] Failed to replaceTrack with existing video track:", e);
          }
        }
      }
      setIsVideoEnabled(true);
      if (cid && db) {
        updateDoc(doc(db, "calls", cid), { [`cam_${myId}`]: true }).catch(() => {});
      }
      return;
    }

    // Case B: No video track exists (e.g. started as audio call) -> Acquire camera and renegotiate
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
      console.warn("[WebRTC] toggleVideo ideal constraints failed, trying fallback:", err);
      if (err.name === "OverconstrainedError" || err.name === "ConstraintNotSatisfiedError") {
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: currentFacing },
          });
        } catch (fallbackErr) {
          console.error("[WebRTC] toggleVideo fallback failed:", fallbackErr);
          if (onCameraErrorRef.current) onCameraErrorRef.current("Error");
          return;
        }
      } else {
        console.error("[WebRTC] toggleVideo getUserMedia failed:", err);
        if (onCameraErrorRef.current) onCameraErrorRef.current(err.name || "Error");
        return;
      }
    }

    const newVideoTrack = newStream.getVideoTracks()[0];
    if (!newVideoTrack) return;

    // Add track to local stream
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
        const params = sender.getParameters();
        params.encodings = [{
          maxBitrate: 2_000_000,
          priority: "high",
        }];
        (params as any).degradationPreference = "maintain-resolution";
        await sender.setParameters(params);
      } catch (e) {
        console.warn("[WebRTC] Failed to replaceTrack on existing sender:", e);
      }
    } else {
      const newSender = pc.addTrack(newVideoTrack, localStreamRef.current!);
      try {
        const params = newSender.getParameters();
        params.encodings = [{
          maxBitrate: 2_000_000,
          priority: "high",
        }];
        (params as any).degradationPreference = "maintain-resolution";
        await newSender.setParameters(params);
      } catch (e) {
        console.warn("[WebRTC] Failed to set bitrate on new sender:", e);
      }
    }

    // Renegotiate connection
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
      console.log("[WebRTC] Upgraded audio call to video — renegotiation offer dispatched");
    } catch (renegErr) {
      console.error("[WebRTC] Failed to renegotiate video upgrade:", renegErr);
    }
  }, [db, myId]);

  return {
    startCall,
    answerCall,
    declineCall,
    endCall,
    switchCamera,
    toggleVideo,
    isVideoEnabled,
    isPartnerVideoEnabled,
    callId,
    callType,
    callState,
    localStream,
    remoteStream,
    isCaller,
  };
}
