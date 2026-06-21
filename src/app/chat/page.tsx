
"use client";

import { useEffect, useState, useRef, useMemo } from "react";
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
  getDocs
} from "firebase/firestore";
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { ChatHeader } from "@/components/chat/chat-header";
import { MessageBubble } from "@/components/chat/message-bubble";
import { MessageInput } from "@/components/chat/message-input";
import { Heart, X, Loader2, Camera, Calendar, Plus, MoreVertical, Edit2, Trash2, Sparkles, Video } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { dailyAiConversationPrompt } from "@/ai/flows/daily-ai-conversation-prompt";

interface Message {
  id: string;
  senderUid: string;
  senderName: string;
  content: string;
  type: "text" | "image" | "audio" | "video";
  timestamp: any;
  status: "sent" | "delivered" | "seen";
}

const SEND_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3";
const RECEIVE_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3";
const HEART_ICON_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='75' x='50' text-anchor='middle' font-size='80'%3E❤️%3C/text%3E%3C/svg%3E";

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

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const sendAudioRef = useRef<HTMLAudioElement | null>(null);
  const receiveAudioRef = useRef<HTMLAudioElement | null>(null);
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const [myId, setMyId] = useState<string>("");

  useEffect(() => {
    sendAudioRef.current = new Audio(SEND_SOUND_URL);
    receiveAudioRef.current = new Audio(RECEIVE_SOUND_URL);
    
    const role = typeof window !== 'undefined' ? localStorage.getItem('duonexus_role') : null;
    if (role) {
      setMyId(role);
    } else if (!isAuthLoading && !user) {
      router.push("/login");
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        swRegistrationRef.current = reg;
      });
    }
  }, [isAuthLoading, user, router]);

  const partnerId = useMemo(() => {
    if (!myId) return "";
    return myId === "nabin" ? "karu" : "nabin";
  }, [myId]);

  const partnerName = partnerId ? (partnerId.charAt(0).toUpperCase() + partnerId.slice(1)) : "Partner";
  const myName = user?.displayName || (myId ? (myId.charAt(0).toUpperCase() + myId.slice(1)) : "Me");

  // PRESENCE LOGIC
  useEffect(() => {
    if (!firestore || !myId) return;

    const userPresenceRef = doc(firestore, "presence", myId);

    const setOnlineStatus = (online: boolean) => {
      setDoc(userPresenceRef, {
        online,
        lastSeen: serverTimestamp()
      }, { merge: true }).catch(() => {});
    };

    setOnlineStatus(true);

    const handleVisibilityChange = () => {
      setOnlineStatus(document.visibilityState === 'visible');
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', () => setOnlineStatus(true));
    window.addEventListener('blur', () => setOnlineStatus(false));
    window.addEventListener('beforeunload', () => setOnlineStatus(false));

    return () => {
      setOnlineStatus(false);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', () => setOnlineStatus(true));
      window.removeEventListener('blur', () => setOnlineStatus(false));
    };
  }, [firestore, myId]);

  const messagesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "messages"), orderBy("timestamp", "desc"), limit(60));
  }, [firestore]);

  const { data: rawMessages, loading: messagesLoading } = useCollection(messagesQuery);

  const messages = useMemo(() => {
    if (!rawMessages) return [];
    return [...rawMessages].sort((a: any, b: any) => {
      const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : Date.now());
      const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : Date.now());
      return timeA - timeB;
    }) as Message[];
  }, [rawMessages]);

  const partnerProfileRef = useMemoFirebase(() => {
    if (!firestore || !partnerId) return null;
    return doc(firestore, "profiles", partnerId);
  }, [firestore, partnerId]);
  const { data: partnerProfile } = useDoc(partnerProfileRef);

  const partnerAvatar = partnerProfile?.photoURL || `https://picsum.photos/seed/${partnerName}/500/500`;

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, dailyPrompt]);

  // STATUS & NOTIFICATION LOGIC
  useEffect(() => {
    if (!firestore || !user || messages.length === 0) return;

    const latestMessage = messages[messages.length - 1];
    const isFocused = document.hasFocus() && document.visibilityState === 'visible';

    // 1. Notification trigger
    if (latestMessage.id !== lastMessageIdRef.current) {
      if (latestMessage.senderUid !== user.uid) {
        receiveAudioRef.current?.play().catch(() => {});
        
        if (swRegistrationRef.current && Notification.permission === 'granted' && !isFocused) {
          // Compact "Real App" notification
          swRegistrationRef.current.showNotification(`${partnerProfile?.displayName || partnerName}`, {
            body: latestMessage.type === 'text' ? latestMessage.content : `Sent an ${latestMessage.type}`,
            icon: partnerAvatar, // Profile picture on the left
            badge: HEART_ICON_URL, // Heart icon in the status bar
            tag: 'duonexus-msg',
            renotify: true,
            data: { url: window.location.origin }
          });
        }
      }
      lastMessageIdRef.current = latestMessage.id;
    }

    // 2. Status updates
    messages.forEach((msg) => {
      if (msg.senderUid !== user.uid) {
        const msgRef = doc(firestore, "messages", msg.id);
        
        // Instant Delivered (Double Grey)
        if (msg.status === 'sent') {
          updateDoc(msgRef, { status: "delivered" }).catch(() => {});
        }
        
        // Instant Seen (Double Blue)
        if (isFocused && msg.status !== 'seen') {
          updateDoc(msgRef, { status: "seen" }).catch(() => {});
        }
      }
    });

  }, [messages, user, firestore, partnerProfile, partnerName, partnerAvatar]);

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

  const handleSendMessage = (content: string, type: "text" | "image" | "audio" | "video") => {
    if (!firestore || !user) return;
    
    sendAudioRef.current?.play().catch(() => {});
    
    addDoc(collection(firestore, "messages"), {
      senderUid: user.uid,
      senderName: myName,
      content,
      type,
      timestamp: serverTimestamp(),
      status: "sent"
    });
  };

  const handleTyping = (isTyping: boolean) => {
    if (!firestore || !myId) return;
    setDoc(doc(firestore, "typing", myId), { 
      isTyping, 
      lastUpdated: serverTimestamp() 
    }, { merge: true });
  };

  const handleGenerateSpark = async () => {
    if (!firestore) return;
    setIsGeneratingSpark(true);
    try {
      const q = query(collection(firestore, "messages"), orderBy("timestamp", "desc"), limit(5));
      const historySnap = await getDocs(q);
      const historyText = historySnap.docs
        .map(d => d.data().content)
        .filter(c => typeof c === 'string' && c.length < 200)
        .join("\n");

      const result = await dailyAiConversationPrompt({ pastChatHistory: historyText });
      
      await addDoc(collection(firestore, "sparks"), {
        prompt: result.prompt,
        timestamp: serverTimestamp(),
        createdBy: user?.uid || "system"
      });
      
      toast({ title: "Love Spark Generated! ✨", description: "A new topic for you two." });
    } catch (e) {
      toast({ variant: "destructive", title: "AI Busy", description: "Could not generate spark right now." });
    } finally {
      setIsGeneratingSpark(false);
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
        timestamp: serverTimestamp()
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

  if (isAuthLoading) return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background gap-6">
      <div className="relative flex items-center justify-center">
        <div className="w-20 h-20 border-[3px] border-primary/10 border-t-primary rounded-full animate-spin" />
        <Heart className="absolute w-6 h-6 text-primary fill-primary animate-pulse" />
      </div>
      <div className="text-primary font-headline uppercase tracking-[0.3em] text-[11px] font-bold">Connecting DuoNexus...</div>
    </div>
  );

  const finalPartnerName = partnerProfile?.displayName || partnerName;

  return (
    <div className="flex flex-col h-dynamic-screen w-full bg-background overflow-hidden relative items-center">
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
        />

        <main className="flex-1 flex flex-col overflow-hidden relative h-full">
          <Tabs defaultValue="chat" className="flex-1 flex flex-col overflow-hidden h-full">
            <div className="px-4 py-2 bg-background/80 backdrop-blur-md border-b border-primary/5 z-10 shrink-0">
              <TabsList className="grid w-full grid-cols-2 rounded-full bg-muted/50 p-1 h-9">
                <TabsTrigger value="chat" className="rounded-full text-[10px] uppercase font-headline tracking-widest py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Our Chat</TabsTrigger>
                <TabsTrigger value="memories" className="rounded-full text-[10px] uppercase font-headline tracking-widest py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Memories</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="chat" className="flex-1 flex flex-col overflow-hidden m-0 data-[state=active]:flex h-full">
              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hide bg-background/50 scroll-smooth">
                <div className="flex flex-col min-h-full justify-end">
                  {messages.length === 0 && !messagesLoading && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-40">
                      <Heart className="w-12 h-12 mb-4 text-primary fill-primary" />
                      <p className="font-headline text-lg tracking-tight">Your private space is ready.</p>
                    </div>
                  )}
                  {messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      id={msg.id}
                      content={msg.content}
                      type={msg.type || "text"}
                      timestamp={msg.timestamp?.seconds ? msg.timestamp.seconds * 1000 : Date.now()}
                      isMe={msg.senderUid === user?.uid}
                      status={msg.status}
                    />
                  ))}
                </div>
              </div>

              <div className="shrink-0 flex flex-col bg-background/90 backdrop-blur-xl border-t border-primary/5 pb-safe z-10">
                {showPrompt && dailyPrompt && (
                  <div className="mx-4 mt-2 p-3 bg-primary/10 border border-primary/20 rounded-xl relative animate-in slide-in-from-bottom-2 shadow-sm">
                    <button onClick={() => setShowPrompt(false)} className="absolute top-2 right-2 text-primary/60 hover:text-primary">
                      <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-primary fill-primary" />
                      <span className="text-[10px] font-headline uppercase text-primary tracking-tighter">AI Love Spark</span>
                    </div>
                    <p className="text-sm font-medium pr-6 leading-tight">{dailyPrompt}</p>
                  </div>
                )}
                
                <div className="px-4 py-2 sm:py-4">
                  <MessageInput onSendMessage={handleSendMessage} onTyping={handleTyping} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="memories" className="flex-1 flex-col justify-start overflow-y-auto px-4 m-0 h-full scrollbar-hide data-[state=active]:flex">
              <div className="w-full pt-0 pb-24 space-y-6">
                <div className="flex items-center justify-between py-4">
                  <h3 className="font-headline text-xl font-bold tracking-tight">Our Milestones</h3>
                  <Dialog open={isMemoryDialogOpen} onOpenChange={setIsMemoryDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="h-8 text-[10px] font-headline uppercase tracking-widest gap-2 rounded-full border-primary/20 hover:bg-primary/5">
                        <Plus className="w-3 h-3 text-primary" /> Add New
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[90vw] max-w-[425px] rounded-[2.5rem] border-primary/5 p-8">
                      <DialogHeader>
                        <DialogTitle className="font-headline text-xl text-left">Add a Memory</DialogTitle>
                        <DialogDescription className="text-xs text-left">Capture a special moment for your shared history.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase tracking-widest font-headline opacity-60">Memory Title</Label>
                          <Input placeholder="e.g. First Date" value={memoryTitle} onChange={(e) => setMemoryTitle(e.target.value)} className="rounded-2xl h-11" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-headline opacity-60">Date</Label>
                            <Input type="date" value={memoryDate} onChange={(e) => setMemoryDate(e.target.value)} className="text-xs rounded-2xl h-11" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-headline opacity-60">Type</Label>
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
                        <Button onClick={handleSaveMemory} disabled={isSavingMemory} className="w-full font-headline uppercase tracking-widest text-[11px] h-12 rounded-2xl shadow-lg shadow-primary/20">
                          {isSavingMemory ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Milestone"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {memories && memories.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {memories.map((m: any) => (
                      <div key={m.id} className="bg-card border border-primary/5 rounded-[2.5rem] p-5 flex gap-5 items-center group shadow-sm hover:border-primary/20 transition-all">
                        <div className="h-20 w-20 bg-primary/5 rounded-[1.5rem] flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                          {m.photoURL ? <img src={m.photoURL} className="object-cover h-full w-full" /> : <Calendar className="w-8 h-8 text-primary/40" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-headline text-base font-bold truncate">{m.title}</h4>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{m.date}</span>
                            <span className="w-1 h-1 bg-muted-foreground/20 rounded-full" />
                            <span className="text-[10px] text-primary font-headline uppercase tracking-tighter">{m.type}</span>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 text-muted-foreground/40 hover:text-primary">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl border-primary/10 shadow-xl bg-background/95 backdrop-blur-xl">
                            <DropdownMenuItem onClick={() => openEditDialog(m)} className="gap-2 focus:bg-primary/10 rounded-lg">
                              <Edit2 className="w-3.5 h-3.5" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteMemory(m.id)} className="gap-2 focus:bg-destructive/10 text-destructive rounded-lg">
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
                    <p className="text-sm font-headline uppercase tracking-[0.2em]">Our history starts here.</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <Dialog open={isEditMemoryDialogOpen} onOpenChange={setIsEditMemoryDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[425px] rounded-[2.5rem] border-primary/5 p-8">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl text-left">Edit Memory</DialogTitle>
            <DialogDescription className="text-xs text-left">Update the details of your special moment.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-widest font-headline opacity-60">Memory Title</Label>
              <Input placeholder="e.g. First Date" value={memoryTitle} onChange={(e) => setMemoryTitle(e.target.value)} className="rounded-2xl h-11" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest font-headline opacity-60">Date</Label>
                <Input type="date" value={memoryDate} onChange={(e) => setMemoryDate(e.target.value)} className="text-xs rounded-2xl h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest font-headline opacity-60">Type</Label>
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
            <Button onClick={handleUpdateMemory} disabled={isSavingMemory} className="w-full font-headline uppercase tracking-widest text-[11px] h-12 rounded-2xl shadow-lg shadow-primary/20">
              {isSavingMemory ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
