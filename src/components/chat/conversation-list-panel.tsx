"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Heart,
  Flame,
  Check,
  CheckCheck,
  CalendarHeart,
  Plus,
  ImageIcon,
  Mic,
  Video,
  Smile,
  Phone,
  Sparkles,
  X,
  Trash2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";

interface Message {
  id: string;
  senderUid?: string;
  senderName?: string;
  content?: string;
  type?: "text" | "image" | "audio" | "video" | "gif" | "sticker";
  timestamp?: any;
  status?: "sent" | "delivered" | "seen" | "read";
  senderRole?: string;
}

interface ConversationListPanelProps {
  partnerName: string;
  partnerAvatar: string;
  isOnline: boolean;
  isTyping: boolean;
  streak: number;
  partnerMood?: string | null;
  lastMessage?: Message | null;
  isActive: boolean;
  onSelectConversation: () => void;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onOpenAddMemory: () => void;
  onDeleteMemory?: (memory: { id: string; title: string }) => void;
  memoriesCount?: number;
  memories?: any[];
  onSearchQueryChange?: (query: string) => void;
}

export function ConversationListPanel({
  partnerName,
  partnerAvatar,
  isOnline,
  isTyping,
  streak,
  partnerMood,
  lastMessage,
  isActive,
  onSelectConversation,
  activeTab,
  onSelectTab,
  onOpenAddMemory,
  onDeleteMemory,
  memoriesCount = 0,
  memories = [],
  onSearchQueryChange,
}: ConversationListPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (val: string) => {
    setSearchQuery(val);
    onSearchQueryChange?.(val);
  };

  // Format last message timestamp
  const timeFormatted = useMemo(() => {
    if (!lastMessage?.timestamp) return "";
    try {
      const ts = lastMessage.timestamp?.seconds
        ? lastMessage.timestamp.seconds * 1000
        : lastMessage.timestamp?.toMillis
          ? lastMessage.timestamp.toMillis()
          : Date.now();
      const date = new Date(ts);
      if (isToday(date)) {
        return format(date, "h:mm a");
      }
      if (isYesterday(date)) {
        return "Yesterday";
      }
      return format(date, "MMM d");
    } catch {
      return "";
    }
  }, [lastMessage]);

  // Last message snippet icon & text
  const messagePreview = useMemo(() => {
    if (!lastMessage) return "Tap to start conversation 💕";
    if (isTyping) return "typing...";

    const content = (lastMessage.content || "").trim();
    if (
      lastMessage.type === "audio" ||
      content.startsWith("data:audio/") ||
      (content.startsWith("blob:http") && content.includes("audio")) ||
      ((content.includes(".mp3") || content.includes(".webm") || content.includes(".wav")) && content.length > 40)
    ) {
      return "🎙️ Voice message";
    }
    if (lastMessage.type === "image" || content.startsWith("data:image/")) {
      return "📷 Photo";
    }
    if (lastMessage.type === "video" || content.startsWith("data:video/")) {
      return "🎥 Video";
    }
    if (lastMessage.type === "sticker") {
      return "🎨 Sticker";
    }
    if (lastMessage.type === "gif" || content.includes("giphy.com") || content.includes("klipy.com") || content.includes("tenor.com")) {
      return "👾 GIF";
    }
    return content || "Message";
  }, [lastMessage, isTyping]);

  return (
    <aside className="w-[320px] md:w-[340px] lg:w-[360px] h-full flex flex-col bg-background/80 backdrop-blur-md border-r border-primary/10 select-none shrink-0 z-20 overflow-hidden">
      {/* Top Header: DuoNexus Branding */}
      <div className="p-4 border-b border-primary/10 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Heart className="w-4 h-4 text-primary fill-primary animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-headline font-black tracking-tight leading-none text-foreground flex items-center gap-1.5">
                DuoNexus
                <span className="text-[10px] uppercase font-bold tracking-widest text-primary font-headline bg-primary/10 px-1.5 py-0.5 rounded-full">
                  Couple
                </span>
              </h1>
              <p className="text-[10px] text-muted-foreground font-headline tracking-wide mt-0.5">
                Private & Encrypted
              </p>
            </div>
          </div>

          {/* Quick Add Milestone / Action */}

        </div>

        {/* Search Bar */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
          <Input
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search messages & memories..."
            className="w-full h-9 pl-9 pr-8 bg-muted/40 rounded-xl text-xs border-transparent focus-visible:border-primary/30 focus-visible:ring-1 focus-visible:ring-primary/20"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Tabs switcher (Chats / Memories) */}
        <div className="flex gap-1 mt-3 bg-muted/30 p-1 rounded-xl">
          <button
            onClick={() => onSelectTab("chat")}
            className={cn(
              "flex-1 py-1.5 text-[11px] font-headline uppercase tracking-wider font-bold rounded-lg transition-all",
              activeTab === "chat"
                ? "bg-background text-foreground shadow-sm shadow-primary/5"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Chats
          </button>
          <button
            onClick={() => onSelectTab("memories")}
            className={cn(
              "flex-1 py-1.5 text-[11px] font-headline uppercase tracking-wider font-bold rounded-lg transition-all flex items-center justify-center gap-1.5",
              activeTab === "memories"
                ? "bg-background text-foreground shadow-sm shadow-primary/5"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>Memories</span>
            {memoriesCount > 0 && (
              <span className="bg-primary/15 text-primary text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                {memoriesCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Conversation / Memories List Scroll Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
        {activeTab === "memories" ? (
          /* Memories Tab List */
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2 pt-1 pb-2">
              <span className="text-xs font-headline font-bold text-muted-foreground uppercase tracking-wider">
                Saved Milestones
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={onOpenAddMemory}
                className="h-7 text-[11px] font-bold text-primary hover:bg-primary/10 rounded-lg px-2 gap-1"
              >
                <Plus className="w-3 h-3" />
                Add
              </Button>
            </div>

            {memories && memories.length > 0 ? (
              memories
                .filter((m: any) =>
                  !searchQuery.trim()
                    ? true
                    : (m.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (m.date || "").includes(searchQuery)
                )
                .map((m: any) => {
                  const typeConfig: Record<string, { emoji: string; color: string; bg: string }> = {
                    anniversary: { emoji: "💍", color: "#ec4899", bg: "rgba(236,72,153,0.12)" },
                    milestone: { emoji: "🏆", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
                    favorite: { emoji: "⭐", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
                  };
                  const cfg = typeConfig[m.type] || {
                    emoji: "💕",
                    color: "#6366f1",
                    bg: "rgba(99,102,241,0.12)",
                  };

                  return (
                    <div
                      key={m.id}
                      className="w-full rounded-2xl p-3 flex items-center gap-3 bg-muted/20 hover:bg-muted/40 border border-primary/10 transition-all cursor-pointer text-left group"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-sm"
                        style={{ background: cfg.bg, border: `1.5px solid ${cfg.color}30` }}
                      >
                        {cfg.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-headline text-xs font-bold text-foreground truncate">
                          {m.title}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full"
                            style={{ color: cfg.color, background: cfg.bg }}
                          >
                            {m.type}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-headline">
                            {m.date}
                          </span>
                        </div>
                      </div>
                      {/* Delete button (visible on hover) */}
                      {onDeleteMemory && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteMemory({ id: m.id, title: m.title || "Milestone" });
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all shrink-0 cursor-pointer"
                          title="Delete milestone"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
            ) : (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <CalendarHeart className="w-6 h-6 text-primary" />
                </div>
                <p className="text-xs font-headline font-semibold text-foreground">No memories saved yet</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">
                  Add your anniversaries, dates, and milestones!
                </p>
                <Button
                  size="sm"
                  onClick={onOpenAddMemory}
                  className="h-8 text-xs font-bold rounded-xl bg-primary text-primary-foreground gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add First Milestone
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Chats Tab List */
          <>
            <div
              onClick={() => {
                onSelectTab("chat");
                onSelectConversation();
              }}
              className={cn(
                "w-full rounded-2xl p-3 flex items-center gap-3 cursor-pointer transition-all duration-200 border text-left",
                isActive && activeTab === "chat"
                  ? "bg-primary/10 border-primary/30 shadow-sm"
                  : "border-transparent hover:bg-muted/40 hover:border-primary/10"
              )}
            >
              {/* Avatar with presence status */}
              <div className="relative shrink-0">
                <Avatar className="h-12 w-12 border-2 border-primary/20 shadow-sm bg-black">
                  <AvatarImage src={partnerAvatar} className="rounded-full object-cover bg-black" />
                  <AvatarFallback className="bg-primary/10 text-primary font-headline text-base font-bold">
                    {partnerName?.[0]?.toUpperCase() || "P"}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    "absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-background rounded-full transition-colors",
                    isOnline ? "bg-green-500" : "bg-muted-foreground/30"
                  )}
                />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-headline text-sm font-bold truncate flex items-center gap-1">
                    <span>{partnerName}</span>
                    <Heart className="w-2.5 h-2.5 text-primary fill-primary shrink-0" />
                    {partnerMood && (
                      <span className="text-xs ml-0.5 select-none" title="Today's mood">
                        {partnerMood}
                      </span>
                    )}
                  </h3>
                  <span className="text-[10px] text-muted-foreground font-headline shrink-0">
                    {timeFormatted}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-1">
                  <p
                    className={cn(
                      "text-xs truncate leading-snug",
                      isTyping
                        ? "text-primary font-bold animate-pulse"
                        : "text-muted-foreground"
                    )}
                  >
                    {messagePreview}
                  </p>

                  {/* Status Ticks or Streak flame */}
                  <div className="flex items-center gap-1 shrink-0">
                    {streak > 0 && (
                      <Badge
                        variant="secondary"
                        className="bg-orange-500/10 text-orange-500 border-none px-1.5 py-0 h-4 text-[9px] font-bold font-headline flex items-center gap-0.5"
                      >
                        <Flame className="w-2.5 h-2.5 fill-orange-500" />
                        <span>{streak}</span>
                      </Badge>
                    )}

                    {/* Sent / Delivered / Seen ticks */}
                    {lastMessage && !isTyping && (
                      <span>
                        {lastMessage.status === "seen" ? (
                          <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                        ) : lastMessage.status === "delivered" ? (
                          <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Milestone Quick Link Card */}
            {memoriesCount > 0 && (
              <div
                onClick={() => onSelectTab("memories")}
                className={cn(
                  "w-full rounded-2xl p-3 flex items-center gap-3 cursor-pointer transition-all duration-200 border text-left mt-2",
                  activeTab === "memories"
                    ? "bg-primary/10 border-primary/30 shadow-sm"
                    : "border-transparent hover:bg-muted/40 hover:border-primary/10"
                )}
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500/20 to-purple-500/20 flex items-center justify-center shrink-0 border border-primary/15">
                  <CalendarHeart className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h4 className="font-headline text-xs font-bold truncate">Our Milestones</h4>
                    <span className="text-[10px] text-primary font-headline uppercase tracking-wider font-bold">
                      {memoriesCount} Saved
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    View anniversaries & special dates
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Footer Note */}
      <div className="p-3 border-t border-primary/10 text-center shrink-0">
        <p className="text-[10px] text-muted-foreground/60 font-headline uppercase tracking-widest flex items-center justify-center gap-1">
          <Heart className="w-3 h-3 text-primary/50 fill-primary/40" />
          <span>Together Forever</span>
        </p>
      </div>
    </aside>
  );
}
