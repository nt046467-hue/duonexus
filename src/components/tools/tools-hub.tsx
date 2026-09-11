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
import { MobileSheet } from "@/components/ui/mobile-sheet";
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
    <div className="w-full pb-32 sm:pb-24">
      {/* Header */}
      <div className="px-4 pt-5 pb-1">
        <h2 className="text-xl font-black text-foreground flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-primary" />
          Couple Toolkit
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Shared tools for you & {partnerName} 💕
        </p>
      </div>

      {/* ── Native-feeling horizontal pill tab bar ── */}
      <div className="px-4 mt-4 mb-1">
        <div className="flex gap-1.5 p-1 bg-muted/50 rounded-2xl overflow-x-auto scrollbar-none border border-border/50">
          {[
            { id: "calling", label: "Calling", icon: Phone },
            { id: "dates", label: "Dates", icon: Calendar, badge: keyDates.length },
            { id: "nudges", label: "Nudges", icon: Heart },
            { id: "bucket", label: "Bucket", icon: Compass, badge: bucketItems.length },
            { id: "capsules", label: "Capsules", icon: Lock, badge: capsules.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ToolTab)}
                className={`relative flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl text-[11px] font-extrabold tracking-wide transition-all shrink-0 ${isActive
                    ? "bg-background text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-black leading-none">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ TAB 1: CALLING ═══ */}
      {activeTab === "calling" && (
        <div className="px-4 pt-3 space-y-3 animate-in fade-in">
          {/* Video Call */}
          <button
            onClick={() => onStartCall("video")}
            className="w-full flex items-center gap-4 p-4 rounded-3xl bg-gradient-to-br from-blue-600/20 to-blue-500/10 border border-blue-500/25 active:scale-[0.98] transition-all text-left"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center shrink-0">
              <Video className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base text-foreground">Video Call</h3>
              <p className="text-xs text-muted-foreground mt-0.5">HD face-to-face with {partnerName}</p>
            </div>
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30 shrink-0">
              <Video className="w-5 h-5 text-white" />
            </div>
          </button>

          {/* Voice Call */}
          <button
            onClick={() => onStartCall("audio")}
            className="w-full flex items-center gap-4 p-4 rounded-3xl bg-gradient-to-br from-emerald-600/20 to-emerald-500/10 border border-emerald-500/25 active:scale-[0.98] transition-all text-left"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Phone className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base text-foreground">Voice Call</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Crystal-clear audio with {partnerName}</p>
            </div>
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-600/30 shrink-0">
              <Phone className="w-5 h-5 text-white" />
            </div>
          </button>
        </div>
      )}

      {/* ═══ TAB 2: KEY DATES ═══ */}
      {activeTab === "dates" && (
        <div className="px-4 pt-3 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Never miss an anniversary or birthday.</p>
            <button
              onClick={() => setIsAddDateOpen(true)}
              className="flex items-center gap-1.5 px-3.5 h-9 rounded-xl bg-primary text-primary-foreground font-bold text-xs active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Date
            </button>
          </div>

          {keyDates.length === 0 ? (
            <div className="text-center py-14 rounded-3xl bg-card border border-dashed border-border space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Calendar className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-sm text-foreground">No dates saved yet</h4>
              <p className="text-xs text-muted-foreground px-6">
                Add your anniversary or {partnerName}'s birthday to start the countdown!
              </p>
              <button
                onClick={() => setIsAddDateOpen(true)}
                className="text-xs font-bold text-primary px-4 py-2 rounded-xl bg-primary/10 active:scale-95 transition-all"
              >
                Add First Date
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
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
                    className="flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border active:opacity-80 transition-all group"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-primary/10 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] font-black text-primary uppercase">
                        {format(itemDate, "MMM")}
                      </span>
                      <span className="text-base font-black text-primary leading-none">
                        {format(itemDate, "d")}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          {item.category}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-foreground truncate mt-0.5">{item.title}</h4>
                      <div className="text-[11px] font-semibold text-pink-400 mt-0.5">
                        {days === 0 ? "Today! 🎉" : `${days} days`}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteKeyDate(item.id)}
                      className="opacity-0 group-hover:opacity-100 active:opacity-100 p-2.5 sm:p-1.5 text-muted-foreground hover:text-destructive transition-all rounded-xl"
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

      {/* ═══ TAB 3: NUDGES ═══ */}
      {activeTab === "nudges" && (
        <div className="px-4 pt-3 space-y-4 animate-in fade-in">
          {/* Quick Pokes */}
          <div className="p-4 rounded-3xl bg-card border border-border shadow-sm space-y-3">
            <div>
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                Send a Gentle Nudge
                <SparklesSvg className="w-4 h-4 text-pink-500" />
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Lights up {partnerName}'s screen with hearts!
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {QUICK_NUDGES.map((item) => (
                <button
                  key={item.text}
                  onClick={() => handleSendNudge(item.text, item.emoji)}
                  disabled={isSendingNudge}
                  className="flex items-center gap-3 p-3.5 min-h-[52px] rounded-2xl bg-muted/40 hover:bg-pink-500/10 hover:border-pink-500/30 border border-border/80 transition-all active:scale-95 text-left group"
                >
                  <span className="text-2xl group-hover:scale-125 transition-transform">{item.emoji}</span>
                  <span className="text-sm font-bold text-foreground">{item.text}</span>
                </button>
              ))}
            </div>

            {/* Custom Nudge Input */}
            <div className="pt-2 flex gap-2">
              <Input
                dir="ltr"
                value={customNudgeText}
                onChange={(e) => setCustomNudgeText(e.target.value)}
                placeholder="Or write a custom poke (e.g., 'Drink some water! 💕')"
                className="rounded-xl text-base sm:text-xs h-10 bg-background text-left dir-ltr"
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

      {/* ═══ TAB 4: BUCKET LIST ═══ */}
      {activeTab === "bucket" && (
        <div className="px-4 pt-3 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex gap-1 bg-muted/40 p-1 rounded-xl border border-border/60">
              {(["all", "active", "completed"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setBucketFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${bucketFilter === filter
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {filter}
                </button>
              ))}
            </div>
            <button
              onClick={() => setIsAddBucketOpen(true)}
              className="flex items-center gap-1.5 px-3.5 h-9 rounded-xl bg-primary text-primary-foreground font-bold text-xs active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>

          {filteredBucketItems.length === 0 ? (
            <div className="text-center py-14 rounded-3xl bg-card border border-dashed border-border space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Compass className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-sm text-foreground">Bucket List is Empty</h4>
              <p className="text-xs text-muted-foreground px-6">Add adventures to tackle together!</p>
              <button
                onClick={() => setIsAddBucketOpen(true)}
                className="text-xs font-bold text-primary px-4 py-2 rounded-xl bg-primary/10 active:scale-95 transition-all"
              >
                Add First Adventure
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredBucketItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl bg-card border transition-all flex items-center gap-3 group ${item.completed
                      ? "border-emerald-500/20 opacity-70"
                      : "border-border active:opacity-80"
                    }`}
                >
                  <button
                    onClick={() => handleToggleBucketItem(item.id, item.completed)}
                    className="flex items-center justify-center w-11 h-11 sm:w-auto sm:h-auto -m-3 sm:m-0 text-muted-foreground hover:text-primary transition-colors shrink-0"
                  >
                    {item.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-500/20" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${item.completed ? "line-through text-muted-foreground" : "text-foreground"
                      }`}>
                      {item.title}
                    </p>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-wider">
                      {item.category}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteBucketItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 active:opacity-100 text-muted-foreground hover:text-destructive transition-all p-2.5 sm:p-1.5 rounded-xl"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB 5: TIME CAPSULES ═══ */}
      {activeTab === "capsules" && (
        <div className="px-4 pt-3 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Secret notes locked until a future date.</p>
            <button
              onClick={() => setIsAddCapsuleOpen(true)}
              className="flex items-center gap-1.5 px-3.5 h-9 rounded-xl bg-primary text-primary-foreground font-bold text-xs active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Seal
            </button>
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
                        className="opacity-0 group-hover:opacity-100 active:opacity-100 text-muted-foreground hover:text-destructive transition-all p-2.5 sm:p-1.5 rounded-lg"
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
      <MobileSheet
        open={isAddDateOpen}
        onOpenChange={setIsAddDateOpen}
        title="Add Special Couple Date 📅"
        descriptionSrOnly="Add a special anniversary, birthday, or upcoming milestone"
        footer={
          <>
            <Button
              onClick={handleSaveKeyDate}
              disabled={!dateTitle.trim() || !dateValue || isSavingDate}
              className="w-full rounded-xl text-sm font-bold h-11"
            >
              {isSavingDate ? "Saving..." : "Save Date"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsAddDateOpen(false)}
              className="w-full rounded-xl text-sm h-11"
            >
              Cancel
            </Button>
          </>
        }
      >
        <div>
          <label className="text-xs font-bold text-muted-foreground block mb-1.5">
            Event Title
          </label>
          <Input
            dir="ltr"
            value={dateTitle}
            onChange={(e) => setDateTitle(e.target.value)}
            placeholder="e.g. Our First Date, Karu's Birthday, Japan Trip"
            className="rounded-xl h-11 text-base sm:text-sm text-left dir-ltr"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1.5">
              Category
            </label>
            <select
              value={dateCategory}
              onChange={(e) => setDateCategory(e.target.value as any)}
              className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="anniversary">Anniversary</option>
              <option value="birthday">Birthday</option>
              <option value="milestone">Milestone</option>
              <option value="trip">Trip / Vacation</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1.5">
              Date
            </label>
            <Input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="rounded-xl text-sm h-11"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground block mb-1.5">
            Optional Notes
          </label>
          <Input
            value={dateNotes}
            onChange={(e) => setDateNotes(e.target.value)}
            placeholder="Favorite restaurant, surprise gift ideas..."
            className="rounded-xl text-sm h-11"
          />
        </div>
      </MobileSheet>

      {/* ================= MODAL: ADD BUCKET ITEM ================= */}
      <MobileSheet
        open={isAddBucketOpen}
        onOpenChange={setIsAddBucketOpen}
        title="Add Couple Goal or Bucket Item 🌟"
        descriptionSrOnly="Add a shared goal, trip, or date idea to your couple bucket list"
        footer={
          <>
            <Button
              onClick={handleAddBucketItem}
              disabled={!bucketTitle.trim() || isSavingBucket}
              className="w-full rounded-xl text-sm font-bold h-11"
            >
              {isSavingBucket ? "Adding..." : "Add to List"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsAddBucketOpen(false)}
              className="w-full rounded-xl text-sm h-11"
            >
              Cancel
            </Button>
          </>
        }
      >
        <div>
          <label className="text-xs font-bold text-muted-foreground block mb-1.5">
            What do you want to experience together?
          </label>
          <Input
            value={bucketTitle}
            onChange={(e) => setBucketTitle(e.target.value)}
            placeholder="e.g. Watch the sunrise from a mountaintop"
            className="rounded-xl h-11"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground block mb-1.5">
            Category
          </label>
          <select
            value={bucketCategory}
            onChange={(e) => setBucketCategory(e.target.value as any)}
            className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="travel">✈️ Travel & Destinations</option>
            <option value="date">🍷 Romantic Date Ideas</option>
            <option value="goal">🎯 Big Life Goals</option>
            <option value="fun">🎈 Fun & Spontaneous</option>
          </select>
        </div>
      </MobileSheet>

      {/* ================= MODAL: CREATE TIME CAPSULE ================= */}
      <MobileSheet
        open={isAddCapsuleOpen}
        onOpenChange={setIsAddCapsuleOpen}
        title="Seal a Love Time Capsule 🔒"
        descriptionSrOnly="Write a secret love letter locked until a future date"
        footer={
          <>
            <Button
              onClick={handleCreateCapsule}
              disabled={!capsuleMessage.trim() || !capsuleUnlockDate || isSavingCapsule}
              className="w-full rounded-xl text-sm font-bold h-11 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
            >
              {isSavingCapsule ? "Sealing..." : "Seal with Love 🔒"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsAddCapsuleOpen(false)}
              className="w-full rounded-xl text-sm h-11"
            >
              Cancel
            </Button>
          </>
        }
      >
        <div>
          <label className="text-xs font-bold text-muted-foreground block mb-1.5">
            Capsule Title
          </label>
          <Input
            value={capsuleTitle}
            onChange={(e) => setCapsuleTitle(e.target.value)}
            placeholder="e.g. Open on our 1st Anniversary 💕"
            className="rounded-xl h-11"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground block mb-1.5">
            Secret Message (hidden until unlock date)
          </label>
          <Textarea
            dir="ltr"
            value={capsuleMessage}
            onChange={(e) => setCapsuleMessage(e.target.value)}
            placeholder="Write your heartfelt note, wishes, or secrets..."
            className="rounded-xl text-base sm:text-sm min-h-[140px] resize-none text-left dir-ltr"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground block mb-1.5">
            Unlock Date
          </label>
          <Input
            type="date"
            value={capsuleUnlockDate}
            onChange={(e) => setCapsuleUnlockDate(e.target.value)}
            className="rounded-xl text-sm h-11"
          />
        </div>
      </MobileSheet>

      {/* ================= MODAL: VIEW UNLOCKED CAPSULE ================= */}
      <MobileSheet
        open={Boolean(viewingCapsule)}
        onOpenChange={() => setViewingCapsule(null)}
        title={viewingCapsule?.title || "Love Time Capsule"}
        description={`Written with love by ${viewingCapsule?.senderName || "your partner"}`}
        dialogClassName="bg-gradient-to-b from-card to-background border-pink-500/30"
        footer={
          <Button
            onClick={() => setViewingCapsule(null)}
            className="w-full rounded-xl font-bold text-sm h-11"
          >
            Cherish Note 💕
          </Button>
        }
      >
        <div className="flex items-center justify-center py-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
            <Unlock className="w-7 h-7 animate-bounce" />
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-muted/40 border border-border/80 text-foreground font-serif leading-relaxed text-sm whitespace-pre-wrap italic">
          "{viewingCapsule?.message}"
        </div>
      </MobileSheet>
    </div>
  );
}
