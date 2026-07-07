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
  getDocs,
  getDoc,
  query,
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
  const unsubCallRef = useRef<(() => void) | null>(null);
  const unsubCandidatesRef1 = useRef<(() => void) | null>(null);
  const unsubCandidatesRef2 = useRef<(() => void) | null>(null);
  const isCallerRef = useRef<boolean>(false);

  // Keep ref updated
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  // Clean up WebRTC peer connection and tracks
  const cleanUp = useCallback(() => {
    console.log("Cleaning up WebRTC session...");
    if (unsubCallRef.current) {
      unsubCallRef.current();
      unsubCallRef.current = null;
    }
    if (unsubCandidatesRef1.current) {
      unsubCandidatesRef1.current();
      unsubCandidatesRef1.current = null;
    }
    if (unsubCandidatesRef2.current) {
      unsubCandidatesRef2.current();
      unsubCandidatesRef2.current = null;
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    setRemoteStream(null);
    setCallId(null);
    setCallState("idle");
    isCallerRef.current = false;

    if (onCallEnded) {
      onCallEnded();
    }
  }, [onCallEnded]);

  // Get ICE Servers configuration (STUN + TURN if provided)
  const getIceConfiguration = useCallback((): RTCConfiguration => {
    const iceServers: RTCIceServer[] = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ];

    const turnUrl = process.env.NEXT_PUBLIC_TURN_URL || "turn:openrelay.metered.ca:443";
    const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME || "openrelayproject";
    const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL || "openrelayproject";

    iceServers.push({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential,
    });


    return { iceServers };
  }, []);

  // Listen to remote tracks and set remote stream
  const setupPeerConnection = useCallback((type: CallType) => {
    const pc = new RTCPeerConnection(getIceConfiguration());
    pcRef.current = pc;

    // Create remote stream container
    const rStream = new MediaStream();
    setRemoteStream(rStream);

    pc.ontrack = (event) => {
      console.log("Remote track received:", event.track.kind);
      event.streams[0].getTracks().forEach((track) => {
        rStream.addTrack(track);
      });
    };

    // Add local tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        if (localStreamRef.current) {
          pc.addTrack(track, localStreamRef.current);
        }
      });
    }

    // ICE connection state monitoring
    pc.oniceconnectionstatechange = () => {
      console.log("ICE Connection State:", pc.iceConnectionState);
      if (pc.iceConnectionState === "connected") {
        setCallState("active");
      } else if (
        pc.iceConnectionState === "disconnected" ||
        pc.iceConnectionState === "failed" ||
        pc.iceConnectionState === "closed"
      ) {
        if (callStateRef.current === "active") {
          // If active, cleanly end the call
          updateCallStatus("ended");
        }
      }
    };

    return pc;
  }, [getIceConfiguration]);

  // Update call status in firestore
  const updateCallStatus = useCallback(async (status: CallState) => {
    if (!db || !callId) return;
    try {
      const callDocRef = doc(db, "calls", callId);
      const updates: any = { status };
      if (status === "ended" || status === "declined" || status === "missed") {
        updates.endedAt = serverTimestamp();
      }
      await updateDoc(callDocRef, updates);
    } catch (e) {
      console.error("Failed to update call status:", e);
    }
    if (status === "ended" || status === "declined" || status === "missed") {
      cleanUp();
    }
  }, [db, callId, cleanUp]);

  // Start an outgoing call
  const startCall = useCallback(async (type: CallType) => {
    if (!db || !myId || !partnerId) return;
    setCallState("ringing");
    setCallType(type);
    isCallerRef.current = true;

    try {
      // Get local media stream (request both video and audio so it's negotiated from the start)
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        if (type === "audio") {
          stream.getVideoTracks().forEach((track) => {
            track.enabled = false;
          });
        }
      } catch (e) {
        console.warn("Could not get both audio and video, falling back to audio only:", e);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      }
      localStreamRef.current = stream;
      setLocalStream(stream);

      // Create new call document
      const callCollRef = collection(db, "calls");
      const callDocRef = doc(callCollRef);
      const newCallId = callDocRef.id;
      setCallId(newCallId);

      const pc = setupPeerConnection(type);

      // ICE Candidates collection handler
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candRef = collection(db, "calls", newCallId, "callerCandidates");
          addDoc(candRef, event.candidate.toJSON());
        }
      };

      // Create offer
      const offerDescription = await pc.createOffer();
      await pc.setLocalDescription(offerDescription);

      const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
      };

      // Set call document
      await setDoc(callDocRef, {
        callerId: myId,
        calleeId: partnerId,
        type,
        status: "ringing",
        offer,
        createdAt: serverTimestamp(),
      });

      // Listen for updates on the call document (status change, answer)
      unsubCallRef.current = onSnapshot(callDocRef, async (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        if (data.status === "declined") {
          console.log("Call declined by partner");
          cleanUp();
        } else if (data.status === "ended") {
          console.log("Call ended by partner");
          cleanUp();
        } else if (data.status === "active" && pc.signalingState === "have-local-offer" && data.answer) {
          console.log("Call answered, setting remote description");
          setCallState("active");
          const answerDescription = new RTCSessionDescription(data.answer);
          await pc.setRemoteDescription(answerDescription);
        }
      });

      // Listen for callee ICE candidates
      const calleeCandidatesRef = collection(db, "calls", newCallId, "calleeCandidates");
      unsubCandidatesRef1.current = onSnapshot(calleeCandidatesRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            const candidate = new RTCIceCandidate(data);
            pc.addIceCandidate(candidate).catch((err) => {
              console.error("Error adding ice candidate:", err);
            });
          }
        });
      });

    } catch (err) {
      console.error("Failed to start call:", err);
      cleanUp();
    }
  }, [db, myId, partnerId, setupPeerConnection, cleanUp]);

  // Answer an incoming call
  const answerCall = useCallback(async (incomingCallId: string) => {
    if (!db) return;
    setCallId(incomingCallId);
    setCallState("connecting");

    try {
      const callDocRef = doc(db, "calls", incomingCallId);
      const callSnap = await getDoc(callDocRef);
      if (!callSnap.exists()) {
        throw new Error("Call does not exist");
      }
      const callData = callSnap.data();
      const type = callData.type as CallType;
      setCallType(type);

      // Get local stream (request both video and audio so it's negotiated from the start)
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        if (type === "audio") {
          stream.getVideoTracks().forEach((track) => {
            track.enabled = false;
          });
        }
      } catch (e) {
        console.warn("Could not get both audio and video, falling back to audio only:", e);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      }
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = setupPeerConnection(type);

      // Send local ICE candidates to Firestore
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candRef = collection(db, "calls", incomingCallId, "calleeCandidates");
          addDoc(candRef, event.candidate.toJSON());
        }
      };

      // Set remote offer description
      const offerDescription = new RTCSessionDescription(callData.offer);
      await pc.setRemoteDescription(offerDescription);

      // Create local answer
      const answerDescription = await pc.createAnswer();
      await pc.setLocalDescription(answerDescription);

      const answer = {
        sdp: answerDescription.sdp,
        type: answerDescription.type,
      };

      // Update call doc status to active & add answer
      await updateDoc(callDocRef, {
        status: "active",
        answer,
      });

      setCallState("active");

      // Listen to status updates on call
      unsubCallRef.current = onSnapshot(callDocRef, (snapshot) => {
        const data = snapshot.data();
        if (!data) return;
        if (data.status === "ended") {
          console.log("Call ended by partner");
          cleanUp();
        }
      });

      // Listen for caller ICE candidates
      const callerCandidatesRef = collection(db, "calls", incomingCallId, "callerCandidates");
      unsubCandidatesRef1.current = onSnapshot(callerCandidatesRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            const candidate = new RTCIceCandidate(data);
            pc.addIceCandidate(candidate).catch((err) => {
              console.error("Error adding ice candidate:", err);
            });
          }
        });
      });

    } catch (err) {
      console.error("Failed to answer call:", err);
      // Decline the call doc if we fail to connect
      await updateDoc(doc(db, "calls", incomingCallId), {
        status: "declined",
        endedAt: serverTimestamp(),
      });
      cleanUp();
    }
  }, [db, setupPeerConnection, cleanUp]);

  // Decline an incoming call
  const declineCall = useCallback(async (incomingCallId: string) => {
    if (!db) return;
    try {
      const callDocRef = doc(db, "calls", incomingCallId);
      await updateDoc(callDocRef, {
        status: "declined",
        endedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Decline call error:", e);
    }
    cleanUp();
  }, [db, cleanUp]);

  // End an active or ringing call
  const endCall = useCallback(() => {
    if (callState === "ringing" && isCallerRef.current) {
      updateCallStatus("missed");
    } else {
      updateCallStatus("ended");
    }
  }, [callState, updateCallStatus]);

  // Monitor incoming calls (runs continuously if not in call)
  useEffect(() => {
    if (!db || !myId || callState !== "idle") return;

    // Listen for calls ringing where callee is me
    const callsColl = collection(db, "calls");
    // We listen to calls created in the last 2 minutes to prevent stale calls triggering
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    
    // Using onSnapshot on the entire collection filtered client side to avoid index requirement overhead
    const unsub = onSnapshot(callsColl, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          // If ringing, directed to me, and fresh
          if (
            data.calleeId === myId &&
            data.status === "ringing" &&
            data.createdAt &&
            data.createdAt.toMillis() > twoMinutesAgo.getTime()
          ) {
            console.log("Incoming call detected:", change.doc.id);
            if (onIncomingCall) {
              onIncomingCall(change.doc.id, data.type);
            }
          }
        }
      });
    });

    return () => unsub();
  }, [db, myId, callState, onIncomingCall]);

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
  };
}
