"use client";

import React, { useState, useEffect } from "react";
import {
  Home,
  MessageCircle,
  CalendarHeart,
  LayoutGrid,
  Settings,
  Sun,
  Moon,
  Heart,
} from "lucide-react";
import { SparklesSvg } from "@/components/ui/sparkles-svg";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface DesktopNavRailProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onOpenSettings: () => void;
  onOpenOwnProfile: () => void;
  onGenerateSpark: () => void;
  isGeneratingSpark: boolean;
  myAvatar: string;
  myName: string;
  unreadCount?: number;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

export function DesktopNavRail({
  activeTab,
  onSelectTab,
  onOpenSettings,
  onOpenOwnProfile,
  onGenerateSpark,
  isGeneratingSpark,
  myAvatar,
  myName,
  unreadCount = 0,
  isDark: externalIsDark,
  onToggleTheme,
}: DesktopNavRailProps) {
  const [internalIsDark, setInternalIsDark] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedTheme = localStorage.getItem("theme");
      const hasDark = document.documentElement.classList.contains("dark");
      setInternalIsDark(storedTheme ? storedTheme === "dark" : hasDark);
    }
  }, []);

  const currentIsDark = externalIsDark !== undefined ? externalIsDark : internalIsDark;

  const handleToggleTheme = () => {
    if (onToggleTheme) {
      onToggleTheme();
      return;
    }
    const nextDark = !internalIsDark;
    setInternalIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const navItems = [
    {
      id: "home",
      label: "Home",
      icon: Home,
      onClick: () => onSelectTab("home"),
    },
    {
      id: "chat",
      label: "Messages",
      icon: MessageCircle,
      badge: unreadCount > 0 ? (unreadCount > 9 ? "9+" : unreadCount) : null,
      onClick: () => onSelectTab("chat"),
    },
    {
      id: "memories",
      label: "Memories & Milestones",
      icon: CalendarHeart,
      onClick: () => onSelectTab("memories"),
    },
    {
      id: "tools",
      label: "Calling & Tools",
      icon: LayoutGrid,
      onClick: () => onSelectTab("tools"),
    },
    {
      id: "sparks",
      label: "AI Love Sparks",
      icon: SparklesSvg,
      onClick: onGenerateSpark,
      loading: isGeneratingSpark,
    },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <aside className="w-[72px] h-full flex flex-col items-center justify-between py-4 bg-background/95 backdrop-blur-xl border-r border-primary/10 select-none shrink-0 z-30">
        {/* Top: DuoNexus Logo */}
        <div className="flex flex-col items-center gap-6 w-full">
          <div className="relative group cursor-pointer" onClick={() => onSelectTab("chat")}>
            <div className="w-11 h-11 rounded-2xl overflow-hidden shadow-sm hover:scale-105 active:scale-95 transition-all">
              <img
                src="/favicon.png"
                alt="DuoNexus"
                className="w-full h-full object-cover select-none"
              />
            </div>
            <span className="sr-only">DuoNexus</span>
          </div>

          {/* Navigation Items */}
          <nav className="flex flex-col items-center gap-2 w-full px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={item.onClick}
                      className={cn(
                        "relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 group",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-100"
                          : "text-muted-foreground hover:text-foreground hover:bg-primary/10 hover:scale-105"
                      )}
                      aria-label={item.label}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
                        <div className="absolute -left-2 w-1 h-6 bg-primary rounded-r-full" />
                      )}

                      <Icon className={cn("w-5 h-5", item.loading && "animate-spin")} />

                      {/* Badge */}
                      {item.badge && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-headline font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 border-2 border-background">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-headline text-xs font-semibold">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>
        </div>

        {/* Bottom: Settings, Theme Toggle, Profile Avatar */}
        <div className="flex flex-col items-center gap-2.5 w-full px-2">
          {/* Settings */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onOpenSettings}
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-primary/10 hover:scale-105 transition-all"
                aria-label="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-headline text-xs">
              Settings & Customization
            </TooltipContent>
          </Tooltip>

          {/* Theme Toggle (Sun / Moon) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleToggleTheme}
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 hover:scale-105 transition-all"
                aria-label="Toggle dark mode"
              >
                {currentIsDark ? (
                  <Sun className="w-5 h-5 text-amber-400 hover:rotate-45 transition-transform" />
                ) : (
                  <Moon className="w-5 h-5 text-indigo-500 hover:-rotate-12 transition-transform" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-headline text-xs">
              {currentIsDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
            </TooltipContent>
          </Tooltip>

          <div className="w-8 h-px bg-primary/10 my-1" />

          {/* My Profile Avatar */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onOpenOwnProfile}
                className="relative rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40 hover:scale-105 active:scale-95 transition-transform"
                aria-label={`View profile (${myName})`}
              >
                <Avatar className="h-10 w-10 border-2 border-primary/20 shadow-sm bg-black">
                  <AvatarImage src={myAvatar} className="rounded-full object-cover bg-black" />
                  <AvatarFallback className="bg-primary/10 text-primary font-headline text-xs font-bold">
                    {myName?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-headline text-xs font-semibold">
              {myName} (You)
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
