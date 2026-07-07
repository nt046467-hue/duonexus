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
} from "firebase/firestore";

export type CallType = "audio" | "video";
export type CallState = "idle" | "ringing" | "connecting" | "active" | "ended" | "declined" | "missed";

interface UseWebRTCOptions {
  myId: string;
  partnerId: string;
  onIncomingCall?: (callId: string, type: CallType) => void;
  onCallEnded?: () => void;
}

export function useWebRTC({ myId, partnerId, onIncomingCall, onCallEnded }: UseWebRTCOptions) {
  const db = useFirestore();
  const [callId, setCallId] = useState<string | null>(null);
  const [callType, setCallType] = useState<CallType>("audio");
  const [callState, setCallState] = useState<CallState>("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callStateRef = useRef<CallState>("idle");
  // callIdRef mirrors callId state — prevents stale closures in async callbacks
  const callIdRef = useRef<string | null>(null);
  const isCallerRef = useRef<boolean>(false);

  const unsubCallRef = useRef<(() => void) | null>(null);
  const unsubCandidatesCallerRef = useRef<(() => void) | null>(null);
  const unsubCandidatesCalleeRef = useRef<(() => void) | null>(null);

  // ICE candidate buffer — holds candidates that arrive before setRemoteDescription
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const [isCaller, setIsCaller] = useState(false);

  // Keep refs updated
  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { callIdRef.current = callId; }, [callId]);

  const onIncomingCallRef = useRef(onIncomingCall);
  useEffect(() => {
    onIncomingCallRef.current = onIncomingCall;
  }, [onIncomingCall]);

  const onCallEndedRef = useRef(onCallEnded);
  useEffect(() => {
    onCallEndedRef.current = onCallEnded;
  }, [onCallEnded]);

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

    pendingCandidatesRef.current = [];
    setRemoteStream(null);
    setCallId(null);
    callIdRef.current = null;
    setCallState(finalState);
    isCallerRef.current = false;
    setIsCaller(false);

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
      iceServers.push({ urls: turnUrl, username: turnUsername, credential: turnCredential });
    } else {
      // Fallback public TURN servers
      iceServers.push(
        { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
        { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
        { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" }
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
    };

    // Add local tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        if (localStreamRef.current) pc.addTrack(track, localStreamRef.current);
      });
    }

    // ICE connection state monitoring
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log("[WebRTC] ICE state:", state);
      if (state === "connected" || state === "completed") {
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
      if (pc.connectionState === "connected") setCallState("active");
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

  // Get local user media (audio + optionally video)
  const getLocalStream = useCallback(async (type: CallType): Promise<MediaStream> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      if (type === "audio") {
        stream.getVideoTracks().forEach((t) => { t.enabled = false; });
      }
      return stream;
    } catch {
      console.warn("[WebRTC] Camera not available, falling back to audio-only");
      return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }
  }, []);

  // Start an outgoing call
  const startCall = useCallback(async (type: CallType) => {
    if (!db || !myId || !partnerId) return;
    setCallState("ringing");
    setCallType(type);
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
        offer: { sdp: offerDesc.sdp, type: offerDesc.type },
        createdAt: serverTimestamp(),
      });

      // Listen for answer + status changes
      unsubCallRef.current = onSnapshot(callDocRef, async (snapshot) => {
        const data = snapshot.data();
        if (!data) return;
        if (data.status === "declined") {
          console.log("[WebRTC] Call declined");
          cleanUp("declined");
        } else if (data.status === "ended") {
          console.log("[WebRTC] Call ended by partner");
          cleanUp("ended");
        } else if (data.answer && pc.signalingState === "have-local-offer") {
          console.log("[WebRTC] Answer received");
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            await flushPendingCandidates(pc);
            setCallState("active");
          } catch (e) {
            console.error("[WebRTC] setRemoteDescription error:", e);
          }
        }
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
      cleanUp();
    }
  }, [db, myId, partnerId, setupPeerConnection, getLocalStream, cleanUp, addCandidateSafe, flushPendingCandidates]);

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
        answer: { sdp: answerDesc.sdp, type: answerDesc.type },
      });

      setCallState("active");

      // Listen for call end by caller
      unsubCallRef.current = onSnapshot(callDocRef, (snapshot) => {
        const data = snapshot.data();
        if (!data) return;
        if (data.status === "ended" || data.status === "missed") {
          console.log("[WebRTC] Call ended by caller");
          cleanUp("ended");
        }
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
  }, [db, setupPeerConnection, getLocalStream, cleanUp, addCandidateSafe, flushPendingCandidates]);

  // Decline an incoming call
  const declineCall = useCallback(async (incomingCallId: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, "calls", incomingCallId), { status: "declined", endedAt: serverTimestamp() });
    } catch (e) {
      console.error("[WebRTC] Decline call error:", e);
    }
    cleanUp();
  }, [db, cleanUp]);

  // End an active or ringing call
  const endCall = useCallback(() => {
    // Caller cancels = "ended", not "missed" (missed is for the callee perspective)
    updateCallStatus("ended");
  }, [updateCallStatus]);

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

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    
    const unsub = onSnapshot(q, (snapshot) => {
      // Check if we are currently idle before triggering notification
      if (callStateRef.current !== "idle") return;

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          const createdAt = data.createdAt?.toMillis?.() ?? 0;
          if (createdAt > twoMinutesAgo.getTime()) {
            console.log("[WebRTC] Incoming call detected for me:", change.doc.id);
            onIncomingCallRef.current?.(change.doc.id, data.type);
          }
        } else if (change.type === "removed") {
          console.log("[WebRTC] Ringing call document removed (cancelled by caller):", change.doc.id);
          onCallEndedRef.current?.();
        }
      });
    });

    return () => unsub();
  }, [db, myId]);

  return {
    startCall,
    answerCall,
    declineCall,
    endCall,
    callId,
    callType,
    callState,
    localStream,
    remoteStream,
    isCaller,
  };
}
