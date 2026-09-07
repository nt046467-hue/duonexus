
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/firebase";
import { Heart } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useUser();

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let fallbackId: NodeJS.Timeout | null = null;

    const navigateTo = (path: string) => {
      try {
        router.push(path);
      } catch {
        window.location.replace(path);
      }
      // Backup navigation if Next.js router hangs on mobile Chrome
      fallbackId = setTimeout(() => {
        if (typeof window !== "undefined" && window.location.pathname === "/") {
          window.location.replace(path);
        }
      }, 700);
    };

    // If user already logged in with stored role, redirect immediately to /chat
    if (typeof window !== "undefined" && localStorage.getItem("duonexus_role")) {
      navigateTo("/chat");
      return () => {
        if (fallbackId) clearTimeout(fallbackId);
      };
    }

    if (!isLoading) {
      if (user) {
        navigateTo("/chat");
      } else {
        navigateTo("/login");
      }
    } else {
      // Safety timeout for mobile Chrome: if auth state doesn't resolve in 1.4s, proceed to login
      timeoutId = setTimeout(() => {
        const storedRole = typeof window !== "undefined" ? localStorage.getItem("duonexus_role") : null;
        navigateTo(storedRole ? "/chat" : "/login");
      }, 1400);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (fallbackId) clearTimeout(fallbackId);
    };
  }, [user, isLoading, router]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background gap-6 transition-colors duration-300">
      <div className="relative flex items-center justify-center">
        <div className="w-20 h-20 border-[3px] border-primary/10 border-t-primary rounded-full animate-spin" />
        <Heart className="absolute w-6 h-6 text-primary fill-primary animate-pulse" />
      </div>
      <div className="text-primary font-headline uppercase tracking-[0.3em] text-[11px] font-bold">Connecting DuoNexus...</div>
    </div>
  );
}
