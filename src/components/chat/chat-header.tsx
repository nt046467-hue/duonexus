
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Flame,
  Settings,
  User as UserIcon,
  Camera,
  LogOut,
  Sun,
  Moon,
  Heart as HeartIcon,
  Bell,
  BellOff,
  Send,
  Sparkles,
  Loader2,
  CalendarHeart,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect, useRef } from "react";
import { updateProfile, signOut } from "firebase/auth";
import { doc, setDoc, serverTimestamp, collection, query, orderBy } from "firebase/firestore";
import { useFirestore, useUser, useDoc, useMemoFirebase, useAuth, useCollection } from "@/firebase";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { MoodBadges } from "@/components/chat/mood-checkin";
import { differenceInDays, parseISO, format, setYear } from "date-fns";

interface ChatHeaderProps {
  partnerName: string;
  partnerAvatar: string;
  isOnline: boolean;
  streak: number;
  countdownLabel: string;
  onGenerateSpark: () => void;
  isGeneratingSpark: boolean;
  partnerId: string;
  myMood?: string | null;
  partnerMood?: string | null;
}

function computeNextOccurrence(dateStr: string, recurring: boolean): { days: number; label: string } | null {
  try {
    const now = new Date();
    let target = parseISO(dateStr);

    if (recurring) {
      // Set to this year; if already passed, roll to next year
      target = setYear(target, now.getFullYear());
      if (target < now) {
        target = setYear(target, now.getFullYear() + 1);
      }
    } else {
      if (target < now) return null; // past non-recurring date
    }

    const days = differenceInDays(target, now);
    return { days, label: format(target, "MMM d") };
  } catch {
    return null;
  }
}

export function ChatHeader({
  partnerName,
  partnerAvatar,
  isOnline,
  streak,
  onGenerateSpark,
  isGeneratingSpark,
  partnerId,
  myMood,
  partnerMood,
}: ChatHeaderProps) {
  const { user } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [newName, setNewName] = useState("");
  const [newPhotoURL, setNewPhotoURL] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCountdownOpen, setIsCountdownOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [myId, setMyId] = useState<string>("");

  useEffect(() => {
    const role = typeof window !== "undefined" ? localStorage.getItem("duonexus_role") : null;
    if (role) setMyId(role);
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, []);

  const myProfileRef = useMemoFirebase(() => {
    if (!db || !myId) return null;
    return doc(db, "profiles", myId);
  }, [db, myId]);
  const { data: myProfile } = useDoc(myProfileRef);

  // Partner typing
  const typingRef = useMemoFirebase(() => {
    if (!db || !partnerId) return null;
    return doc(db, "typing", partnerId);
  }, [db, partnerId]);
  const { data: partnerTyping } = useDoc(typingRef);

  const isTyping =
    partnerTyping?.isTyping &&
    partnerTyping?.lastUpdated?.seconds &&
    Math.floor(Date.now() / 1000) - partnerTyping.lastUpdated.seconds < 4;

  // Key dates for countdown
  const keyDatesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "keyDates"), orderBy("date", "asc"));
  }, [db]);
  const { data: keyDates } = useCollection(keyDatesQuery);

  // Compute next countdown from keyDates
  const nextCountdown = (() => {
    if (!keyDates || keyDates.length === 0) return null;
    const upcoming = keyDates
      .map((kd: any) => {
        const result = computeNextOccurrence(kd.date, kd.recurring !== false);
        if (!result) return null;
        return { ...result, label: kd.label, id: kd.id };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.days - b.days);
    return upcoming[0] || null;
  })();

  useEffect(() => {
    if (myProfile) {
      if (!newName) setNewName(myProfile.displayName || "");
      if (!newPhotoURL) setNewPhotoURL(myProfile.photoURL || "");
    }
  }, [myProfile]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const isDark = savedTheme === "dark" || !savedTheme;
    setIsDarkMode(isDark);
    if (isDark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, []);

  const toggleTheme = (checked: boolean) => {
    setIsDarkMode(checked);
    if (checked) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const toggleNotifications = async (checked: boolean) => {
    if (!("Notification" in window)) {
      toast({ variant: "destructive", title: "Not Supported", description: "Browser restrictions." });
      return;
    }
    if (checked) {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setNotificationsEnabled(true);
        toast({ title: "Notifications On", description: "Alerts enabled! ❤️" });
      }
    } else {
      setNotificationsEnabled(false);
    }
  };

  const sendTestNotification = async () => {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification("DuoNexus ❤️", {
          body: "Thinking of you! 💕",
          icon: partnerAvatar || `${window.location.origin}/icon-192.png`,
          badge: `${window.location.origin}/badge-72.png`,
        });
        toast({ title: "Test Sent", description: "System tray check! ✨" });
      } catch (e) {
        toast({ variant: "destructive", title: "Error", description: "Check sw.js status." });
      }
    }
  };

  const resizeImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 500;
        let w = img.width, h = img.height;
        if (w > h) {
          if (w > MAX) { h *= MAX / w; w = MAX; }
        } else {
          if (h > MAX) { w *= MAX / h; h = MAX; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const resized = await resizeImage(reader.result as string);
        setNewPhotoURL(resized);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user || !db || !myId || !newName.trim()) return;
    setIsSaving(true);
    try {
      await setDoc(
        doc(db, "profiles", myId),
        {
          displayName: newName,
          photoURL: newPhotoURL || `https://picsum.photos/seed/${myId}/500/500`,
          lastActive: serverTimestamp(),
        },
        { merge: true }
      );
      await updateProfile(user, { displayName: newName });
      toast({ title: "Profile Updated", description: "Changes live! ✨" });
      setIsSettingsOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Oops!", description: "Save failed." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem("duonexus_role");
      await signOut(auth);
      router.push("/login");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <header className="w-full bg-background/80 backdrop-blur-xl border-b border-primary/5 shrink-0 z-50 sticky top-0 px-4">
      <div className="h-16 flex items-center justify-between w-full safe-top">
        {/* Left: avatar + name */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <Avatar className="h-10 w-10 border-2 border-primary/20 p-0.5 shadow-sm">
              <AvatarImage key={partnerAvatar} src={partnerAvatar} className="rounded-full object-cover" />
              <AvatarFallback className="bg-primary/5 text-primary font-headline text-sm font-bold">
                {partnerName?.[0]?.toUpperCase() || "P"}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "absolute bottom-0 right-0 w-3 h-3 border-2 border-background rounded-full transition-colors",
                isOnline ? "bg-green-500" : "bg-muted-foreground/30"
              )}
            />
          </div>
          <div className="flex flex-col min-w-0">
            <h2 className="text-[13px] font-headline font-bold leading-none truncate flex items-center gap-1">
              {partnerName || "Partner"}
              <HeartIcon className="w-2.5 h-2.5 text-primary fill-primary" />
            </h2>
            <p
              className={cn(
                "text-[9px] uppercase tracking-widest font-headline truncate mt-1 transition-colors",
                isTyping ? "text-primary font-bold animate-pulse" : "text-muted-foreground/70"
              )}
            >
              {isTyping ? "typing..." : isOnline ? "Active Now" : "Last seen recently"}
            </p>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Mood badges */}
          <MoodBadges
            myMood={myMood ?? null}
            partnerMood={partnerMood ?? null}
            partnerName={partnerName}
          />

          {/* Countdown pill */}
          {nextCountdown && (
            <button
              onClick={() => setIsCountdownOpen(true)}
              className="flex items-center gap-1 bg-pink-500/10 text-pink-500 border border-pink-500/20 rounded-full px-2 py-1 h-7 text-[10px] font-headline font-bold hover:bg-pink-500/20 transition-colors shrink-0"
            >
              <CalendarHeart className="w-3 h-3" />
              <span>{nextCountdown.days}d</span>
            </button>
          )}

          {/* AI Spark */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-primary/60 hover:text-primary hover:bg-primary/5 rounded-full transition-colors"
            onClick={onGenerateSpark}
            disabled={isGeneratingSpark}
          >
            {isGeneratingSpark ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
          </Button>

          {/* Streak badge */}
          <Badge
            variant="secondary"
            className="bg-orange-500/10 text-orange-500 border-none gap-1 flex items-center font-headline px-2 py-0.5 rounded-full shrink-0 shadow-sm h-7"
          >
            <Flame className="w-3 h-3 fill-orange-500" />
            <span className="text-[11px] font-bold">{streak}</span>
          </Badge>

          {/* Settings */}
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-primary/60 hover:text-primary hover:bg-primary/5 rounded-full transition-colors"
              >
                <Settings className="w-5 h-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[92vw] max-w-[425px] rounded-[2.5rem] border-primary/5 bg-background/95 backdrop-blur-2xl p-8 z-[110]">
              <DialogHeader className="mb-4">
                <DialogTitle className="font-headline text-xl tracking-tighter text-left">
                  Profile Settings
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground text-left">
                  Customize your DuoNexus presence.
                </DialogDescription>
              </DialogHeader>
              <div className="py-2 space-y-6">
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="relative group cursor-pointer"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <Avatar className="h-24 w-24 border-4 border-primary/10 shadow-xl transition-transform active:scale-95">
                      <AvatarImage key={newPhotoURL} src={newPhotoURL} className="object-cover" />
                      <AvatarFallback className="bg-primary/5 text-primary">
                        <UserIcon className="w-10 h-10" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-7 h-7 text-white" />
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={photoInputRef}
                      onChange={handlePhotoUpload}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest font-headline text-primary/60 ml-1 font-bold">
                      Display Name
                    </Label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="bg-card border-primary/5 rounded-2xl h-12 px-5 text-sm"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-[1.8rem] border border-primary/5">
                      <div className="flex items-center gap-3">
                        <Bell className="w-5 h-5 text-primary" />
                        <span className="text-sm font-semibold">Push Notifications</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {notificationsEnabled && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-primary hover:bg-primary/10"
                            onClick={sendTestNotification}
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        )}
                        <Switch
                          checked={notificationsEnabled}
                          onCheckedChange={toggleNotifications}
                          className="data-[state=checked]:bg-primary"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-[1.8rem] border border-primary/5">
                      <div className="flex items-center gap-3">
                        {isDarkMode ? (
                          <Moon className="w-5 h-5 text-primary" />
                        ) : (
                          <Sun className="w-5 h-5 text-orange-500" />
                        )}
                        <span className="text-sm font-semibold">Dark Mode</span>
                      </div>
                      <Switch
                        checked={isDarkMode}
                        onCheckedChange={toggleTheme}
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex flex-col gap-3 mt-6">
                <Button
                  onClick={handleUpdateProfile}
                  disabled={isSaving}
                  className="w-full h-12 rounded-2xl font-headline text-sm shadow-lg shadow-primary/20"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="w-full h-10 rounded-2xl text-muted-foreground hover:text-destructive gap-2 text-xs font-headline uppercase tracking-widest"
                >
                  <LogOut className="w-4 h-4" /> Log out
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Countdown detail dialog */}
      {nextCountdown && (
        <Dialog open={isCountdownOpen} onOpenChange={setIsCountdownOpen}>
          <DialogContent className="w-[90vw] max-w-sm rounded-[2.5rem] border-primary/5 p-8">
            <DialogHeader>
              <DialogTitle className="font-headline text-xl text-left flex items-center gap-2">
                <CalendarHeart className="w-5 h-5 text-primary" />
                Upcoming Dates
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {keyDates
                ?.map((kd: any) => {
                  const result = computeNextOccurrence(kd.date, kd.recurring !== false);
                  if (!result) return null;
                  return { ...result, label: kd.label };
                })
                .filter(Boolean)
                .sort((a: any, b: any) => a.days - b.days)
                .map((kd: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/10"
                  >
                    <div>
                      <p className="font-headline text-sm font-bold">{kd.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{kd.label2}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-headline text-lg font-bold text-primary">{kd.days}d</p>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-widest">to go</p>
                    </div>
                  </div>
                ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </header>
  );
}
