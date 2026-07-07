
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signInAnonymously, updateProfile } from "firebase/auth";
import { useAuth, useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Lock, Heart, AlertCircle, ExternalLink, Delete } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const [pin, setPin] = useState<string[]>(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [shakeError, setShakeError] = useState(false);
  const router = useRouter();
  const auth = useAuth();
  const { user } = useUser();
  const { toast } = useToast();
  const pinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    // If already logged in with a stored role, skip login
    if (user?.displayName && localStorage.getItem("duonexus_role")) {
      router.push("/chat");
    }
  }, [user, router]);

  // Desktop keyboard support via window listener (mobile uses custom numpad only)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) handleNumpadPress(e.key);
      else if (e.key === "Backspace") handleBackspace();
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [pin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Focus first PIN slot container visually (not the input) on mount
    setTimeout(() => {
      pinRefs[0].current?.blur(); // keep keyboard closed
    }, 150);
  }, []);

  const fullPin = pin.join("");

  const handleDigit = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    if (value && index < 3) {
      pinRefs[index + 1].current?.focus();
    }
    if (newPin.every((d) => d !== "")) {
      // Auto-submit when all 4 digits are entered
      handleVerify(newPin.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const newPin = [...pin];
      newPin[index] = "";
      setPin(newPin);
      if (index > 0) {
        pinRefs[index - 1].current?.focus();
      }
    }
  };

  const handleNumpadPress = (digit: string) => {
    const firstEmpty = pin.findIndex((d) => d === "");
    if (firstEmpty === -1) return;
    const newPin = [...pin];
    newPin[firstEmpty] = digit;
    setPin(newPin);
    if (firstEmpty < 3) pinRefs[firstEmpty + 1].current?.focus();
    if (newPin.every((d) => d !== "")) {
      handleVerify(newPin.join(""));
    }
  };

  const handleBackspace = () => {
    const lastFilled = [...pin].reverse().findIndex((d) => d !== "");
    if (lastFilled === -1) return;
    const realIndex = 3 - lastFilled;
    const newPin = [...pin];
    newPin[realIndex] = "";
    setPin(newPin);
    pinRefs[realIndex].current?.focus();
  };

  const triggerShake = () => {
    setShakeError(true);
    setPin(["", "", "", ""]);
    setTimeout(() => {
      setShakeError(false);
      pinRefs[0].current?.focus();
    }, 600);
  };

  const handleVerify = async (pinStr: string) => {
    if (loading) return;
    setLoading(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinStr }),
      });

      if (!res.ok) {
        throw new Error("Local server setup required: Please restart your terminal dev server (stop 'npm run dev' and run it again) so Next.js can register the new env variables and API route files.");
      }

      const data = await res.json();

      if (!data.valid) {
        triggerShake();
        toast({
          variant: "destructive",
          title: "Incorrect PIN",
          description: "This space is strictly private.",
        });
        setLoading(false);
        return;
      }

      // Identity is resolved by PIN — no picker screen needed
      const identity: string = data.identity || "nabin";
      const displayName = identity === "nabin" ? "Nabin" : "Karu";

      const userCredential = await signInAnonymously(auth);
      await updateProfile(userCredential.user, { displayName });
      localStorage.setItem("duonexus_role", identity);
      router.push("/chat");
    } catch (error: any) {
      console.error("Auth Error Details:", error);
      if (
        error.code === "auth/admin-restricted-operation" ||
        error.message?.includes("admin-restricted-operation")
      ) {
        setAuthError(
          "Anonymous sign-in is disabled. Please go to your Firebase Console > Authentication > Sign-in method and enable 'Anonymous'."
        );
      } else {
        setAuthError(error.message || "An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  const NUMPAD = [["1","2","3"],["4","5","6"],["7","8","9"],["","0","⌫"]];

  return (
    <div
      className="flex flex-col items-center justify-center h-full w-full text-white px-6"
      style={{ background: '#000', minHeight: '100dvh' }}
    >
      <div className="w-full max-w-xs space-y-8 animate-in fade-in zoom-in duration-500">
        {/* Logo */}
        <div className="flex flex-col items-center text-center space-y-2" style={{ color: 'white' }}>
          <div className="relative p-5 bg-primary/10 rounded-full mb-2">
            <Heart className="w-14 h-14 text-primary fill-primary animate-pulse" />
            <div className="absolute inset-0 rounded-full bg-primary/5 animate-ping" />
          </div>
          <h1 className="text-3xl font-headline text-foreground tracking-tighter">
            DuoNexus
          </h1>
          <p className="text-primary font-headline uppercase tracking-[0.15em] text-[11px] font-bold">
            Nabin ❤️ Karu
          </p>
          <p className="text-muted-foreground text-sm">Our private little corner.</p>
        </div>

        {/* Firebase error */}
        {authError && (
          <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 border-primary/50 bg-primary/5">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-headline text-xs uppercase tracking-widest">
              Action Required
            </AlertTitle>
            <AlertDescription className="text-xs mt-2 leading-relaxed">
              {authError}
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] gap-1"
                  onClick={() =>
                    window.open(
                      "https://console.firebase.google.com/u/0/project/our-sweet-conversation/authentication/providers",
                      "_blank"
                    )
                  }
                >
                  <ExternalLink className="w-3 h-3" /> Go to Console
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* PIN dots */}
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary/40" />
            <span className="text-[10px] font-headline uppercase tracking-[0.3em] text-muted-foreground">
              Enter your PIN
            </span>
          </div>

          <div
            className={cn(
              "flex gap-4 transition-all",
              shakeError && "animate-[shake_0.4s_ease-in-out]"
            )}
          >
            {pin.map((digit, i) => (
              <div
                key={i}
                className={cn(
                  "w-14 h-14 rounded-2xl border-2 flex items-center justify-center transition-all relative",
                  digit
                    ? "bg-primary border-primary shadow-lg shadow-primary/30"
                    : "bg-muted/30 border-primary/10"
                )}
              >
                {digit && (
                  <div className="w-3 h-3 bg-white rounded-full pointer-events-none" />
                )}
              </div>
            ))}
          </div>

          {/* Custom numpad */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">
            {NUMPAD.map((row, ri) =>
              row.map((key, ci) => (
                <button
                  key={`${ri}-${ci}`}
                  onClick={() => {
                    if (key === "⌫") handleBackspace();
                    else if (key !== "") handleNumpadPress(key);
                  }}
                  disabled={loading || key === ""}
                  className={cn(
                    "h-14 rounded-2xl font-headline text-xl font-bold transition-all active:scale-90",
                    key === ""
                      ? "invisible"
                      : key === "⌫"
                      ? "bg-muted/30 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      : "bg-muted/40 hover:bg-primary/10 hover:text-primary"
                  )}
                >
                  {key === "⌫" ? <Delete className="w-5 h-5 mx-auto" /> : key}
                </button>
              ))
            )}
          </div>

          {loading && (
            <div className="flex items-center gap-2 animate-fade-in">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] text-white uppercase tracking-widest animate-pulse">
                Opening the door...
              </p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}
