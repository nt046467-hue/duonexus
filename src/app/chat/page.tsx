
"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
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
import { ThinkingOfYouButton, HeartBurstOverlay } from "@/components/chat/thinking-of-you-button";
import { MoodCheckin } from "@/components/chat/mood-checkin";
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
import { format, startOfDay, endOfDay } from "date-fns";

interface Message {
  id: string;
  senderUid: string;
  senderName: string;
  content: string;
  type: "text" | "image" | "audio" | "video";
  timestamp: any;
  status: "sent" | "delivered" | "seen";
  waveform?: number[];
  replyToId?: string;
  replyToContent?: string;
  replyToSender?: string;
  replyToType?: "text" | "image" | "audio" | "video";
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

  const [memoryTitle, setMemoryTitle] = useState("");
  const [memoryDate, setMemoryDate] = useState("");
  const [memoryType, setMemoryType] = useState<"milestone" | "anniversary" | "favorite">("milestone");
  const [memoryPhoto, setMemoryPhoto] = useState("");
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Nudge state
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const lastNudgeIdRef = useRef<string | null>(null);

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
      const tA = a.timestamp?.toMillis?.() ?? (a.timestamp?.seconds ?? 0) * 1000;
      const tB = b.timestamp?.toMillis?.() ?? (b.timestamp?.seconds ?? 0) * 1000;
      return tA - tB;
    }) as Message[];
  }, [rawMessages]);

  // Combine older + current messages
  const allMessages = useMemo(
    () => [...olderMessages, ...messages],
    [olderMessages, messages]
  );

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
          const tA = a.timestamp?.toMillis?.() ?? (a.timestamp?.seconds ?? 0) * 1000;
          const tB = b.timestamp?.toMillis?.() ?? (b.timestamp?.seconds ?? 0) * 1000;
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

  // AUTO-SCROLL on new messages
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, dailyPrompt]);

  // STATUS + NOTIFICATION logic
  useEffect(() => {
    if (!firestore || !user || messages.length === 0) return;
    const latestMessage = messages[messages.length - 1];
    const isFocused = document.hasFocus() && document.visibilityState === "visible";

    if (latestMessage.id !== lastMessageIdRef.current) {
      if (latestMessage.senderUid !== user.uid) {
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
                  : `Sent a${latestMessage.type === "image" ? "n" : ""} ${latestMessage.type}`,
              icon: "/icon-192.png",
              image: latestMessage.type === "image" ? latestMessage.content : partnerAvatar || undefined,
              badge: "/badge-72.png",
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
      if (msg.senderUid !== user.uid) {
        const msgRef = doc(firestore, "messages", msg.id);
        if (msg.status === "sent") {
          updateDoc(msgRef, { status: "delivered" }).catch(() => {});
        }
        if (isFocused && msg.status !== "seen") {
          updateDoc(msgRef, { status: "seen" }).catch(() => {});
        }
      }
    });
  }, [messages, user, firestore, partnerProfile, partnerName, partnerAvatar]);

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

  // NUDGE (Thinking of You) listener
  useEffect(() => {
    if (!firestore || !myId || !partnerId) return;
    const q = query(
      collection(firestore, "nudges"),
      where("from", "==", partnerId),
      orderBy("timestamp", "desc"),
      limit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) return;
      const latest = snap.docs[0];
      if (latest.id !== lastNudgeIdRef.current) {
        lastNudgeIdRef.current = latest.id;
        setShowHeartBurst(true);
      }
    });
    return () => unsub();
  }, [firestore, myId, partnerId]);

  const handleSendNudge = async () => {
    if (!firestore || !myId) return;
    await addDoc(collection(firestore, "nudges"), {
      from: myId,
      to: partnerId,
      type: "nudge",
      timestamp: serverTimestamp(),
    });
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
    type: "text" | "image" | "audio" | "video",
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
      {/* Heart burst overlay for nudge */}
      {showHeartBurst && (
        <HeartBurstOverlay onDismiss={() => setShowHeartBurst(false)} />
      )}

      <div className="flex-1 flex flex-col h-full w-full max-w-2xl bg-background relative overflow-hidden shadow-2xl border-x border-primary/5">
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
        />

        <main className="flex-1 flex flex-col overflow-hidden relative h-full">
          <Tabs defaultValue="chat" className="flex-1 flex flex-col overflow-hidden h-full">
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
              className="m-0 h-full data-[state=active]:flex-1 data-[state=active]:flex data-[state=active]:flex-col data-[state=active]:overflow-hidden"
            >
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
                className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hide bg-background/50 scroll-smooth"
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
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-40">
                      <Heart className="w-12 h-12 mb-4 text-primary fill-primary" />
                      <p className="font-headline text-lg tracking-tight">
                        Your private space is ready.
                      </p>
                    </div>
                  )}

                  {allMessages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      id={msg.id}
                      content={msg.content}
                      type={msg.type || "text"}
                      timestamp={
                        msg.timestamp?.seconds
                          ? msg.timestamp.seconds * 1000
                          : Date.now()
                      }
                      isMe={msg.senderUid === user?.uid}
                      status={msg.status}
                      waveform={msg.waveform}
                      replyToId={msg.replyToId}
                      replyToContent={msg.replyToContent}
                      replyToSender={msg.replyToSender}
                      replyToType={msg.replyToType}
                      onReply={handleReplySelect}
                      onScrollToMessage={handleScrollToMessage}
                    />
                  ))}
                </div>
              </div>

              <div className="shrink-0 flex flex-col bg-background/90 backdrop-blur-xl border-t border-primary/5 pb-safe z-10">
                {showPrompt && dailyPrompt && (
                  <div className="mx-4 mt-2 p-3 bg-primary/10 border border-primary/20 rounded-xl relative animate-in slide-in-from-bottom-2 shadow-sm">
                    <button
                      onClick={() => setShowPrompt(false)}
                      className="absolute top-2 right-2 text-primary/60 hover:text-primary"
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

                <div className="px-4 py-2 sm:py-3 flex items-end gap-3">
                  {/* Thinking of You FAB */}
                  <ThinkingOfYouButton onTap={handleSendNudge} />

                  <div className="flex-1">
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
              </div>
            </TabsContent>

            <TabsContent
              value="memories"
              className="m-0 h-full px-4 scrollbar-hide data-[state=active]:flex-1 data-[state=active]:flex data-[state=active]:flex-col data-[state=active]:justify-start data-[state=active]:overflow-y-auto"
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
    </div>
  );
}
