
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/firebase";
import { Heart } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useUser();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.push("/chat");
      } else {
        router.push("/login");
      }
    }
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
