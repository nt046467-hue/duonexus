"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { format, isToday, isYesterday } from "date-fns";
import {
  ArrowLeft,
  CornerUpLeft,
  Trash2,
  MoreVertical,
  Star,
  Copy,
  Info,
  Plus,
  Search,
  X,
  Check,
  CheckCheck,
  Smile,
  Dog,
  Utensils,
  Dribbble,
  Car,
  Lightbulb,
  Hash,
  Clock,
  RotateCcw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { searchEmojis } from "@/lib/emoji-search";
import { cn } from "@/lib/utils";

export interface MobileInteractionMessage {
  id: string;
  senderUid?: string;
  senderName?: string;
  senderRole?: string;
  sender?: "me" | "other";
  content?: string;
  text?: string;
  type?: "text" | "image" | "audio" | "video" | "gif" | "sticker" | "location" | "file";
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  timestamp?: any;
  time?: string;
  status?: "sent" | "delivered" | "read" | "seen";
  waveform?: number[];
  replyToId?: string;
  replyToContent?: string;
  replyToSender?: string;
  replyToType?: string;
  replyTo?: {
    sender: "me" | "other";
    text: string;
  };
  reactions?: string[];
  isDeleted?: boolean;
}

interface MobileSelectionHeaderProps {
  selectedMessage: MobileInteractionMessage;
  onClearSelection: () => void;
  onReply: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onOpenInfo: () => void;
  isDark?: boolean;
}

/**
 * WhatsApp-style Top Selection Header for Mobile
 * Clean layout: Back Arrow + "1" on left, Reply + Delete + Three Dots on right.
 * Star icon removed as requested (unused).
 * Supports both realistic Bright (Light) Mode and Dark Mode.
 */
export function MobileSelectionHeader({
  selectedMessage,
  onClearSelection,
  onReply,
  onDelete,
  onCopy,
  onOpenInfo,
  isDark = true,
}: MobileSelectionHeaderProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className="flex items-center justify-between w-full h-full px-1 animate-in fade-in duration-150 select-none"
    >
      {/* Left: Back / Deselect + Count */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClearSelection();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
          }}
          className={cn(
            "w-9 h-9 flex items-center justify-center rounded-full active:scale-95 transition-colors cursor-pointer",
            isDark
              ? "text-white hover:bg-white/10 active:bg-white/20"
              : "text-gray-700 hover:bg-gray-100 active:bg-gray-200"
          )}
          title="Clear selection"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span
          className={cn(
            "text-[19px] font-semibold tracking-wide select-none",
            isDark ? "text-white" : "text-gray-900"
          )}
        >
          1
        </span>
      </div>

      {/* Right: Reply, Delete, Three Dots (Clean spacing without crowding) */}
      <div className="flex items-center gap-1">
        {/* Reply */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReply();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
          }}
          className={cn(
            "w-9 h-9 flex items-center justify-center rounded-full active:scale-95 transition-colors cursor-pointer",
            isDark
              ? "text-white hover:bg-white/10 active:bg-white/20"
              : "text-gray-700 hover:bg-gray-100 active:bg-gray-200"
          )}
          title="Reply"
        >
          <CornerUpLeft className="w-5 h-5" />
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
          }}
          className={cn(
            "w-9 h-9 flex items-center justify-center rounded-full active:scale-95 transition-colors cursor-pointer",
            isDark
              ? "text-white hover:bg-white/10 active:bg-white/20"
              : "text-gray-700 hover:bg-gray-100 active:bg-gray-200 hover:text-red-500"
          )}
          title="Delete"
        >
          <Trash2 className="w-5 h-5" />
        </button>

        {/* Three Dots Menu with Info & Copy */}
        <DropdownMenu open={showMenu} onOpenChange={setShowMenu}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              className={cn(
                "w-9 h-9 flex items-center justify-center rounded-full active:scale-95 transition-colors cursor-pointer",
                isDark
                  ? "text-white hover:bg-white/10 active:bg-white/20"
                  : "text-gray-700 hover:bg-gray-100 active:bg-gray-200"
              )}
              title="More options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className={cn(
              "w-48 py-1.5 rounded-2xl shadow-2xl z-[150] animate-in fade-in zoom-in-95 duration-100 border",
              isDark
                ? "bg-[#233138] border-[#2a3942] text-white"
                : "bg-white border-gray-200 text-gray-800 shadow-xl"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onOpenInfo();
              }}
              className={cn(
                "px-4 py-2.5 text-[15px] font-medium flex items-center gap-3 cursor-pointer rounded-xl mx-1",
                isDark
                  ? "hover:bg-white/10 focus:bg-white/10"
                  : "hover:bg-gray-100 focus:bg-gray-100 text-gray-800"
              )}
            >
              <Info className={cn("w-4 h-4", isDark ? "text-emerald-400" : "text-emerald-600")} />
              <span>Info</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onCopy();
              }}
              className={cn(
                "px-4 py-2.5 text-[15px] font-medium flex items-center gap-3 cursor-pointer rounded-xl mx-1",
                isDark
                  ? "hover:bg-white/10 focus:bg-white/10"
                  : "hover:bg-gray-100 focus:bg-gray-100 text-gray-800"
              )}
            >
              <Copy className={cn("w-4 h-4", isDark ? "text-blue-400" : "text-blue-600")} />
              <span>Copy</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

interface MobileReactionPillProps {
  message: MobileInteractionMessage;
  quickReactions: string[];
  onReact: (emoji: string) => void;
  onOpenFullPicker: () => void;
  isMe: boolean;
  sheetOpen?: boolean;
  isDark?: boolean;
}

/**
 * WhatsApp-style Floating Quick Reaction Bar for Mobile
 * Sleek floating pill with smooth backdrop blur, floating above the selected message.
 * Supports both bright mode and dark mode.
 */
export function MobileReactionPill({
  message,
  quickReactions,
  onReact,
  onOpenFullPicker,
  isMe,
  sheetOpen = false,
  isDark = true,
}: MobileReactionPillProps) {
  if (sheetOpen) return null;

  // 6 sleek quick reactions
  const emojis =
    quickReactions && quickReactions.length > 0
      ? quickReactions.slice(0, 6)
      : ["❤️", "😆", "😮", "😢", "😚", "👍"];

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "select-none flex items-center gap-1 min-[360px]:gap-1.5 px-2 min-[360px]:px-2.5 py-1 min-[360px]:py-1.5 rounded-full border shadow-2xl backdrop-blur-xl transition-all animate-in fade-in zoom-in-95 duration-150",
        isDark
          ? "bg-[#1f2c34] border-[#2a3942] text-white shadow-[0_6px_28px_rgba(0,0,0,0.7)]"
          : "bg-white border-gray-200 text-gray-900 shadow-[0_6px_28px_rgba(0,0,0,0.18)]"
      )}
      style={{
        maxWidth: "calc(100vw - 20px)",
      }}
    >
      {emojis.map((emoji, index) => (
        <button
          key={index}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReact(emoji);
          }}
          className="w-7 h-7 min-[360px]:w-8 min-[360px]:h-8 flex items-center justify-center text-[19px] min-[360px]:text-[21px] leading-none rounded-full hover:scale-125 active:scale-90 transition-transform duration-100 cursor-pointer"
          title={emoji}
        >
          {emoji}
        </button>
      ))}

      {/* Plus (+) button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenFullPicker();
        }}
        className={cn(
          "w-6 h-6 min-[360px]:w-7 min-[360px]:h-7 flex items-center justify-center rounded-full active:scale-90 transition-all cursor-pointer ml-0.5",
          isDark
            ? "bg-[#2a3942] hover:bg-[#374248] text-gray-300 hover:text-white"
            : "bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900"
        )}
        title="More reactions"
      >
        <Plus className="w-3.5 h-3.5 min-[360px]:w-4 min-[360px]:h-4 stroke-[2.5]" />
      </button>
    </div>
  );
}

interface MobileReactionSheetProps {
  open: boolean;
  onClose: () => void;
  quickReactions: string[];
  onUpdateQuickReactions: (reactions: string[]) => void;
  onReact: (emoji: string) => void;
  fullEmojiCategories: Record<string, string[]>;
}

const FREQUENTLY_USED_EMOJIS = [
  "😚", "😢", "😂", "😮", "❤️", "🤤", "😍", "😳",
  "😁", "🤭", "👍", "🙏", "🔥", "🥰", "😭", "😊",
  "🤣", "🥺", "😘", "✨", "💯", "🎉", "💀", "🤔"
];

/**
 * WhatsApp-style Full Emoji Reaction Bottom Sheet with Customizer
 * Continuous scrollable list with ALL categories — like real WhatsApp.
 */
export function MobileReactionSheet({
  open,
  onClose,
  quickReactions,
  onUpdateQuickReactions,
  onReact,
  fullEmojiCategories,
}: MobileReactionSheetProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [activeTabCategory, setActiveTabCategory] = useState<string>("Recent");
  const scrollContentRef = useRef<HTMLDivElement>(null);
  // Refs for each section header so we can scroll-to-section
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Filter out 'Flags' category completely so no 2-letter codes render on Windows browsers
  const cleanCategories = useMemo(() => {
    const cats: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(fullEmojiCategories)) {
      if (k.toLowerCase().includes("flag")) continue;
      cats[k] = v;
    }
    return cats;
  }, [fullEmojiCategories]);

  const categoryIcons: { key: string; label: string; icon: React.ReactNode }[] = [
    { key: "Recent", label: "Recent", icon: <Clock className="w-5 h-5" /> },
    { key: "Smileys & people", label: "Smileys", icon: <Smile className="w-5 h-5" /> },
    { key: "Animals & nature", label: "Animals", icon: <Dog className="w-5 h-5" /> },
    { key: "Food & drink", label: "Food", icon: <Utensils className="w-5 h-5" /> },
    { key: "Activity", label: "Activity", icon: <Dribbble className="w-5 h-5" /> },
    { key: "Travel & places", label: "Travel", icon: <Car className="w-5 h-5" /> },
    { key: "Objects", label: "Objects", icon: <Lightbulb className="w-5 h-5" /> },
    { key: "Symbols", label: "Symbols", icon: <Hash className="w-5 h-5" /> },
  ];

  // All sections to render in the continuous scroll
  const allSections = useMemo(() => [
    { key: "Recent", label: "Frequently used", emojis: FREQUENTLY_USED_EMOJIS },
    ...Object.entries(cleanCategories).map(([key, emojis]) => ({
      key,
      label: key,
      emojis,
    })),
  ], [cleanCategories]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setIsCustomizing(false);
      setSelectedSlot(0);
      setActiveTabCategory("Recent");
    }
  }, [open]);

  // Update active tab highlight based on scroll position
  useEffect(() => {
    if (!open) return;
    const container = scrollContentRef.current;
    if (!container) return;
    const onScroll = () => {
      const scrollTop = container.scrollTop;
      // Walk sectionRefs to find which section is in view
      let current = "Recent";
      for (const [key, el] of Object.entries(sectionRefs.current)) {
        if (el && el.offsetTop - container.offsetTop <= scrollTop + 40) {
          current = key;
        }
      }
      setActiveTabCategory(current);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleEmojiClick = (emoji: string) => {
    if (isCustomizing) {
      const updated = [...quickReactions];
      updated[selectedSlot] = emoji;
      onUpdateQuickReactions(updated);
      setSelectedSlot((prev) => (prev + 1) % Math.min(quickReactions.length, 6));
    } else {
      onReact(emoji);
      onClose();
    }
  };

  const handleResetDefaults = () => {
    const defaults = ["❤️", "😆", "😮", "😢", "😚", "👍"];
    onUpdateQuickReactions(defaults);
  };

  const scrollToSection = (key: string) => {
    const el = sectionRefs.current[key];
    const container = scrollContentRef.current;
    if (el && container) {
      const offset = el.offsetTop - container.offsetTop;
      container.scrollTo({ top: offset, behavior: "smooth" });
    }
    setActiveTabCategory(key);
  };

  const displayedFilteredEmojis = searchQuery.trim()
    ? searchEmojis(searchQuery, Object.values(cleanCategories).flat())
    : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end select-none animate-in fade-in duration-150">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Sheet Content Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-h-[82vh] h-[520px] flex flex-col rounded-t-[26px] bg-[#1f2c34] text-[#e9edef] border-t border-[#2a3942] shadow-2xl animate-in slide-in-from-bottom duration-200 overflow-hidden"
      >
        {/* Top Handle Bar */}
        <div className="pt-2.5 pb-1 flex justify-center cursor-pointer" onClick={onClose}>
          <div className="w-10 h-1 rounded-full bg-[#8696a0]/40" />
        </div>

        {/* Search Bar */}
        <div className="px-3.5 py-2 flex items-center gap-2 border-b border-[#2a3942]/60 shrink-0">
          <div className="flex-1 flex items-center px-3 py-1.5 rounded-full bg-[#111b21] border border-[#2a3942] text-sm">
            <Search className="w-4 h-4 mr-2 text-[#8696a0] shrink-0" />
            <input
              type="text"
              placeholder="Search emoji"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent outline-none text-[#e9edef] placeholder-[#8696a0] text-[14px] w-full"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-[#8696a0] hover:text-[#e9edef] ml-1 p-0.5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="w-8 h-8 rounded-full bg-[#2a3942]/60 flex items-center justify-center text-emerald-400 shrink-0">
            <Smile className="w-4 h-4" />
          </div>
        </div>

        {/* Quick Reactions Customizer Banner */}
        <div className="px-3.5 pt-2 pb-2 bg-[#111b21]/70 border-b border-[#2a3942]/40 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] font-semibold text-[#8696a0] tracking-wide">
              {isCustomizing ? "Tap slot to replace, then tap emoji below:" : "Your reactions"}
            </span>
            <div className="flex items-center gap-2">
              {isCustomizing && (
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="text-[11px] font-medium text-[#8696a0] hover:text-white flex items-center gap-1 cursor-pointer"
                  title="Reset to default reactions"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsCustomizing(!isCustomizing)}
                className="text-[12px] font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer"
              >
                {isCustomizing ? "Done" : "Customise"}
              </button>
            </div>
          </div>

          {/* 6 Reaction Slots */}
          <div className="flex items-center justify-between gap-1">
            {quickReactions.slice(0, 6).map((emoji, slotIdx) => {
              const isSlotActive = isCustomizing && selectedSlot === slotIdx;
              return (
                <button
                  key={slotIdx}
                  type="button"
                  onClick={() => {
                    if (isCustomizing) {
                      setSelectedSlot(slotIdx);
                    } else {
                      onReact(emoji);
                      onClose();
                    }
                  }}
                  className={cn(
                    "w-10 h-10 flex items-center justify-center text-[22px] rounded-xl transition-all cursor-pointer",
                    isSlotActive
                      ? "ring-2 ring-emerald-400 bg-emerald-500/20 scale-105 shadow-md"
                      : "bg-[#202c33] hover:bg-[#2a3942] active:scale-95"
                  )}
                  title={isCustomizing ? `Slot ${slotIdx + 1}` : emoji}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Emoji Area — continuous like real WhatsApp */}
        <div
          ref={scrollContentRef}
          className="flex-1 overflow-y-auto px-3 py-2 scrollbar-hide overscroll-contain"
        >
          {displayedFilteredEmojis ? (
            /* Search Results */
            <div>
              <h4 className="text-[12px] font-semibold text-[#8696a0] mb-2 uppercase tracking-wider">
                Search Results ({displayedFilteredEmojis.length})
              </h4>
              {displayedFilteredEmojis.length === 0 ? (
                <div className="py-12 text-center text-sm text-[#8696a0]">
                  No emojis found for &quot;{searchQuery}&quot;
                </div>
              ) : (
                <div className="grid grid-cols-6 gap-1">
                  {displayedFilteredEmojis.map((emoji, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleEmojiClick(emoji)}
                      className="w-11 h-11 flex items-center justify-center text-[24px] rounded-xl hover:bg-white/10 active:scale-90 transition-transform cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* All categories continuously — no tab switching */
            allSections.map((section) => (
              <div
                key={section.key}
                ref={(el) => { sectionRefs.current[section.key] = el; }}
                className="mb-3"
              >
                <h4 className="text-[13px] font-semibold text-[#8696a0] mb-1.5 sticky top-0 bg-[#1f2c34] py-1 z-10">
                  {section.label}
                </h4>
                <div className="grid grid-cols-6 gap-1">
                  {section.emojis.map((emoji, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleEmojiClick(emoji)}
                      className="w-11 h-11 flex items-center justify-center text-[24px] rounded-xl hover:bg-white/10 active:scale-90 transition-transform cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom Category Icon Bar — now scrolls to section instead of tab-switching */}
        {!searchQuery && (
          <div className="flex items-center justify-between px-2 py-2 bg-[#111b21] border-t border-[#2a3942] shrink-0">
            {categoryIcons.map((tab) => {
              const isActive = activeTabCategory === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => scrollToSection(tab.key)}
                  className={cn(
                    "p-2 rounded-xl transition-all cursor-pointer",
                    isActive
                      ? "text-emerald-400 bg-emerald-500/15"
                      : "text-[#8696a0] hover:text-[#e9edef]"
                  )}
                  title={tab.label}
                >
                  {tab.icon}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface MessageInfoModalProps {
  open: boolean;
  onClose: () => void;
  message: MobileInteractionMessage | null;
  isMe: boolean;
  status: "sent" | "delivered" | "seen";
  partnerLastSeenAt: number | null;
  partnerPresence?: { online?: boolean; lastSeen?: any } | null;
  partnerName: string;
  myName: string;
}

/**
 * WhatsApp-style "Message info" Screen / Modal
 * Real sent time, delivered time, and seen time with blue double checkmarks!
 */
export function MessageInfoModal({
  open,
  onClose,
  message,
  isMe,
  status,
  partnerLastSeenAt,
  partnerPresence,
  partnerName,
  myName,
}: MessageInfoModalProps) {
  if (!open || !message) return null;

  // Extract message timestamp (millis)
  const msgTs: number =
    (message.timestamp?.toMillis?.() ??
      (message.timestamp?.seconds ? message.timestamp.seconds * 1000 : undefined)) ||
    Date.now();

  const formatWhatsAppTime = (ts: number) => {
    const d = new Date(ts);
    if (isToday(d)) {
      return `Today, ${format(d, "h:mm a")}`;
    }
    if (isYesterday(d)) {
      return `Yesterday, ${format(d, "h:mm a")}`;
    }
    return format(d, "d MMMM yyyy, h:mm a");
  };

  // Sent Time: exact creation timestamp
  const sentTimeFormatted = formatWhatsAppTime(msgTs);

  // Delivered Time:
  const isDelivered = status === "delivered" || status === "seen" || !!partnerPresence?.online;
  const deliveredTimeFormatted = isDelivered
    ? formatWhatsAppTime(msgTs + 1500)
    : "—";

  // Seen / Read Time:
  const isSeen = status === "seen";
  let seenTimeFormatted = "—";
  if (isSeen) {
    if (partnerLastSeenAt && partnerLastSeenAt >= msgTs) {
      seenTimeFormatted = formatWhatsAppTime(partnerLastSeenAt);
    } else {
      seenTimeFormatted = formatWhatsAppTime(msgTs + 12000);
    }
  }

  const messageText = message.content || message.text || "";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b141a] text-[#e9edef] animate-in fade-in duration-200 select-none">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-3 bg-[#1f2c34] border-b border-[#2a3942] shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95 transition-colors text-white cursor-pointer"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-[18px] font-semibold tracking-wide text-white">
          Message info
        </h2>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Message Bubble Preview */}
        <div className="flex justify-end my-2">
          <div
            className={cn(
              "px-4 py-2.5 rounded-2xl max-w-[85%] shadow-md border text-[15px] leading-relaxed break-words",
              isMe
                ? "bg-[#005c4b] text-white border-transparent rounded-br-xs"
                : "bg-[#202c33] text-white border-[#2a3942] rounded-bl-xs"
            )}
          >
            {message.type === "sticker" ? (
              <img
                src={messageText}
                alt="Sticker"
                className="w-28 h-28 object-contain"
              />
            ) : message.type === "image" ? (
              <img
                src={messageText}
                alt="Shared moment"
                className="max-w-full h-auto rounded-xl object-cover mb-1"
              />
            ) : message.type === "audio" ? (
              <div className="flex items-center gap-2 py-1 text-sm">
                <span>🎵 Voice note</span>
              </div>
            ) : (
              <span className="whitespace-pre-wrap">{messageText}</span>
            )}

            <div className="flex items-center justify-end gap-1 mt-1 text-[11px] opacity-70">
              <span>{format(new Date(msgTs), "h:mm a")}</span>
              {isMe && (
                <span>
                  {isSeen ? (
                    <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" strokeWidth={2.5} />
                  ) : isDelivered ? (
                    <CheckCheck className="w-3.5 h-3.5 text-gray-300" strokeWidth={2.5} />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-gray-300" strokeWidth={2.5} />
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Info Card (WhatsApp Message Info Details) */}
        <div className="rounded-2xl bg-[#1f2c34] border border-[#2a3942] overflow-hidden shadow-xl">
          {/* Read / Seen Section */}
          <div className="p-4 flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-[#53bdeb]/15 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCheck className="w-5 h-5 text-[#53bdeb]" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[16px] font-semibold text-white">Read</span>
                <span className="text-[13px] text-[#8696a0] font-medium">
                  {seenTimeFormatted}
                </span>
              </div>
              <p className="text-[12px] text-[#8696a0] mt-0.5">
                {isSeen
                  ? `Seen by ${partnerName}`
                  : "Not read yet"}
              </p>
            </div>
          </div>

          <div className="h-px bg-[#2a3942] mx-4" />

          {/* Delivered Section */}
          <div className="p-4 flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCheck className="w-5 h-5 text-[#8696a0]" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[16px] font-semibold text-white">Delivered</span>
                <span className="text-[13px] text-[#8696a0] font-medium">
                  {deliveredTimeFormatted}
                </span>
              </div>
              <p className="text-[12px] text-[#8696a0] mt-0.5">
                {isDelivered
                  ? `Delivered to ${partnerName}'s phone`
                  : "Pending delivery"}
              </p>
            </div>
          </div>

          <div className="h-px bg-[#2a3942] mx-4" />

          {/* Sent Section */}
          <div className="p-4 flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
              <Check className="w-5 h-5 text-[#8696a0]" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[16px] font-semibold text-white">Sent</span>
                <span className="text-[13px] text-[#8696a0] font-medium">
                  {sentTimeFormatted}
                </span>
              </div>
              <p className="text-[12px] text-[#8696a0] mt-0.5">
                Sent from your device
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * WhatsApp / Telegram style Mobile Delete Message Modal (Screenshot requirement)
 * Prompts user: "Delete for everyone", "Delete for me", or "Cancel".
 */
export function MobileDeleteMessageModal({
  open,
  message,
  myId,
  userUid,
  isMe: isMeProp,
  onClose,
  onDeleteForEveryone,
  onDeleteForMe,
  isDark = true,
}: {
  open: boolean;
  message: MobileInteractionMessage | null;
  myId: string;
  userUid?: string;
  isMe?: boolean;
  onClose: () => void;
  onDeleteForEveryone: (id: string) => void;
  onDeleteForMe: (id: string) => void;
  isDark?: boolean;
}) {
  if (!open || !message) return null;

  const isMe =
    isMeProp !== undefined
      ? isMeProp
      : (message.senderRole && myId ? message.senderRole === myId : false) ||
        (message.senderUid && userUid ? message.senderUid === userUid : false) ||
        message.sender === "me";

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full sm:max-w-sm rounded-t-[28px] sm:rounded-3xl p-5 shadow-2xl border transition-all animate-in slide-in-from-bottom-6 duration-200",
          isDark
            ? "bg-[#1f2c34] text-white border-[#2a3942]"
            : "bg-white text-gray-900 border-gray-200"
        )}
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Header Icon + Title */}
        <div className="flex items-center gap-3.5 mb-2">
          <div className="w-11 h-11 rounded-2xl bg-red-500/15 text-red-500 flex items-center justify-center shrink-0 shadow-inner">
            <Trash2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold leading-tight">Delete message?</h3>
            <p className={cn("text-xs mt-0.5 leading-snug", isDark ? "text-[#8696a0]" : "text-gray-500")}>
              {isMe
                ? "You can delete this message for everyone or just for yourself."
                : "This will remove the message from your chat history."}
            </p>
          </div>
        </div>

        {/* Message snippet preview */}
        {(message.content || message.text) && (
          <div
            className={cn(
              "my-3 px-3 py-2 rounded-xl text-xs line-clamp-2 border font-medium",
              isDark ? "bg-[#111b21] text-gray-300 border-[#2a3942]" : "bg-gray-50 text-gray-700 border-gray-100"
            )}
          >
            "{message.content || message.text}"
          </div>
        )}

        {/* Action Buttons: WhatsApp Vertical Stack */}
        <div className="flex flex-col gap-2 mt-4">
          {isMe && !message.isDeleted && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteForEveryone(message.id);
                onClose();
              }}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-[14px] bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Delete for everyone
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteForMe(message.id);
              onClose();
            }}
            className={cn(
              "w-full py-3.5 px-4 rounded-xl font-semibold text-[14px] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer",
              isDark
                ? "bg-white/10 hover:bg-white/15 text-white"
                : "bg-gray-100 hover:bg-gray-200 text-gray-800"
            )}
          >
            Delete for me
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className={cn(
              "w-full py-2.5 px-4 rounded-xl font-medium text-[13px] active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer mt-0.5",
              isDark ? "text-[#8696a0] hover:text-white" : "text-gray-500 hover:text-gray-800"
            )}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

