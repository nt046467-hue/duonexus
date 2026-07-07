
"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, CheckCheck, Trash2, MoreVertical, Play, Pause, Smile, Download, Reply } from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  doc,
  deleteDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { useFirestore, useUser } from "@/firebase";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { MediaViewer } from "@/components/chat/media-viewer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface MessageBubbleProps {
  id: string;
  content: string;
  type: "text" | "image" | "audio" | "video" | "gif";
  timestamp: number;
  isMe: boolean;
  status: "sent" | "delivered" | "seen";
  waveform?: number[];
  replyToId?: string;
  replyToContent?: string;
  replyToSender?: string;
  replyToType?: "text" | "image" | "audio" | "video" | "gif";
  onReply?: (id: string) => void;
  onScrollToMessage?: (id: string) => void;
  /** Show partner avatar to the left (first message in a consecutive group) */
  isFirstInGroup?: boolean;
  partnerAvatar?: string;
  partnerInitial?: string;
  onAvatarClick?: () => void;
}


const REACTIONS = ["❤️", "😘", "🔥", "😂", "🥺", "🥰"];

/** Waveform visualizer for audio messages */
function WaveformDisplay({
  bars,
  progress,
  isMe,
}: {
  bars: number[];
  progress: number;
  isMe: boolean;
}) {
  return (
    <div className="flex items-center gap-[2px] flex-1 h-8">
      {bars.map((amp, i) => {
        const isPast = i / bars.length < progress;
        return (
          <div
            key={i}
            className={cn(
              "rounded-full w-[3px] transition-all",
              isPast
                ? "bg-current opacity-90"
                : isMe
                ? "bg-white/30"
                : "bg-primary/25"
            )}
            style={{ height: `${Math.max(4, amp * 28)}px` }}
          />
        );
      })}
    </div>
  );
}

export function MessageBubble({
  id,
  content,
  type,
  timestamp,
  isMe,
  status,
  waveform,
  replyToId,
  replyToContent,
  replyToSender,
  replyToType,
  onReply,
  onScrollToMessage,
  isFirstInGroup = false,
  partnerAvatar,
  partnerInitial = "P",
  onAvatarClick,
}: MessageBubbleProps) {

  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [reactions, setReactions] = useState<
    { emoji: string; count: number; users: string[] }[]
  >([]);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Expose this bubble for scroll-to
  useEffect(() => {
    if (bubbleRef.current) {
      bubbleRef.current.dataset.messageId = id;
    }
  }, [id]);

  // Highlight flash when jumped to
  useEffect(() => {
    if (isHighlighted) {
      const t = setTimeout(() => setIsHighlighted(false), 1500);
      return () => clearTimeout(t);
    }
  }, [isHighlighted]);

  // Audio progress tracker
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleTime = () => {
      if (audio.duration) setAudioProgress(audio.currentTime / audio.duration);
    };
    audio.addEventListener("timeupdate", handleTime);
    return () => audio.removeEventListener("timeupdate", handleTime);
  }, []);

  // Reactions listener
  useEffect(() => {
    if (!firestore || !id) return;
    const q = query(
      collection(firestore, "reactions"),
      where("messageId", "==", id)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const rMap: Record<string, string[]> = {};
      snapshot.docs.forEach((d) => {
        const data = d.data();
        if (!rMap[data.emoji]) rMap[data.emoji] = [];
        rMap[data.emoji].push(data.userId);
      });
      setReactions(
        Object.entries(rMap).map(([emoji, users]) => ({
          emoji,
          count: users.length,
          users,
        }))
      );
    });
    return () => unsub();
  }, [firestore, id]);

  const handleDelete = async () => {
    if (!firestore || !isMe) return;
    try {
      await deleteDoc(doc(firestore, "messages", id));
      toast({ title: "Message Deleted", description: "Removed for both! ✨" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Delete failed." });
    }
  };

  const toggleReaction = async (emoji: string) => {
    if (!firestore || !user) return;
    const q = query(
      collection(firestore, "reactions"),
      where("messageId", "==", id),
      where("userId", "==", user.uid),
      where("emoji", "==", emoji)
    );
    const existing = await getDocs(q);
    if (!existing.empty) {
      existing.docs.forEach((d) => deleteDoc(doc(firestore, "reactions", d.id)));
    } else {
      await addDoc(collection(firestore, "reactions"), {
        messageId: id,
        userId: user.uid,
        emoji,
        timestamp: serverTimestamp(),
      });
    }
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleDownload = async () => {
    if (!content) return;
    try {
      // For Storage URLs — fetch as blob then trigger download
      const response = await fetch(content);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `duonexus-${type}-${id.slice(0, 8)}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    } catch {
      // Fallback for cross-origin: open in new tab
      window.open(content, "_blank");
    }
  };

  const handleReply = () => {
    onReply?.(id);
  };

  const handleScrollToOriginal = () => {
    if (replyToId) onScrollToMessage?.(replyToId);
  };

  // Render waveform bars — fallback to 40 equal bars if none stored
  const waveformBars = waveform && waveform.length > 0
    ? waveform
    : new Array(40).fill(0.4);

  const isCallLog = type === "text" && (content.startsWith("📞") || content.startsWith("📹") || content.startsWith("🎥"));

  if (isCallLog) {
    const isMissed = content.toLowerCase().includes("missed") || content.toLowerCase().includes("declined");
    return (
      <div
        ref={bubbleRef}
        className="flex justify-center w-full my-2 animate-in fade-in zoom-in duration-300"
        id={`msg-${id}`}
      >
        <div className={cn(
          "px-4 py-1.5 rounded-full text-[11px] font-headline flex items-center gap-2 border shadow-sm backdrop-blur-sm select-none",
          isMissed
            ? "bg-red-500/10 border-red-500/20 text-red-500"
            : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
        )}>
          <span className="font-bold tracking-tight">{content}</span>
          <span className="opacity-60 text-[9px] font-sans">
            {timestamp ? format(timestamp, "h:mm a") : "..."}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={bubbleRef}
      className={cn(
        "flex gap-2 mb-6 chat-bubble-spring group transition-all duration-300",
        isMe ? "justify-end" : "justify-start",
        isHighlighted && "scale-[1.02]"
      )}
      id={`msg-${id}`}
    >
      {/* Partner avatar — left side, first in group only */}
      {!isMe && (
        <div className="shrink-0 w-6 self-end mb-1">
          {isFirstInGroup ? (
            <button
              onClick={onAvatarClick}
              className="focus:outline-none active:scale-90 transition-transform"
              aria-label="View profile"
            >
              <Avatar className="w-6 h-6 border border-primary/20">
                <AvatarImage src={partnerAvatar} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-bold font-headline">
                  {partnerInitial}
                </AvatarFallback>
              </Avatar>
            </button>
          ) : (
            <div className="w-6 h-6" /> /* spacer to align non-first bubbles */
          )}
        </div>
      )}

      <div
        className={cn(
          "flex flex-col gap-1",
          isMe ? "items-end" : "items-start"
        )}
      >

      <div
        className={cn(
          "relative flex items-center gap-1 max-w-[85%] sm:max-w-[75%]",
          isMe && "flex-row-reverse"
        )}
      >
        <div
          className={cn(
            "px-4 py-3 rounded-[1.5rem] text-sm leading-relaxed relative shadow-sm border transition-all",
            isMe
              ? "bg-primary text-primary-foreground rounded-tr-none border-primary/10"
              : "bg-card border-primary/5 text-foreground rounded-tl-none",
            isHighlighted &&
              "ring-2 ring-primary ring-offset-2 ring-offset-background"
          )}
        >
          {/* Reply quote block */}
          {replyToId && replyToContent && (
            <button
              onClick={handleScrollToOriginal}
              className={cn(
                "w-full text-left mb-2 px-3 py-2 rounded-xl border-l-2 transition-all active:scale-95",
                isMe
                  ? "bg-white/10 border-white/40 hover:bg-white/20"
                  : "bg-primary/8 border-primary/40 hover:bg-primary/12"
              )}
            >
              <p className={cn("text-[9px] font-headline uppercase tracking-widest mb-0.5", isMe ? "text-white/70" : "text-primary/70")}>
                {replyToSender}
              </p>
              <p className={cn("text-xs truncate opacity-80")}>
                {replyToType === "text"
                  ? replyToContent.slice(0, 60)
                  : replyToType === "image"
                  ? "📷 Photo"
                  : replyToType === "gif"
                  ? "🎞️ GIF"
                  : replyToType === "video"
                  ? "🎥 Video"
                  : "🎵 Voice note"}
              </p>
            </button>
          )}

          {/* Message content */}
          {type === "text" && content}

          {type === "image" && (
            <>
              <div
                className="overflow-hidden rounded-xl border border-white/10 bg-muted/20 cursor-pointer"
                onClick={() => setIsViewerOpen(true)}
              >
                <img
                  src={content}
                  alt="Shared moment"
                  className="max-w-full h-auto min-h-[100px] block object-cover"
                />
              </div>
              <MediaViewer
                src={content}
                alt="Shared moment"
                open={isViewerOpen}
                onClose={() => setIsViewerOpen(false)}
              />
            </>
          )}

          {type === "gif" && (
            <div
              className="overflow-hidden rounded-xl border border-white/10 bg-muted/20 cursor-pointer"
              onClick={() => setIsViewerOpen(true)}
            >
              <img
                src={content}
                alt="GIF"
                className="max-w-full h-auto block"
                style={{ imageRendering: "auto" }}
              />
              <MediaViewer
                src={content}
                alt="GIF"
                open={isViewerOpen}
                onClose={() => setIsViewerOpen(false)}
              />
            </div>
          )}


          {type === "video" && (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-muted/20">
              <video
                src={content}
                controls
                playsInline
                className="max-w-full h-auto rounded-lg"
              />
            </div>
          )}

          {type === "audio" && (
            <div className="flex items-center gap-3 py-1 min-w-[200px]">
              <button
                onClick={toggleAudio}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md shrink-0",
                  isMe ? "bg-white/20 hover:bg-white/30" : "bg-primary/10 hover:bg-primary/20"
                )}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </button>

              {/* Real waveform */}
              <WaveformDisplay
                bars={waveformBars}
                progress={audioProgress}
                isMe={isMe}
              />

              <audio
                ref={audioRef}
                src={content}
                onEnded={() => {
                  setIsPlaying(false);
                  setAudioProgress(0);
                }}
                className="hidden"
              />
            </div>
          )}

          {/* Timestamp + status */}
          <div className="flex items-center gap-1 mt-1 justify-end opacity-60">
            <span className="text-[9px] font-headline">
              {timestamp ? format(timestamp, "h:mm a") : "..."}
            </span>
            {isMe && (
              <span className="flex items-center">
                {status === "seen" ? (
                  <CheckCheck className="w-3.5 h-3.5 text-sky-400" strokeWidth={3} />
                ) : status === "delivered" ? (
                  <CheckCheck className="w-3.5 h-3.5" strokeWidth={3} />
                ) : (
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                )}
              </span>
            )}
          </div>

          {/* Reaction bubbles */}
          {reactions.length > 0 && (
            <div
              className={cn(
                "absolute -bottom-3 flex gap-1",
                isMe ? "right-2" : "left-2"
              )}
            >
              {reactions.map((r) => (
                <button
                  key={r.emoji}
                  onClick={() => toggleReaction(r.emoji)}
                  className="bg-background/95 border border-primary/10 rounded-full px-2 py-0.5 text-[10px] shadow-sm flex items-center gap-1 hover:scale-110 transition-transform"
                >
                  <span>{r.emoji}</span>
                  {r.count > 1 && (
                    <span className="font-bold">{r.count}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons (hover) */}
        <div
          className={cn(
            "flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 px-1",
            isMe ? "flex-row-reverse" : "flex-row"
          )}
        >
          {/* Reaction picker */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                <Smile className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-1.5 rounded-full flex gap-0.5 bg-background/95 backdrop-blur-xl border-primary/10 shadow-2xl"
              side="top"
            >
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => toggleReaction(emoji)}
                  className="hover:scale-125 transition-transform p-1 text-base"
                >
                  {emoji}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* More options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align={isMe ? "end" : "start"}
              className="rounded-xl border-primary/10 bg-background/95 backdrop-blur-xl"
            >
              <DropdownMenuItem
                onClick={handleReply}
                className="gap-2 focus:bg-primary/10"
              >
                <Reply className="w-3.5 h-3.5" /> Reply
              </DropdownMenuItem>
              {type !== "text" && (
                <DropdownMenuItem
                  onClick={handleDownload}
                  className="gap-2 focus:bg-primary/10"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </DropdownMenuItem>
              )}
              {isMe && (
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive gap-2 focus:bg-destructive/10"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
    </div>
  );
}
