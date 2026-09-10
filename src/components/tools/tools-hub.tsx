"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Video,
  Phone,
  Calendar,
  Send,
  Heart,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Clock,
  LayoutGrid,
  Gift,
  Compass,
  Smile,
  X,
  ChevronRight,
  Eye,
} from "lucide-react";
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Firestore,
} from "firebase/firestore";
import { format, parseISO, differenceInCalendarDays, isAfter } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SparklesSvg } from "@/components/ui/sparkles-svg";
import { toast } from "@/hooks/use-toast";

interface ToolsHubProps {
  firestore: Firestore | null;
  myId: string;
  partnerId: string;
  myName: string;
  partnerName: string;
  partnerAvatar?: string;
  onStartCall: (type: "video" | "audio") => void;
  initialTab?: string;
  darkMode?: boolean;
}

// Sub-tabs in Tools
type ToolTab = "calling" | "dates" | "nudges" | "bucket" | "capsules";

export function ToolsHub({
  firestore,
  myId,
  partnerId,
  myName,
  partnerName,
  partnerAvatar,
  onStartCall,
  initialTab = "calling",
  darkMode = true,
}: ToolsHubProps) {
  const [activeTab, setActiveTab] = useState<ToolTab>(
    (initialTab as ToolTab) || "calling"
  );

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab as ToolTab);
    }
  }, [initialTab]);

  // ================= 1. KEY DATES STATE =================
  const [keyDates, setKeyDates] = useState<any[]>([]);
  const [isAddDateOpen, setIsAddDateOpen] = useState(false);
  const [dateTitle, setDateTitle] = useState("");
  const [dateValue, setDateValue] = useState("");
  const [dateCategory, setDateCategory] = useState<
    "anniversary" | "birthday" | "milestone" | "trip" | "custom"
  >("anniversary");
  const [dateNotes, setDateNotes] = useState("");
  const [isSavingDate, setIsSavingDate] = useState(false);

  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, "keyDates"), orderBy("date", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setKeyDates(list);
    });
    return () => unsub();
  }, [firestore]);

  const handleSaveKeyDate = async () => {
    if (!firestore || !dateTitle.trim() || !dateValue) return;
    setIsSavingDate(true);
    try {
      await addDoc(collection(firestore, "keyDates"), {
        title: dateTitle.trim(),
        date: dateValue,
        category: dateCategory,
        notes: dateNotes.trim(),
        createdBy: myId,
        createdAt: serverTimestamp(),
      });
      setIsAddDateOpen(false);
      setDateTitle("");
      setDateValue("");
      setDateNotes("");
      toast({ title: "Key Date Added 📅", description: "Saved to your shared calendar." });
    } catch (err) {
      console.error("Failed to add key date:", err);
      toast({ variant: "destructive", title: "Error", description: "Failed to save key date." });
    } finally {
      setIsSavingDate(false);
    }
  };

  const handleDeleteKeyDate = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, "keyDates", id));
      toast({ title: "Date Removed" });
    } catch (err) {
      console.error(err);
    }
  };

  // ================= 2. NUDGES STATE =================
  const [recentNudges, setRecentNudges] = useState<any[]>([]);
  const [customNudgeText, setCustomNudgeText] = useState("");
  const [isSendingNudge, setIsSendingNudge] = useState(false);

  const QUICK_NUDGES = [
    { emoji: "💭", text: "Thinking of you" },
    { emoji: "🤗", text: "Sending a warm hug" },
    { emoji: "😍", text: "Missing your sweet smile" },
    { emoji: "💋", text: "Sending sweet kisses" },
    { emoji: "❤️", text: "Can't wait to see you" },
  ];

  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, "nudges"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setRecentNudges(list.slice(0, 15));
    });
    return () => unsub();
  }, [firestore]);

  const handleSendNudge = async (text: string, emoji: string) => {
    if (!firestore || isSendingNudge) return;
    setIsSendingNudge(true);
    try {
      await addDoc(collection(firestore, "nudges"), {
        senderId: myId,
        recipientId: partnerId,
        text,
        emoji,
        timestamp: serverTimestamp(),
        read: false,
      });
      setCustomNudgeText("");
      toast({
        title: `Nudge Sent! ${emoji}`,
        description: `Sent "${text}" to ${partnerName}.`,
      });
    } catch (err) {
      console.error("Failed to send nudge:", err);
      toast({ variant: "destructive", title: "Error", description: "Failed to send poke." });
    } finally {
      setIsSendingNudge(false);
    }
  };

  // ================= 3. BUCKET LIST STATE =================
  const [bucketItems, setBucketItems] = useState<any[]>([]);
  const [isAddBucketOpen, setIsAddBucketOpen] = useState(false);
  const [bucketTitle, setBucketTitle] = useState("");
  const [bucketCategory, setBucketCategory] = useState<
    "travel" | "date" | "goal" | "fun"
  >("date");
  const [bucketFilter, setBucketFilter] = useState<"all" | "active" | "completed">("all");
  const [isSavingBucket, setIsSavingBucket] = useState(false);

  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, "bucketList"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setBucketItems(list);
    });
    return () => unsub();
  }, [firestore]);

  const handleAddBucketItem = async () => {
    if (!firestore || !bucketTitle.trim()) return;
    setIsSavingBucket(true);
    try {
      await addDoc(collection(firestore, "bucketList"), {
        title: bucketTitle.trim(),
        category: bucketCategory,
        completed: false,
        createdBy: myId,
        createdAt: serverTimestamp(),
      });
      setIsAddBucketOpen(false);
      setBucketTitle("");
      toast({ title: "Bucket List Item Added 🌟" });
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: "Failed to add item." });
    } finally {
      setIsSavingBucket(false);
    }
  };

  const handleToggleBucketItem = async (id: string, currentCompleted: boolean) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, "bucketList", id), {
        completed: !currentCompleted,
        completedBy: !currentCompleted ? myId : null,
        completedAt: !currentCompleted ? serverTimestamp() : null,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteBucketItem = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, "bucketList", id));
      toast({ title: "Item Deleted" });
    } catch (err) {
      console.error(err);
    }
  };

  // ================= 4. TIME CAPSULES STATE =================
  const [capsules, setCapsules] = useState<any[]>([]);
  const [isAddCapsuleOpen, setIsAddCapsuleOpen] = useState(false);
  const [capsuleTitle, setCapsuleTitle] = useState("");
  const [capsuleMessage, setCapsuleMessage] = useState("");
  const [capsuleUnlockDate, setCapsuleUnlockDate] = useState("");
  const [isSavingCapsule, setIsSavingCapsule] = useState(false);
  const [viewingCapsule, setViewingCapsule] = useState<any | null>(null);

  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, "timeCapsules"), orderBy("unlockDate", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setCapsules(list);
    });
    return () => unsub();
  }, [firestore]);

  const handleCreateCapsule = async () => {
    if (!firestore || !capsuleMessage.trim() || !capsuleUnlockDate) return;
    setIsSavingCapsule(true);
    try {
      await addDoc(collection(firestore, "timeCapsules"), {
        title: capsuleTitle.trim() || "Love Capsule",
        message: capsuleMessage.trim(),
        unlockDate: capsuleUnlockDate,
        senderId: myId,
        senderName: myName,
        recipientId: partnerId,
        createdAt: serverTimestamp(),
      });
      setIsAddCapsuleOpen(false);
      setCapsuleTitle("");
      setCapsuleMessage("");
      setCapsuleUnlockDate("");
      toast({
        title: "Time Capsule Sealed! 🔒",
        description: `Locked until ${capsuleUnlockDate}.`,
      });
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: "Failed to save capsule." });
    } finally {
      setIsSavingCapsule(false);
    }
  };

  const handleDeleteCapsule = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, "timeCapsules", id));
      toast({ title: "Capsule Removed" });
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered bucket items
  const filteredBucketItems = useMemo(() => {
    if (bucketFilter === "active") return bucketItems.filter((i) => !i.completed);
    if (bucketFilter === "completed") return bucketItems.filter((i) => i.completed);
    return bucketItems;
  }, [bucketItems, bucketFilter]);

  return (
    <div className="flex-1 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl w-full mx-auto select-none">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold font-headline text-foreground flex items-center gap-2">
          <LayoutGrid className="w-6 h-6 text-primary" />
          <span>Couple Toolkit</span>
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Shared tools to celebrate and deepen your connection with {partnerName} 💕
        </p>
      </div>

      {/* Sub-nav tabs */}
      <div className="flex gap-1.5 p-1 bg-muted/40 rounded-2xl overflow-x-auto scrollbar-none border border-border/60">
        {[
          { id: "calling", label: "Calling", icon: Phone },
          { id: "dates", label: "Key Dates", icon: Calendar, badge: keyDates.length },
          { id: "nudges", label: "Nudges", icon: Heart },
          { id: "bucket", label: "Bucket List", icon: Compass, badge: bucketItems.length },
          { id: "capsules", label: "Time Capsules", icon: Lock, badge: capsules.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ToolTab)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${isActive
                ? "bg-background text-foreground shadow-sm shadow-primary/10 border border-border"
                : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/15 text-primary font-extrabold">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ================= TAB 1: CALLING ================= */}
      {activeTab === "calling" && (
        <div className="space-y-4 animate-in fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Video Call */}
            <div className="p-6 rounded-3xl bg-card border border-border shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-blue-500/15 text-blue-500 flex items-center justify-center mb-4">
                  <Video className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg text-foreground">Video Calling</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Face-to-face HD private encrypted video call with {partnerName}.
                </p>
              </div>
              <Button
                onClick={() => onStartCall("video")}
                className="mt-6 h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2"
              >
                <Video className="w-4 h-4" />
                <span>Start Video Call</span>
              </Button>
            </div>

            {/* Voice Call */}
            <div className="p-6 rounded-3xl bg-card border border-border shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center mb-4">
                  <Phone className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg text-foreground">Voice Calling</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Crystal-clear private audio connection with low latency.
                </p>
              </div>
              <Button
                onClick={() => onStartCall("audio")}
                className="mt-6 h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
              >
                <Phone className="w-4 h-4" />
                <span>Start Voice Call</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: KEY DATES ================= */}
      {activeTab === "dates" && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Never forget an anniversary, birthday, or milestone together.
            </p>
            <Button
              size="sm"
              onClick={() => setIsAddDateOpen(true)}
              className="rounded-xl bg-primary text-primary-foreground font-bold text-xs gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Key Date</span>
            </Button>
          </div>

          {keyDates.length === 0 ? (
            <div className="text-center py-12 p-4 rounded-3xl bg-card border border-border space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Calendar className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-base text-foreground">No Key Dates Saved Yet</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Add your anniversary, {partnerName}'s birthday, or upcoming trip to start the countdown!
              </p>
              <Button
                size="sm"
                onClick={() => setIsAddDateOpen(true)}
                className="rounded-xl"
              >
                Add Your First Date
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {keyDates.map((item) => {
                const itemDate = parseISO(item.date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                let target = new Date(today.getFullYear(), itemDate.getMonth(), itemDate.getDate());
                if (differenceInCalendarDays(target, today) < 0) {
                  target = new Date(today.getFullYear() + 1, itemDate.getMonth(), itemDate.getDate());
                }
                const days = differenceInCalendarDays(target, today);

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-card border border-border shadow-xs hover:border-primary/40 transition-all flex items-start justify-between gap-3 relative group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {item.category || "Milestone"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(itemDate, "MMMM d, yyyy")}
                        </span>
                      </div>

                      <h4 className="font-bold text-base text-foreground mt-1 truncate">
                        {item.title}
                      </h4>

                      <div className="text-sm font-semibold text-pink-500 mt-0.5">
                        {days === 0 ? "Today! 🎉" : `${days} days to go`}
                      </div>

                      {item.notes && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {item.notes}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteKeyDate(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1.5 rounded-lg hover:bg-muted"
                      title="Delete date"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: NUDGES ================= */}
      {activeTab === "nudges" && (
        <div className="space-y-5 animate-in fade-in">
          {/* Quick Pokes */}
          <div className="p-5 sm:p-6 rounded-3xl bg-card border border-border shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <span>Send a Gentle Nudge</span>
                <SparklesSvg className="w-4 h-4 text-pink-500" />
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Send an instant poke that lights up {partnerName}'s screen with hearts!
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {QUICK_NUDGES.map((item) => (
                <button
                  key={item.text}
                  onClick={() => handleSendNudge(item.text, item.emoji)}
                  disabled={isSendingNudge}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 hover:bg-pink-500/10 hover:border-pink-500/30 border border-border/80 transition-all active:scale-95 text-left group"
                >
                  <span className="text-2xl group-hover:scale-125 transition-transform">
                    {item.emoji}
                  </span>
                  <span className="text-xs font-bold text-foreground">
                    {item.text}
                  </span>
                </button>
              ))}
            </div>

            {/* Custom Nudge Input */}
            <div className="pt-2 flex gap-2">
              <Input
                value={customNudgeText}
                onChange={(e) => setCustomNudgeText(e.target.value)}
                placeholder="Or write a custom poke (e.g., 'Drink some water! 💕')"
                className="rounded-xl text-xs h-10 bg-background"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customNudgeText.trim()) {
                    handleSendNudge(customNudgeText.trim(), "💌");
                  }
                }}
              />
              <Button
                onClick={() => handleSendNudge(customNudgeText.trim(), "💌")}
                disabled={!customNudgeText.trim() || isSendingNudge}
                className="rounded-xl h-10 px-4 bg-primary text-primary-foreground font-bold text-xs shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Recent Pokes History */}
          {recentNudges.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Recent Pokes
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {recentNudges.map((nudge) => {
                  const isMe = nudge.senderId === myId;
                  return (
                    <div
                      key={nudge.id}
                      className="p-3 rounded-xl bg-card border border-border/80 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg leading-none">{nudge.emoji}</span>
                        <span className="font-semibold text-foreground">
                          {isMe ? "You" : partnerName}:
                        </span>
                        <span className="text-muted-foreground truncate max-w-xs">
                          "{nudge.text}"
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">
                        {nudge.timestamp?.seconds
                          ? format(new Date(nudge.timestamp.seconds * 1000), "h:mm a")
                          : "Just now"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 4: BUCKET LIST ================= */}
      {activeTab === "bucket" && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {/* Filter pills */}
            <div className="flex gap-1 bg-muted/40 p-1 rounded-xl border border-border/60">
              {(["all", "active", "completed"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setBucketFilter(filter)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${bucketFilter === filter
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              onClick={() => setIsAddBucketOpen(true)}
              className="rounded-xl bg-primary text-primary-foreground font-bold text-xs gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Goal</span>
            </Button>
          </div>

          {filteredBucketItems.length === 0 ? (
            <div className="text-center py-12 p-4 rounded-3xl bg-card border border-border space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Compass className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-base text-foreground">Your Bucket List is Empty</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Add travel destinations, date night adventures, or milestones to tackle together!
              </p>
              <Button
                size="sm"
                onClick={() => setIsAddBucketOpen(true)}
                className="rounded-xl"
              >
                Add Your First Adventure
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredBucketItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl bg-card border transition-all flex items-center justify-between gap-3 group ${item.completed
                    ? "border-emerald-500/20 opacity-70 bg-emerald-500/5"
                    : "border-border hover:border-primary/40 shadow-xs"
                    }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => handleToggleBucketItem(item.id, item.completed)}
                      className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                    >
                      {item.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-500/20" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground hover:scale-110 transition-transform" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${item.completed
                          ? "line-through text-muted-foreground"
                          : "text-foreground"
                          }`}
                      >
                        {item.title}
                      </p>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wider">
                        {item.category}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteBucketItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1.5 rounded-lg"
                    title="Delete item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 5: TIME CAPSULES ================= */}
      {activeTab === "capsules" && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Write secret love notes now that stay locked until a future date or anniversary!
            </p>
            <Button
              size="sm"
              onClick={() => setIsAddCapsuleOpen(true)}
              className="rounded-xl bg-primary text-primary-foreground font-bold text-xs gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Seal New Capsule</span>
            </Button>
          </div>

          {capsules.length === 0 ? (
            <div className="text-center py-12 p-4 rounded-3xl bg-card border border-border space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Lock className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-base text-foreground">No Time Capsules Sealed</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Write a note for next month or your anniversary. It remains strictly hidden until the unlock date!
              </p>
              <Button
                size="sm"
                onClick={() => setIsAddCapsuleOpen(true)}
                className="rounded-xl"
              >
                Seal Your First Capsule
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {capsules.map((capsule) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const unlock = parseISO(capsule.unlockDate);
                const daysUntilUnlock = differenceInCalendarDays(unlock, today);
                const isUnlocked = daysUntilUnlock <= 0;

                return (
                  <div
                    key={capsule.id}
                    className={`p-4 rounded-2xl bg-card border transition-all flex flex-col justify-between shadow-xs relative group ${isUnlocked
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-pink-500/20 bg-pink-500/5"
                      }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full flex items-center gap-1.5 bg-background border border-border">
                          {isUnlocked ? (
                            <>
                              <Unlock className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Unlocked</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3 text-pink-400" />
                              <span className="text-pink-400">Locked</span>
                            </>
                          )}
                        </span>

                        <span className="text-xs text-muted-foreground">
                          From: {capsule.senderName || "Love"}
                        </span>
                      </div>

                      <h4 className="font-bold text-base text-foreground truncate">
                        {capsule.title || "Secret Note"}
                      </h4>

                      <p className="text-xs text-muted-foreground mt-1">
                        {isUnlocked
                          ? `Unlocked on ${capsule.unlockDate} 🎉`
                          : `Unlocks on ${capsule.unlockDate} (${daysUntilUnlock} days to go)`}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between pt-2 border-t border-border/40">
                      {isUnlocked ? (
                        <Button
                          size="sm"
                          onClick={() => setViewingCapsule(capsule)}
                          className="rounded-xl h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Read Secret Note</span>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Sealed with love
                        </span>
                      )}

                      <button
                        onClick={() => handleDeleteCapsule(capsule.id)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1.5 rounded-lg"
                        title="Delete capsule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL: ADD KEY DATE ================= */}
      <Dialog open={isAddDateOpen} onOpenChange={setIsAddDateOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-headline font-bold text-lg">
              Add Special Couple Date 📅
            </DialogTitle>
            <DialogDescription className="sr-only">
              Add a special anniversary, birthday, or upcoming milestone
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">
                Event Title
              </label>
              <Input
                value={dateTitle}
                onChange={(e) => setDateTitle(e.target.value)}
                placeholder="e.g. Our First Date, Karu's Birthday, Japan Trip"
                className="rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Category
                </label>
                <select
                  value={dateCategory}
                  onChange={(e) => setDateCategory(e.target.value as any)}
                  className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs"
                >
                  <option value="anniversary">Anniversary</option>
                  <option value="birthday">Birthday</option>
                  <option value="milestone">Milestone</option>
                  <option value="trip">Trip / Vacation</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Date
                </label>
                <Input
                  type="date"
                  value={dateValue}
                  onChange={(e) => setDateValue(e.target.value)}
                  className="rounded-xl text-xs h-9"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">
                Optional Notes
              </label>
              <Input
                value={dateNotes}
                onChange={(e) => setDateNotes(e.target.value)}
                placeholder="Favorite restaurant, surprise gift ideas..."
                className="rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDateOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveKeyDate}
              disabled={!dateTitle.trim() || !dateValue || isSavingDate}
              className="rounded-xl text-xs font-bold"
            >
              {isSavingDate ? "Saving..." : "Save Date"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: ADD BUCKET ITEM ================= */}
      <Dialog open={isAddBucketOpen} onOpenChange={setIsAddBucketOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-headline font-bold text-lg">
              Add Couple Goal or Bucket Item 🌟
            </DialogTitle>
            <DialogDescription className="sr-only">
              Add a shared goal, trip, or date idea to your couple bucket list
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">
                What do you want to experience together?
              </label>
              <Input
                value={bucketTitle}
                onChange={(e) => setBucketTitle(e.target.value)}
                placeholder="e.g. Watch the sunrise from a mountaintop"
                className="rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">
                Category
              </label>
              <select
                value={bucketCategory}
                onChange={(e) => setBucketCategory(e.target.value as any)}
                className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs"
              >
                <option value="travel">✈️ Travel & Destinations</option>
                <option value="date">🍷 Romantic Date Ideas</option>
                <option value="goal">🎯 Big Life Goals</option>
                <option value="fun">🎈 Fun & Spontaneous</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddBucketOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddBucketItem}
              disabled={!bucketTitle.trim() || isSavingBucket}
              className="rounded-xl text-xs font-bold"
            >
              {isSavingBucket ? "Adding..." : "Add to List"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: CREATE TIME CAPSULE ================= */}
      <Dialog open={isAddCapsuleOpen} onOpenChange={setIsAddCapsuleOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-headline font-bold text-lg">
              Seal a Love Time Capsule 🔒
            </DialogTitle>
            <DialogDescription className="sr-only">
              Write a secret love letter locked until a future date
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">
                Capsule Title
              </label>
              <Input
                value={capsuleTitle}
                onChange={(e) => setCapsuleTitle(e.target.value)}
                placeholder="e.g. Open on our 1st Anniversary 💕"
                className="rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">
                Secret Message (hidden until unlock date)
              </label>
              <Textarea
                value={capsuleMessage}
                onChange={(e) => setCapsuleMessage(e.target.value)}
                placeholder="Write your heartfelt note, wishes, or secrets..."
                className="rounded-xl text-sm min-h-[120px] resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">
                Unlock Date
              </label>
              <Input
                type="date"
                value={capsuleUnlockDate}
                onChange={(e) => setCapsuleUnlockDate(e.target.value)}
                className="rounded-xl text-xs h-9"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddCapsuleOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCapsule}
              disabled={!capsuleMessage.trim() || !capsuleUnlockDate || isSavingCapsule}
              className="rounded-xl text-xs font-bold bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
            >
              {isSavingCapsule ? "Sealing..." : "Seal with Love 🔒"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: VIEW UNLOCKED CAPSULE ================= */}
      <Dialog open={Boolean(viewingCapsule)} onOpenChange={() => setViewingCapsule(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-gradient-to-b from-card to-background border-pink-500/30">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center mb-2 mx-auto">
              <Unlock className="w-6 h-6 animate-bounce" />
            </div>
            <DialogTitle className="font-headline font-bold text-center text-xl text-foreground">
              {viewingCapsule?.title || "Love Time Capsule"}
            </DialogTitle>
            <p className="text-xs text-center text-muted-foreground">
              Written with love by {viewingCapsule?.senderName || "your partner"}
            </p>
          </DialogHeader>

          <div className="py-4">
            <div className="p-5 rounded-2xl bg-muted/40 border border-border/80 text-foreground font-serif leading-relaxed text-sm whitespace-pre-wrap italic">
              "{viewingCapsule?.message}"
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setViewingCapsule(null)}
              className="w-full rounded-xl font-bold text-xs"
            >
              Cherish Note 💕
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
