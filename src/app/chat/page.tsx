
"use client";

import { useEffect, useState, useRef, useMemo, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  limit,
  addDoc,
  serverTimestamp,
  setDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  getDocs,
  where,
  increment,
  getDoc,
  startAfter,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  useFirestore,
  useUser,
  useCollection,
  useDoc,
  useMemoFirebase,
} from "@/firebase";
import { ChatHeader } from "@/components/chat/chat-header";
import { MessageBubble } from "@/components/chat/message-bubble";
import { MessageInput } from "@/components/chat/message-input";
import { MoodCheckin } from "@/components/chat/mood-checkin";
import { ProfileSheet } from "@/components/chat/profile-sheet";
import { useWebRTC } from "@/hooks/use-webrtc";
import { IncomingCall } from "@/components/chat/incoming-call";
import { CallScreen } from "@/components/chat/call-screen";


import {
  Heart,
  X,
  Loader2,
  Camera,
  Calendar,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  Sparkles,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { dailyAiConversationPrompt } from "@/ai/flows/daily-ai-conversation-prompt";
import { format, startOfDay, endOfDay, isToday, isYesterday } from "date-fns";

interface Message {
  id: string;
  senderUid: string;
  senderName: string;
  content: string;
  type: "text" | "image" | "audio" | "video" | "gif" | "sticker";
  timestamp: any;
  status: "sent" | "delivered" | "seen";
  waveform?: number[];
  replyToId?: string;
  replyToContent?: string;
  replyToSender?: string;
  replyToType?: "text" | "image" | "audio" | "video" | "gif" | "sticker";
  senderRole?: string;
}


const PAGE_SIZE = 40;
const SEND_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3";
const RECEIVE_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3";

export default function ChatPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user, isLoading: isAuthLoading } = useUser();
  const { toast } = useToast();

  const [dailyPrompt, setDailyPrompt] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isMemoryDialogOpen, setIsMemoryDialogOpen] = useState(false);
  const [isEditMemoryDialogOpen, setIsEditMemoryDialogOpen] = useState(false);
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const [isGeneratingSpark, setIsGeneratingSpark] = useState(false);

  const [activeTab, setActiveTab] = useState("chat");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);

  const [memoryTitle, setMemoryTitle] = useState("");
  const [memoryDate, setMemoryDate] = useState("");
  const [memoryType, setMemoryType] = useState<"milestone" | "anniversary" | "favorite">("milestone");
  const [memoryPhoto, setMemoryPhoto] = useState("");
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Profile sheet state
  const [isPartnerProfileSheetOpen, setIsPartnerProfileSheetOpen] = useState(false);

  // Chat background (synced via Firestore)
  const [chatBg, setChatBg] = useState<string | null>(null);

  // Mood state
  const [myMoodToday, setMyMoodToday] = useState<string | null>(null);
  const [partnerMoodToday, setPartnerMoodToday] = useState<string | null>(null);



  // Pagination
  const [olderMessages, setOlderMessages] = useState<Message[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const sendAudioRef = useRef<HTMLAudioElement | null>(null);
  const receiveAudioRef = useRef<HTMLAudioElement | null>(null);
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  // Track when a call becomes active to compute duration
  const callStartTimeRef = useRef<number | null>(null);

  const [myId, setMyId] = useState<string>("");

  useEffect(() => {
    sendAudioRef.current = new Audio(SEND_SOUND_URL);
    receiveAudioRef.current = new Audio(RECEIVE_SOUND_URL);

    const role = typeof window !== "undefined" ? localStorage.getItem("duonexus_role") : null;
    if (role) {
      setMyId(role);
    } else if (!isAuthLoading && !user) {
      router.push("/login");
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        swRegistrationRef.current = reg;
      });
    }
  }, [isAuthLoading, user, router]);

  const partnerId = useMemo(() => {
    if (!myId) return "";
    return myId === "nabin" ? "karu" : "nabin";
  }, [myId]);

  const partnerName = partnerId
    ? partnerId.charAt(0).toUpperCase() + partnerId.slice(1)
    : "Partner";
  const myName =
    user?.displayName || (myId ? myId.charAt(0).toUpperCase() + myId.slice(1) : "Me");

  // Calling state
  const [incomingCallInfo, setIncomingCallInfo] = useState<{ id: string; type: "audio" | "video" } | null>(null);

  // Ongoing call for rejoins
  const [ongoingCall, setOngoingCall] = useState<{ id: string; type: "audio" | "video"; callerId: string; calleeId: string } | null>(null);

  useEffect(() => {
    if (!firestore || !myId) return;
    const callsColl = collection(firestore, "calls");
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const q = query(
      callsColl,
      orderBy("createdAt", "desc"),
      limit(3)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      let foundCall = null;
      for (const d of snapshot.docs) {
        const data = d.data();
        const createdAt = data.createdAt?.toMillis?.() ?? 0;
        if (
          createdAt > fifteenMinsAgo.getTime() &&
          (data.status === "active" || data.status === "connecting" || data.status === "ringing") &&
          (data.callerId === myId || data.calleeId === myId)
        ) {
          foundCall = {
            id: d.id,
            type: data.type as "audio" | "video",
            callerId: data.callerId,
            calleeId: data.calleeId,
          };
          break;
        }
      }
      setOngoingCall(foundCall);
    });

    return () => unsub();
  }, [firestore, myId]);

  // Track if I am the initiator of the current call (ref ensures immediate read on call end)
  const amICallerRef = useRef<boolean>(false);

  const handleIncomingCall = useCallback((callId: string, type: "audio" | "video") => {
    amICallerRef.current = false;
    setIncomingCallInfo({ id: callId, type });
  }, []);

  const handleCallEnded = useCallback(() => {
    setIncomingCallInfo(null);
  }, []);

  const handleCameraError = useCallback((errName: string) => {
    toast({
      variant: "destructive",
      title: "Camera is Locked / Blocked",
      description: errName === "NotReadableError" || errName === "SourceUnavailableError"
        ? "Your camera is in use by another tab. Close the other tab or test on two separate devices to use both webcams! 📷"
        : "Could not access your camera. Please check system settings or permissions. 📷",
    });
  }, [toast]);

  const {
    startCall,
    answerCall,
    declineCall,
    endCall,
    switchCamera,
    callType,
    callState,
    localStream,
    remoteStream,
    isCaller,
  } = useWebRTC({
    myId,
    partnerId,
    onIncomingCall: handleIncomingCall,
    onCallEnded: handleCallEnded,
    onCameraError: handleCameraError,
  });

  const handleStartCall = useCallback((type: "audio" | "video") => {
    amICallerRef.current = true;
    startCall(type);
  }, [startCall]);

  // Log call events in chat thread (Messenger/Telegram style)
  const callTypeRef = useRef<"audio" | "video">("audio");
  useEffect(() => { callTypeRef.current = callType; }, [callType]);

  useEffect(() => {
    if (callState === "active") {
      // Record when the call became active
      callStartTimeRef.current = Date.now();
    } else if (
      callState === "ended" ||
      callState === "declined" ||
      callState === "missed"
    ) {
      const icon = callTypeRef.current === "video" ? "📹" : "📞";
      const callerName = myName;
      const calleeName = finalPartnerName;

      // Centralized call logging: Only the caller writes the message to the shared database
      // to prevent duplicate logs appearing in the conversation
      if (amICallerRef.current) {
        if (callState === "ended" && callStartTimeRef.current) {
          const secs = Math.round((Date.now() - callStartTimeRef.current) / 1000);
          const h = Math.floor(secs / 3600);
          const m = Math.floor((secs % 3600) / 60);
          const s = secs % 60;
          const durStr = h > 0 
            ? `${h}h ${m}m ${s}s` 
            : m > 0 
            ? `${m}m ${s}s` 
            : `${s}s`;
          handleSendMessage(`${icon} ${callerName} called ${calleeName} · ${durStr}`, "text");
        } else if (callState === "declined") {
          handleSendMessage(`${icon} Declined call from ${callerName}`, "text");
        } else {
          handleSendMessage(`${icon} Missed call from ${callerName}`, "text");
        }
      }

      callStartTimeRef.current = null;
      setIncomingCallInfo(null);
      amICallerRef.current = false; // Reset initiator state for the next call
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState]);


  // PRESENCE
  useEffect(() => {
    if (!firestore || !myId) return;
    const userPresenceRef = doc(firestore, "presence", myId);
    const setOnlineStatus = (online: boolean) => {
      setDoc(userPresenceRef, { online, lastSeen: serverTimestamp() }, { merge: true }).catch(() => {});
    };
    setOnlineStatus(true);
    const handleVisibilityChange = () =>
      setOnlineStatus(document.visibilityState === "visible");
    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", () => setOnlineStatus(true));
    window.addEventListener("blur", () => setOnlineStatus(false));
    window.addEventListener("beforeunload", () => setOnlineStatus(false));
    return () => {
      setOnlineStatus(false);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [firestore, myId]);

  // MESSAGES — latest page
  const messagesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "messages"),
      orderBy("timestamp", "desc"),
      limit(PAGE_SIZE)
    );
  }, [firestore]);

  const { data: rawMessages, loading: messagesLoading } = useCollection(messagesQuery);

  const messages = useMemo(() => {
    if (!rawMessages) return [];
    return [...rawMessages].sort((a: any, b: any) => {
      const tA = (a.timestamp?.toMillis?.() ?? (a.timestamp?.seconds ?? 0) * 1000) || Date.now();
      const tB = (b.timestamp?.toMillis?.() ?? (b.timestamp?.seconds ?? 0) * 1000) || Date.now();
      return tA - tB;
    }) as Message[];
  }, [rawMessages]);

  // Combine older + current messages — deduplicate by ID to prevent double rendering
  // when the live query window and olderMessages pagination overlap
  const allMessages = useMemo(() => {
    const map = new Map<string, Message>();
    olderMessages.forEach((m) => map.set(m.id, m));
    messages.forEach((m) => map.set(m.id, m)); // live snapshot wins on conflict
    return Array.from(map.values()).sort((a: any, b: any) => {
      const tA = (a.timestamp?.toMillis?.() ?? (a.timestamp?.seconds ?? 0) * 1000) || 0;
      const tB = (b.timestamp?.toMillis?.() ?? (b.timestamp?.seconds ?? 0) * 1000) || 0;
      return tA - tB;
    });
  }, [olderMessages, messages]);

  // Build a lookup map for replies
  const messageMap = useMemo(() => {
    const map: Record<string, Message> = {};
    allMessages.forEach((m) => (map[m.id] = m));
    return map;
  }, [allMessages]);

  // LOAD MORE (pagination)
  const loadMoreMessages = useCallback(async () => {
    if (!firestore || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const oldest = rawMessages?.[rawMessages.length - 1];
      const cursor = oldest ?? lastDoc;
      const q = query(
        collection(firestore, "messages"),
        orderBy("timestamp", "desc"),
        startAfter(cursor),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      if (snap.empty || snap.docs.length < PAGE_SIZE) setHasMore(false);
      const fetched = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) } as Message))
        .sort((a, b) => {
          const tA = (a.timestamp?.toMillis?.() ?? (a.timestamp?.seconds ?? 0) * 1000) || Date.now();
          const tB = (b.timestamp?.toMillis?.() ?? (b.timestamp?.seconds ?? 0) * 1000) || Date.now();
          return tA - tB;
        });
      setOlderMessages((prev) => [...fetched, ...prev]);
      if (snap.docs.length > 0) setLastDoc(snap.docs[snap.docs.length - 1]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingMore(false);
    }
  }, [firestore, rawMessages, lastDoc, isLoadingMore, hasMore]);

  const partnerProfileRef = useMemoFirebase(() => {
    if (!firestore || !partnerId) return null;
    return doc(firestore, "profiles", partnerId);
  }, [firestore, partnerId]);
  const { data: partnerProfile } = useDoc(partnerProfileRef);

  const partnerAvatar =
    partnerProfile?.photoURL || `https://picsum.photos/seed/${partnerName}/500/500`;

  // AUTO-SCROLL on new messages — only when already at bottom
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    if (isAtBottom) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    } else {
      // Count incoming partner messages while scrolled up
      const last = messages[messages.length - 1];
      const isLastMe = last ? (last.senderRole ? last.senderRole === myId : last.senderUid === user?.uid) : false;
      if (last && !isLastMe) {
        setNewMessageCount((c) => c + 1);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, dailyPrompt]);

  // STATUS + NOTIFICATION logic
  useEffect(() => {
    if (!firestore || !user || messages.length === 0) return;
    const latestMessage = messages[messages.length - 1];
    const isFocused = document.hasFocus() && document.visibilityState === "visible";

    if (latestMessage.id !== lastMessageIdRef.current) {
      const isLatestMe = latestMessage.senderRole
        ? latestMessage.senderRole === myId
        : latestMessage.senderUid === user.uid;

      if (!isLatestMe) {
        receiveAudioRef.current?.play().catch(() => {});
        if (
          swRegistrationRef.current &&
          Notification.permission === "granted" &&
          !isFocused
        ) {
          swRegistrationRef.current.showNotification(
            `${partnerProfile?.displayName || partnerName}`,
            {
              body:
                latestMessage.type === "text"
                  ? latestMessage.content
                  : latestMessage.type === "image"
                  ? "📷 Sent a photo"
                  : latestMessage.type === "video"
                  ? "🎥 Sent a video"
                  : latestMessage.type === "sticker"
                  ? "💝 Sent a sticker"
                  : "🎵 Sent a voice note",
              // Partner avatar as left circle icon — like WhatsApp/Messenger
              icon: partnerAvatar || `${window.location.origin}/icon-192.png`,
              // Show the actual photo inline for image messages
              image: latestMessage.type === "image" ? latestMessage.content : undefined,
              badge: `${window.location.origin}/icon-192.png`,
              tag: "duonexus-msg",
              renotify: true,
              data: { url: window.location.origin },
            } as any
          );
        }
      }
      lastMessageIdRef.current = latestMessage.id;
    }

    // Delivered + seen
    messages.forEach((msg) => {
      const isMsgMe = msg.senderRole ? msg.senderRole === myId : msg.senderUid === user.uid;
      if (!isMsgMe) {
        const msgRef = doc(firestore, "messages", msg.id);
        if (msg.status === "sent") {
          updateDoc(msgRef, { status: "delivered" }).catch(() => {});
        }
        if (isFocused && msg.status !== "seen") {
          updateDoc(msgRef, { status: "seen" }).catch(() => {});
        }
      }
    });
  }, [messages, user, firestore, partnerProfile, partnerName, partnerAvatar, myId]);

  // STREAK LOGIC (client-computed)
  useEffect(() => {
    if (!firestore || !myId || !partnerId) return;

    const computeStreak = async () => {
      try {
        const statsRef = doc(firestore, "stats", "global");
        const statsSnap = await getDoc(statsRef);
        const stats = statsSnap.data() || {};

        const todayStr = format(new Date(), "yyyy-MM-dd");
        if (stats.lastStreakDate === todayStr) return; // already computed today

        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());

        const msgsSnap = await getDocs(
          query(
            collection(firestore, "messages"),
            where("timestamp", ">=", todayStart),
            where("timestamp", "<=", todayEnd)
          )
        );

        const senderRoles = new Set(
          msgsSnap.docs.map((d) => d.data().senderRole || d.data().senderName?.toLowerCase())
        );
        const bothMessaged = senderRoles.has("nabin") && senderRoles.has("karu");

        if (bothMessaged) {
          const newStreak = (stats.streak || 0) + 1;
          await setDoc(
            statsRef,
            {
              streak: newStreak,
              lastStreakDate: todayStr,
              longestStreak: Math.max(newStreak, stats.longestStreak || 0),
            },
            { merge: true }
          );
        } else {
          // Check if a day was missed
          if (stats.lastStreakDate) {
            const last = new Date(stats.lastStreakDate);
            const diffDays = Math.floor(
              (todayStart.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (diffDays > 1) {
              await setDoc(statsRef, { streak: 0, lastStreakDate: todayStr }, { merge: true });
            }
          }
        }
      } catch (e) {
        console.error("Streak compute error:", e);
      }
    };

    computeStreak();
  }, [firestore, myId, partnerId]);

  // MOOD — load today's moods
  useEffect(() => {
    if (!firestore || !myId || !partnerId) return;
    const todayStr = format(new Date(), "yyyy-MM-dd");

    const q = query(
      collection(firestore, "moods"),
      where("date", "==", todayStr)
    );
    const unsub = onSnapshot(q, (snap) => {
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.userId === myId) setMyMoodToday(data.emoji);
        if (data.userId === partnerId) setPartnerMoodToday(data.emoji);
      });
    });
    return () => unsub();
  }, [firestore, myId, partnerId]);

  const handleSelectMood = async (emoji: string) => {
    if (!firestore || !myId) return;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    await addDoc(collection(firestore, "moods"), {
      userId: myId,
      emoji,
      date: todayStr,
      timestamp: serverTimestamp(),
    });
    setMyMoodToday(emoji);
  };



  const memoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "memories"), orderBy("date", "desc"));
  }, [firestore]);
  const { data: memories } = useCollection(memoriesQuery);

  const partnerPresenceRef = useMemoFirebase(() => {
    if (!firestore || !partnerId) return null;
    return doc(firestore, "presence", partnerId);
  }, [firestore, partnerId]);
  const { data: partnerPresence } = useDoc(partnerPresenceRef);

  const statsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, "stats", "global");
  }, [firestore]);
  const { data: globalStats } = useDoc(statsRef);

  // CHAT BACKGROUND — real-time sync across both devices
  useEffect(() => {
    if (!firestore) return;
    const settingsRef = doc(firestore, "settings", "shared");
    const unsub = onSnapshot(settingsRef, (snap) => {
      const data = snap.data();
      if (data?.chatBg) setChatBg(data.chatBg);
      else setChatBg(null);
    });
    return () => unsub();
  }, [firestore]);

  // AI Sparks
  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, "sparks"), orderBy("timestamp", "desc"), limit(1));
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setDailyPrompt(data.prompt);
        setShowPrompt(true);
      }
    });
    return () => unsub();
  }, [firestore]);

  const handleSendMessage = async (
    content: string,
    type: "text" | "image" | "audio" | "video" | "gif" | "sticker",
    waveform?: number[]
  ) => {

    if (!firestore || !user) return;
    sendAudioRef.current?.play().catch(() => {});

    const messageData: any = {
      senderUid: user.uid,
      senderName: myName,
      senderRole: myId,
      content,
      type,
      timestamp: serverTimestamp(),
      status: "sent",
    };

    if (waveform && waveform.length > 0) {
      messageData.waveform = waveform;
    }

    // Reply fields
    if (replyingTo) {
      messageData.replyToId = replyingTo.id;
      messageData.replyToContent = replyingTo.content;
      messageData.replyToSender = replyingTo.senderName;
      messageData.replyToType = replyingTo.type;
    }

    await addDoc(collection(firestore, "messages"), messageData);
    setReplyingTo(null);
  };

  const handleTyping = (isTyping: boolean) => {
    if (!firestore || !myId) return;
    setDoc(
      doc(firestore, "typing", myId),
      { isTyping, lastUpdated: serverTimestamp() },
      { merge: true }
    );
  };

  const handleGenerateSpark = async () => {
    if (!firestore) return;
    setIsGeneratingSpark(true);
    try {
      const q = query(
        collection(firestore, "messages"),
        orderBy("timestamp", "desc"),
        limit(5)
      );
      const historySnap = await getDocs(q);
      const historyText = historySnap.docs
        .map((d) => d.data().content)
        .filter((c) => typeof c === "string" && c.length < 200)
        .join("\n");
      const result = await dailyAiConversationPrompt({ pastChatHistory: historyText });
      await addDoc(collection(firestore, "sparks"), {
        prompt: result.prompt,
        timestamp: serverTimestamp(),
        createdBy: user?.uid || "system",
      });
      toast({ title: "Love Spark Generated! ✨", description: "A new topic for you two." });
    } catch (e) {
      toast({ variant: "destructive", title: "AI Busy", description: "Could not generate spark right now." });
    } finally {
      setIsGeneratingSpark(false);
    }
  };

  // Returns the spark prompt string so CallScreen can show it as an overlay during calls
  const handleGenerateSparkForCall = async (): Promise<string | undefined> => {
    try {
      const result = await dailyAiConversationPrompt({});
      return result.prompt;
    } catch {
      return "What is your favourite memory of us from this week? 💕";
    }
  };

  // Reply handler from bubble
  const handleReplySelect = (messageId: string) => {
    const msg = messageMap[messageId];
    if (msg) setReplyingTo(msg);
  };

  // Scroll to message handler
  const handleScrollToMessage = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 1500);
    }
  };

  const handleSaveMemory = async () => {
    if (!firestore || !user || !memoryTitle.trim() || !memoryDate) {
      toast({ variant: "destructive", title: "Wait!", description: "Please fill in title and date." });
      return;
    }
    setIsSavingMemory(true);
    try {
      await addDoc(collection(firestore, "memories"), {
        title: memoryTitle,
        date: memoryDate,
        type: memoryType,
        photoURL: memoryPhoto,
        createdBy: user.uid,
        timestamp: serverTimestamp(),
      });
      toast({ title: "Memory Saved!", description: "Another milestone captured ❤️" });
      setIsMemoryDialogOpen(false);
      resetMemoryForm();
    } catch (e) {
      toast({ variant: "destructive", title: "Oops!", description: "Failed to save memory." });
    } finally {
      setIsSavingMemory(false);
    }
  };

  const handleUpdateMemory = async () => {
    if (!firestore || !editingMemoryId || !memoryTitle.trim() || !memoryDate) {
      toast({ variant: "destructive", title: "Wait!", description: "Please fill in title and date." });
      return;
    }
    setIsSavingMemory(true);
    try {
      await updateDoc(doc(firestore, "memories", editingMemoryId), {
        title: memoryTitle,
        date: memoryDate,
        type: memoryType,
        photoURL: memoryPhoto,
      });
      toast({ title: "Memory Updated", description: "Changes saved successfully ❤️" });
      setIsEditMemoryDialogOpen(false);
      resetMemoryForm();
    } catch (e) {
      toast({ variant: "destructive", title: "Oops!", description: "Failed to update memory." });
    } finally {
      setIsSavingMemory(false);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, "memories", id));
      toast({ title: "Memory Removed", description: "The milestone was deleted." });
    } catch (e) {
      toast({ variant: "destructive", title: "Oops!", description: "Failed to delete memory." });
    }
  };

  const resetMemoryForm = () => {
    setMemoryTitle("");
    setMemoryDate("");
    setMemoryType("milestone");
    setMemoryPhoto("");
    setEditingMemoryId(null);
  };

  const openEditDialog = (memory: any) => {
    setEditingMemoryId(memory.id);
    setMemoryTitle(memory.title);
    setMemoryDate(memory.date);
    setMemoryType(memory.type);
    setMemoryPhoto(memory.photoURL || "");
    setIsEditMemoryDialogOpen(true);
  };

  if (isAuthLoading)
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background gap-6">
        <div className="relative flex items-center justify-center">
          <div className="w-20 h-20 border-[3px] border-primary/10 border-t-primary rounded-full animate-spin" />
          <Heart className="absolute w-6 h-6 text-primary fill-primary animate-pulse" />
        </div>
        <div className="text-primary font-headline uppercase tracking-[0.3em] text-[11px] font-bold">
          Connecting DuoNexus...
        </div>
      </div>
    );

  const finalPartnerName = partnerProfile?.displayName || partnerName;

  return (
    <div className="flex flex-col h-dynamic-screen w-full bg-background overflow-hidden relative items-center">


      <div
        className={`flex-1 flex flex-col h-full w-full max-w-2xl bg-background relative overflow-hidden shadow-2xl border-x border-primary/5 ${chatBg ? 'chat-bg-custom' : 'chat-bg-theme'}`}
        style={chatBg ? { backgroundImage: `url(${chatBg})` } : undefined}
      >
        <ChatHeader
          partnerName={finalPartnerName}
          partnerAvatar={partnerAvatar}
          isOnline={partnerPresence?.online || false}
          streak={globalStats?.streak || 0}
          countdownLabel="Our Date"
          onGenerateSpark={handleGenerateSpark}
          isGeneratingSpark={isGeneratingSpark}
          partnerId={partnerId}
          myMood={myMoodToday}
          partnerMood={partnerMoodToday}
          onAudioCall={() => handleStartCall("audio")}
          onVideoCall={() => handleStartCall("video")}
        />


        {/* Page-level partner profile sheet (opened from bubble avatar taps) */}
        <ProfileSheet
          open={isPartnerProfileSheetOpen}
          onClose={() => setIsPartnerProfileSheetOpen(false)}
          mode="partner"
          displayName={finalPartnerName}
          photoURL={partnerAvatar}
          isOnline={partnerPresence?.online || false}
          streak={globalStats?.streak || 0}
          onAudioCall={() => handleStartCall("audio")}
          onVideoCall={() => handleStartCall("video")}
        />



        <main className="flex-1 flex flex-col overflow-hidden relative h-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden h-full">
            <div className="px-4 py-2 bg-background/80 backdrop-blur-md border-b border-primary/5 z-10 shrink-0">
              <TabsList className="grid w-full grid-cols-2 rounded-full bg-muted/50 p-1 h-9">
                <TabsTrigger
                  value="chat"
                  className="rounded-full text-[10px] uppercase font-headline tracking-widest py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  Our Chat
                </TabsTrigger>
                <TabsTrigger
                  value="memories"
                  className="rounded-full text-[10px] uppercase font-headline tracking-widest py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  Memories
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="chat"
              forceMount
              className="m-0 relative data-[state=inactive]:hidden h-full data-[state=active]:flex-1 data-[state=active]:flex data-[state=active]:flex-col data-[state=active]:overflow-hidden"
            >
              {/* Ongoing Call Rejoin/Recovery Banner */}
              {ongoingCall && callState === "idle" && (
                <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2.5 flex items-center justify-between animate-in slide-in-from-top duration-300 z-20 shrink-0 select-none">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <p className="text-[10px] font-headline uppercase tracking-widest text-emerald-500 font-bold">
                      Active call in progress...
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3.5 text-[9px] uppercase tracking-widest font-headline bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white rounded-full font-bold active:scale-95 transition-transform"
                      onClick={() => {
                        answerCall(ongoingCall.id);
                      }}
                    >
                      Rejoin
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3.5 text-[9px] uppercase tracking-widest font-headline bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-500 border border-red-500/10 rounded-full font-bold active:scale-95 transition-transform"
                      onClick={async () => {
                        if (firestore) {
                          await updateDoc(doc(firestore, "calls", ongoingCall.id), {
                            status: "ended",
                            endedAt: serverTimestamp(),
                          });
                        }
                      }}
                    >
                      End Call
                    </Button>
                  </div>
                </div>
              )}

              {/* Mood check-in banner */}
              <MoodCheckin
                myId={myId}
                myMoodToday={myMoodToday}
                partnerMoodToday={partnerMoodToday}
                partnerName={finalPartnerName}
                onSelectMood={handleSelectMood}
              />

              <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto px-3 py-3 scrollbar-hide bg-background/50"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
                  setIsAtBottom(atBottom);
                  if (atBottom) setNewMessageCount(0);
                }}
              >
                <div className="flex flex-col min-h-full justify-end">
                  {/* Load more button */}
                  {hasMore && allMessages.length >= PAGE_SIZE && (
                    <div className="flex justify-center py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[10px] font-headline uppercase tracking-widest text-primary/60 hover:text-primary gap-1.5 rounded-full"
                        onClick={loadMoreMessages}
                        disabled={isLoadingMore}
                      >
                        {isLoadingMore ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <ChevronUp className="w-3 h-3" />
                        )}
                        {isLoadingMore ? "Loading..." : "Load older messages"}
                      </Button>
                    </div>
                  )}

                  {allMessages.length === 0 && !messagesLoading && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
                      {/* Floating hearts animation */}
                      <div className="relative w-28 h-36 mb-2">
                        {[
                          { size: "w-8 h-8", delay: "0s", left: "50%", dur: "3s", opacity: "opacity-90" },
                          { size: "w-5 h-5", delay: "0.8s", left: "25%", dur: "3.5s", opacity: "opacity-60" },
                          { size: "w-6 h-6", delay: "1.5s", left: "75%", dur: "2.8s", opacity: "opacity-75" },
                          { size: "w-4 h-4", delay: "2.2s", left: "40%", dur: "4s", opacity: "opacity-50" },
                          { size: "w-5 h-5", delay: "0.4s", left: "65%", dur: "3.2s", opacity: "opacity-65" },
                        ].map((h, i) => (
                          <Heart
                            key={i}
                            className={`absolute bottom-0 ${h.size} text-primary fill-primary ${h.opacity}`}
                            style={{
                              left: h.left,
                              transform: "translateX(-50%)",
                              animation: `floatHeart ${h.dur} ${h.delay} infinite ease-in`,
                            }}
                          />
                        ))}
                      </div>
                      <p className="font-headline text-base tracking-tight text-foreground/70 mt-2">
                        Your private space is ready 💕
                      </p>
                      <p className="text-[11px] text-muted-foreground/50 mt-1 font-headline uppercase tracking-widest">
                        Say something sweet ✨
                      </p>
                    </div>
                  )}

                  {allMessages.map((msg, idx) => {
                    const prevMsg = allMessages[idx - 1];
                    const nextMsg = allMessages[idx + 1];
                    const isFirstInGroup =
                      !prevMsg || prevMsg.senderUid !== msg.senderUid;
                    const isLastInGroup =
                      !nextMsg || nextMsg.senderUid !== msg.senderUid;

                    // Date separator
                    const msgTs = msg.timestamp?.seconds
                      ? msg.timestamp.seconds * 1000
                      : Date.now();
                    const prevTs = prevMsg?.timestamp?.seconds
                      ? prevMsg.timestamp.seconds * 1000
                      : null;
                    const msgDay = format(new Date(msgTs), "yyyy-MM-dd");
                    const prevDay = prevTs ? format(new Date(prevTs), "yyyy-MM-dd") : null;
                    const showDateSep = !prevDay || msgDay !== prevDay;
                    const dateLabel = isToday(new Date(msgTs))
                      ? "Today"
                      : isYesterday(new Date(msgTs))
                      ? "Yesterday"
                      : format(new Date(msgTs), "EEEE, MMM d");

                    return (
                      <Fragment key={msg.id}>
                        {showDateSep && (
                          <div className="flex items-center justify-center my-3 select-none">
                            <span className="text-[10px] font-headline uppercase tracking-widest text-muted-foreground/60 bg-background/70 backdrop-blur-sm border border-primary/10 rounded-full px-3 py-1">
                              {dateLabel}
                            </span>
                          </div>
                        )}
                        <MessageBubble
                          key={msg.id}
                          id={msg.id}
                          content={msg.content}
                          type={msg.type || "text"}
                          timestamp={
                            msgTs
                          }
                          isMe={
                            // Use senderRole for identity comparison — Firebase anonymous UIDs
                            // change on every new login, so uid-based comparison breaks after re-login.
                            // senderRole ('nabin'/'karu') is stable and set at send time.
                            msg.senderRole
                              ? msg.senderRole === myId
                              : msg.senderUid === user?.uid
                          }
                          status={msg.status}
                          waveform={msg.waveform}
                          replyToId={msg.replyToId}
                          replyToContent={msg.replyToContent}
                          replyToSender={msg.replyToSender}
                          replyToType={msg.replyToType}
                          onReply={handleReplySelect}
                          onScrollToMessage={handleScrollToMessage}
                          isFirstInGroup={isFirstInGroup}
                          isLastInGroup={isLastInGroup}
                          partnerAvatar={partnerAvatar}
                          partnerInitial={finalPartnerName?.[0]?.toUpperCase() || "P"}
                          onAvatarClick={() => setIsPartnerProfileSheetOpen(true)}
                        />
                      </Fragment>
                    );
                  })}

                </div>
              </div>

              {/* Scroll-to-bottom FAB */}
              {!isAtBottom && (
                <div className="absolute bottom-24 right-4 z-20 pointer-events-none flex justify-end">
                  <button
                    onClick={() => {
                      scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: "smooth" });
                      setNewMessageCount(0);
                    }}
                    className="pointer-events-auto w-10 h-10 bg-primary text-primary-foreground rounded-full shadow-xl shadow-primary/20 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform relative"
                    aria-label="Scroll to bottom"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 3v10M3 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {newMessageCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-background text-primary text-[9px] font-headline font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 border-primary px-1">
                        {newMessageCount > 9 ? "9+" : newMessageCount}
                      </span>
                    )}
                  </button>
                </div>
              )}

              <div className="shrink-0 flex flex-col bg-background/90 backdrop-blur-xl border-t border-primary/5 pb-safe z-10">
                {showPrompt && dailyPrompt && (
                  <div className="mx-4 mt-2 p-3 bg-primary/10 border border-primary/20 rounded-xl relative animate-in slide-in-from-bottom-2 shadow-sm">
                    <button
                      onClick={() => setShowPrompt(false)}
                      className="absolute top-2 right-2 text-primary/60 hover:text-primary touch-manipulation"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-primary fill-primary" />
                      <span className="text-[10px] font-headline uppercase text-primary tracking-tighter">
                        AI Love Spark
                      </span>
                    </div>
                    <p className="text-sm font-medium pr-6 leading-tight">{dailyPrompt}</p>
                  </div>
                )}

                <div className="px-3 py-2.5">
                  <MessageInput
                    onSendMessage={handleSendMessage}
                    onTyping={handleTyping}
                    replyingTo={
                      replyingTo
                        ? {
                            id: replyingTo.id,
                            senderName: replyingTo.senderName,
                            content: replyingTo.content,
                            type: replyingTo.type,
                          }
                        : null
                    }
                    onCancelReply={() => setReplyingTo(null)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent
              value="memories"
              forceMount
              className="m-0 data-[state=inactive]:hidden h-full px-4 scrollbar-hide data-[state=active]:flex-1 data-[state=active]:flex data-[state=active]:flex-col data-[state=active]:justify-start data-[state=active]:overflow-y-auto"
            >
              <div className="w-full pt-0 pb-24 space-y-6">
                <div className="flex items-center justify-between py-4">
                  <h3 className="font-headline text-xl font-bold tracking-tight">Our Milestones</h3>
                  <Dialog open={isMemoryDialogOpen} onOpenChange={setIsMemoryDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-[10px] font-headline uppercase tracking-widest gap-2 rounded-full border-primary/20 hover:bg-primary/5"
                      >
                        <Plus className="w-3 h-3 text-primary" /> Add New
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[90vw] max-w-[425px] rounded-[2.5rem] border-primary/5 p-8">
                      <DialogHeader>
                        <DialogTitle className="font-headline text-xl text-left">
                          Add a Memory
                        </DialogTitle>
                        <DialogDescription className="text-xs text-left">
                          Capture a special moment for your shared history.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase tracking-widest font-headline opacity-60">
                            Memory Title
                          </Label>
                          <Input
                            placeholder="e.g. First Date"
                            value={memoryTitle}
                            onChange={(e) => setMemoryTitle(e.target.value)}
                            className="rounded-2xl h-11"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-headline opacity-60">
                              Date
                            </Label>
                            <Input
                              type="date"
                              value={memoryDate}
                              onChange={(e) => setMemoryDate(e.target.value)}
                              className="text-xs rounded-2xl h-11"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-headline opacity-60">
                              Type
                            </Label>
                            <Select
                              value={memoryType}
                              onValueChange={(val: any) => setMemoryType(val)}
                            >
                              <SelectTrigger className="text-xs h-11 rounded-2xl">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-2xl">
                                <SelectItem value="anniversary">Anniversary</SelectItem>
                                <SelectItem value="milestone">Milestone</SelectItem>
                                <SelectItem value="favorite">Favorite</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={handleSaveMemory}
                          disabled={isSavingMemory}
                          className="w-full font-headline uppercase tracking-widest text-[11px] h-12 rounded-2xl shadow-lg shadow-primary/20"
                        >
                          {isSavingMemory ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Save Milestone"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {memories && memories.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {memories.map((m: any) => (
                      <div
                        key={m.id}
                        className="bg-card border border-primary/5 rounded-[2.5rem] p-5 flex gap-5 items-center group shadow-sm hover:border-primary/20 transition-all"
                      >
                        <div className="h-20 w-20 bg-primary/5 rounded-[1.5rem] flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                          {m.photoURL ? (
                            <img src={m.photoURL} className="object-cover h-full w-full" />
                          ) : (
                            <Calendar className="w-8 h-8 text-primary/40" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-headline text-base font-bold truncate">{m.title}</h4>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                              {m.date}
                            </span>
                            <span className="w-1 h-1 bg-muted-foreground/20 rounded-full" />
                            <span className="text-[10px] text-primary font-headline uppercase tracking-tighter">
                              {m.type}
                            </span>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full h-9 w-9 text-muted-foreground/40 hover:text-primary"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="rounded-xl border-primary/10 shadow-xl bg-background/95 backdrop-blur-xl"
                          >
                            <DropdownMenuItem
                              onClick={() => openEditDialog(m)}
                              className="gap-2 focus:bg-primary/10 rounded-lg"
                            >
                              <Edit2 className="w-3.5 h-3.5" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteMemory(m.id)}
                              className="gap-2 focus:bg-destructive/10 text-destructive rounded-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 opacity-30 text-center">
                    <div className="p-8 bg-primary/5 rounded-full mb-6">
                      <Camera className="w-16 h-16 text-primary/40" />
                    </div>
                    <p className="text-sm font-headline uppercase tracking-[0.2em]">
                      Our history starts here.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Edit Memory Dialog */}
      <Dialog open={isEditMemoryDialogOpen} onOpenChange={setIsEditMemoryDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[425px] rounded-[2.5rem] border-primary/5 p-8">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl text-left">Edit Memory</DialogTitle>
            <DialogDescription className="text-xs text-left">
              Update the details of your special moment.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-widest font-headline opacity-60">
                Memory Title
              </Label>
              <Input
                placeholder="e.g. First Date"
                value={memoryTitle}
                onChange={(e) => setMemoryTitle(e.target.value)}
                className="rounded-2xl h-11"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest font-headline opacity-60">
                  Date
                </Label>
                <Input
                  type="date"
                  value={memoryDate}
                  onChange={(e) => setMemoryDate(e.target.value)}
                  className="text-xs rounded-2xl h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest font-headline opacity-60">
                  Type
                </Label>
                <Select value={memoryType} onValueChange={(val: any) => setMemoryType(val)}>
                  <SelectTrigger className="text-xs h-11 rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="anniversary">Anniversary</SelectItem>
                    <SelectItem value="milestone">Milestone</SelectItem>
                    <SelectItem value="favorite">Favorite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleUpdateMemory}
              disabled={isSavingMemory}
              className="w-full font-headline uppercase tracking-widest text-[11px] h-12 rounded-2xl shadow-lg shadow-primary/20"
            >
              {isSavingMemory ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calling Overlays */}
      {incomingCallInfo && callState === "idle" && (
        <IncomingCall
          partnerName={finalPartnerName}
          partnerAvatar={partnerAvatar}
          callType={incomingCallInfo.type}
          onAccept={() => answerCall(incomingCallInfo.id)}
          onDecline={() => declineCall(incomingCallInfo.id)}
        />
      )}

      {callState !== "idle" && callState !== "ended" && callState !== "declined" && callState !== "missed" && (
        <CallScreen
          partnerName={finalPartnerName}
          partnerAvatar={partnerAvatar}
          callType={callType}
          callState={callState}
          localStream={localStream}
          remoteStream={remoteStream}
          onHangUp={endCall}
          onGenerateSpark={handleGenerateSparkForCall}
          onSwitchCamera={switchCamera}
        />
      )}
    </div>
  );
}

