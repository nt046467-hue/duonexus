
"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, CheckCheck, Trash2, MoreVertical, Play, Pause, Smile, Download, Video } from "lucide-react";
import { format } from "date-fns";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { doc, deleteDoc, collection, addDoc, serverTimestamp, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { useFirestore, useUser } from "@/firebase";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface MessageBubbleProps {
  id: string;
  content: string;
  type: "text" | "image" | "audio" | "video";
  timestamp: number;
  isMe: boolean;
  status: "sent" | "delivered" | "seen";
}

const REACTIONS = ["❤️", "😘", "🔥", "😂", "🥺", "🥰"];

export function MessageBubble({ id, content, type, timestamp, isMe, status }: MessageBubbleProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isPlaying, setIsPlaying] = useState(false);
  const [reactions, setReactions] = useState<{emoji: string, count: number, users: string[]}[]>([]);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!firestore || !id) return;
    const q = query(collection(firestore, "reactions"), where("messageId", "==", id));
    const unsub = onSnapshot(q, (snapshot) => {
      const rMap: Record<string, string[]> = {};
      snapshot.docs.forEach(d => {
        const data = d.data();
        if (!rMap[data.emoji]) rMap[data.emoji] = [];
        rMap[data.emoji].push(data.userId);
      });
      setReactions(Object.entries(rMap).map(([emoji, users]) => ({ emoji, count: users.length, users })));
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
    const q = query(collection(firestore, "reactions"), where("messageId", "==", id), where("userId", "==", user.uid), where("emoji", "==", emoji));
    const existing = await getDocs(q);
    if (!existing.empty) {
      existing.docs.forEach(d => deleteDoc(doc(firestore, "reactions", d.id)));
    } else {
      await addDoc(collection(firestore, "reactions"), { messageId: id, userId: user.uid, emoji, timestamp: serverTimestamp() });
    }
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause(); else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  return (
    <div className={cn("flex flex-col gap-1 mb-6 chat-bubble-spring group", isMe ? "items-end" : "items-start")}>
      <div className={cn("relative flex items-center gap-1 max-w-[85%] sm:max-w-[75%]", isMe && "flex-row-reverse")}>
        <div className={cn("px-4 py-3 rounded-[1.5rem] text-sm leading-relaxed relative shadow-sm border transition-all", isMe ? "bg-primary text-primary-foreground rounded-tr-none border-primary/10" : "bg-card border-primary/5 text-foreground rounded-tl-none")}>
          {type === "text" && content}
          {type === "image" && (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-muted/20 cursor-pointer" onClick={() => setIsViewerOpen(true)}>
              <img src={content} alt="Memory" className="max-w-full h-auto min-h-[100px] block object-cover" />
              <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
                <DialogContent className="max-w-[100vw] max-h-[100vh] h-[100dvh] w-screen p-0 border-none bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center z-[100]">
                  <DialogHeader className="sr-only">
                    <DialogTitle>View Shared Moment</DialogTitle>
                    <DialogDescription>A special moment shared in your nexus.</DialogDescription>
                  </DialogHeader>
                  <img src={content} className="max-w-[95%] max-h-[90%] object-contain rounded-lg" alt="Full view" />
                </DialogContent>
              </Dialog>
            </div>
          )}
          {type === "video" && (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-muted/20">
              <video 
                src={content} 
                controls 
                className="max-w-full h-auto rounded-lg" 
                poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m22 8-6 4 6 4V8Z'%3E%3C/path%3E%3Crect width='14' height='12' x='2' y='6' rx='2' ry='2'%3E%3C/rect%3E%3C/svg%3E"
              />
            </div>
          )}
          {type === "audio" && (
            <div className="flex items-center gap-3 py-1 min-w-[200px]">
              <button onClick={toggleAudio} className={cn("w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md", isMe ? "bg-white/20" : "bg-primary/10")}>
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <div className="flex-1 h-1.5 bg-muted/20 rounded-full overflow-hidden">
                <div className={cn("h-full bg-primary", isPlaying ? "w-full animate-pulse" : "w-0")} />
              </div>
              <audio ref={audioRef} src={content} onEnded={() => setIsPlaying(false)} className="hidden" />
            </div>
          )}
          
          <div className={cn("flex items-center gap-1 mt-1 justify-end opacity-60")}>
            <span className="text-[9px] font-headline">{timestamp ? format(timestamp, "h:mm a") : "..."}</span>
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

          {reactions.length > 0 && (
            <div className={cn("absolute -bottom-3 flex gap-1", isMe ? "right-2" : "left-2")}>
              {reactions.map((r) => (
                <button key={r.emoji} onClick={() => toggleReaction(r.emoji)} className="bg-background/95 border border-primary/10 rounded-full px-2 py-0.5 text-[10px] shadow-sm flex items-center gap-1">
                  <span>{r.emoji}</span>
                  {r.count > 1 && <span className="font-bold">{r.count}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={cn("flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 px-1", isMe ? "flex-row-reverse" : "flex-row")}>
          <div className="flex items-center gap-0">
            <Popover>
              <PopoverTrigger asChild>
                <button className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                  <Smile className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-1.5 rounded-full flex gap-0.5 bg-background/95 backdrop-blur-xl border-primary/10 shadow-2xl" side="top">
                {REACTIONS.map(emoji => (
                  <button key={emoji} onClick={() => toggleReaction(emoji)} className="hover:scale-125 transition-transform p-1 text-base">
                    {emoji}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isMe ? "end" : "start"} className="rounded-xl border-primary/10 bg-background/95 backdrop-blur-xl">
                {isMe && (
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive gap-2 focus:bg-destructive/10">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => {}} className="gap-2 focus:bg-primary/10">
                  <Download className="w-3.5 h-3.5" /> Download
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}
