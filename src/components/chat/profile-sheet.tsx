
"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Phone, Video, Heart, Flame, Camera, User as UserIcon, X } from "lucide-react";
import { MediaViewer } from "@/components/chat/media-viewer";
import { cn } from "@/lib/utils";

interface ProfileSheetProps {
  open: boolean;
  onClose: () => void;
  /** Whether this sheet is showing your own profile (own) or the partner's */
  mode: "own" | "partner";
  displayName: string;
  photoURL: string;
  isOnline?: boolean;
  streak?: number;
  /** Called when user taps "Change Photo" — only relevant in 'own' mode */
  onChangePhoto?: () => void;
  /** Called when user taps the Call button */
  onAudioCall?: () => void;
  /** Called when user taps the Video Call button */
  onVideoCall?: () => void;
}

export function ProfileSheet({
  open,
  onClose,
  mode,
  displayName,
  photoURL,
  isOnline = false,
  streak = 0,
  onChangePhoto,
  onAudioCall,
  onVideoCall,
}: ProfileSheetProps) {
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const initials = displayName?.[0]?.toUpperCase() || (mode === "own" ? "M" : "P");

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent
          side="bottom"
          className="rounded-t-[2.5rem] border-t border-primary/10 bg-background/98 backdrop-blur-2xl p-0 max-h-[85dvh] overflow-y-auto focus:outline-none"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            if (e.currentTarget instanceof HTMLElement) {
              e.currentTarget.focus();
            }
          }}
          onPointerDownOutside={(e) => {
            if (isViewerOpen) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            if (isViewerOpen) {
              e.preventDefault();
            }
          }}
        >

          <SheetHeader className="sr-only">
            <SheetTitle>{mode === "own" ? "Your Profile" : `${displayName}'s Profile`}</SheetTitle>
          </SheetHeader>

          {/* Drag handle + explicit close button row */}
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <div className="w-8" />{/* spacer */}
            <div className="w-10 h-1 bg-muted-foreground/20 rounded-full" />
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors active:scale-90"
              aria-label="Close profile"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col items-center px-6 pb-10 pt-4 gap-6">
            {/* Avatar — tappable to open full-screen viewer */}
            <div className="relative group">
              <button
                onClick={() => setIsViewerOpen(true)}
                className="relative w-28 h-28 rounded-full focus:outline-none focus:ring-4 focus:ring-primary/30 transition-transform active:scale-95"
                aria-label={`View ${displayName}'s photo`}
              >
                <Avatar className="w-28 h-28 border-4 border-primary/15 shadow-2xl shadow-primary/20">
                  <AvatarImage src={photoURL} className="object-cover" />
                  <AvatarFallback className="bg-primary/10 text-primary text-4xl font-headline font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {/* Hover overlay */}
                <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-[10px] font-headline uppercase tracking-widest">View</span>
                </div>
              </button>

              {/* Online dot */}
              {mode === "partner" && (
                <span
                  className={cn(
                    "absolute bottom-1 right-1 w-4 h-4 border-2 border-background rounded-full transition-colors",
                    isOnline ? "bg-green-500" : "bg-muted-foreground/30"
                  )}
                />
              )}

              {/* Change photo button — own profile only */}
              {mode === "own" && onChangePhoto && (
                <button
                  onClick={onChangePhoto}
                  className="absolute -bottom-1 -right-1 w-9 h-9 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30 hover:scale-110 active:scale-95 transition-transform"
                  aria-label="Change photo"
                >
                  <Camera className="w-4 h-4 text-primary-foreground" />
                </button>
              )}
            </div>

            {/* Name + status */}
            <div className="flex flex-col items-center gap-1.5 text-center">
              <h2 className="font-headline text-2xl font-bold tracking-tight flex items-center gap-2">
                {displayName}
                {mode === "partner" && <Heart className="w-4 h-4 text-primary fill-primary" />}
              </h2>
              <p
                className={cn(
                  "text-[11px] uppercase tracking-widest font-headline font-semibold",
                  isOnline ? "text-green-500" : "text-muted-foreground/60"
                )}
              >
                {mode === "partner"
                  ? isOnline ? "Active Now" : "Last seen recently"
                  : "Your Profile"}
              </p>
            </div>

            {/* Joint Space Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-pink-500/5 text-pink-500 border border-pink-500/10 rounded-full select-none animate-in fade-in duration-300">
              <span className="text-[9px] font-headline uppercase tracking-widest font-bold flex items-center gap-1">
                DuoNexus · Nabin <Heart className="w-2.5 h-2.5 fill-pink-500 text-pink-500 animate-pulse" /> Karu
              </span>
            </div>

            {/* Streak pill */}
            {streak > 0 && (
              <div className="flex items-center gap-2 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-full px-4 py-2">
                <Flame className="w-4 h-4 fill-orange-500" />
                <span className="text-sm font-headline font-bold">{streak} day streak</span>
              </div>
            )}

            {/* Action buttons — only on partner profile */}
            {mode === "partner" && (
              <div className="flex items-center gap-4 w-full mt-2">
                <Button
                  variant="outline"
                  className="flex-1 h-14 rounded-2xl flex flex-col gap-1 items-center justify-center border-primary/10 hover:bg-primary/5 hover:border-primary/20 transition-all group"
                  onClick={() => { onClose(); onAudioCall?.(); }}
                >
                  <Phone className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-headline uppercase tracking-widest text-muted-foreground">Call</span>
                </Button>
                <Button
                  className="flex-1 h-14 rounded-2xl flex flex-col gap-1 items-center justify-center bg-primary shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  onClick={() => { onClose(); onVideoCall?.(); }}
                >
                  <Video className="w-5 h-5" />
                  <span className="text-[10px] font-headline uppercase tracking-widest opacity-80">Video</span>
                </Button>
              </div>
            )}

            {/* Own profile placeholder */}
            {mode === "own" && (
              <div className="w-full p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-3">
                <UserIcon className="w-5 h-5 text-primary/60 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Tap the camera button above to update your photo. Changes sync to your partner in real time.
                </p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Full-screen photo viewer */}
      <MediaViewer
        src={photoURL}
        alt={`${displayName}'s photo`}
        open={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
      />
    </>
  );
}
