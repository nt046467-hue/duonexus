
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInAnonymously, updateProfile } from "firebase/auth";
import { useAuth, useUser } from "@/firebase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Heart, User as UserIcon, AlertCircle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [isPinCorrect, setIsPinCorrect] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();
  const auth = useAuth();
  const { user } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    if (user?.displayName && localStorage.getItem('duonexus_role')) {
      router.push("/chat");
    }
  }, [user, router]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Updated PIN to 1432
    if (pin === "1432") {
      setIsPinCorrect(true);
      setAuthError(null);
    } else {
      toast({
        variant: "destructive",
        title: "Incorrect PIN",
        description: "This space is strictly private.",
      });
      setPin("");
    }
  };

  const handleIdentitySelect = async (name: string) => {
    if (!auth) return;
    setLoading(true);
    setAuthError(null);
    try {
      const userCredential = await signInAnonymously(auth);
      await updateProfile(userCredential.user, {
        displayName: name
      });
      // Store the role permanently in this browser
      localStorage.setItem('duonexus_role', name.toLowerCase());
      router.push("/chat");
    } catch (error: any) {
      console.error("Auth Error Details:", error);
      if (error.code === 'auth/admin-restricted-operation' || error.message?.includes('admin-restricted-operation')) {
        setAuthError("Anonymous sign-in is disabled. Please go to your Firebase Console > Authentication > Sign-in method and enable 'Anonymous'.");
      } else {
        setAuthError(error.message || "An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-background px-6">
      <div className="w-full max-w-sm space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="p-4 bg-primary/10 rounded-full mb-4">
            <Heart className="w-12 h-12 text-primary fill-primary animate-pulse" />
          </div>
          <h1 className="text-3xl font-headline text-foreground tracking-tighter">DuoNexus</h1>
          <p className="text-muted-foreground">Our private little corner.</p>
        </div>

        {authError && (
          <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 border-primary/50 bg-primary/5">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-headline text-xs uppercase tracking-widest">Action Required</AlertTitle>
            <AlertDescription className="text-xs mt-2 leading-relaxed">
              {authError}
              <div className="mt-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-[10px] gap-1"
                  onClick={() => window.open('https://console.firebase.google.com/u/0/project/our-sweet-conversation/authentication/providers', '_blank')}
                >
                  <ExternalLink className="w-3 h-3" /> Go to Console
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {!isPinCorrect ? (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="relative group">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                type="password"
                placeholder="Enter PIN"
                className="pl-10 h-12 text-center text-xl tracking-[1em] bg-card border-border focus:ring-primary"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoFocus
              />
            </div>
            <Button 
              type="submit"
              className="w-full h-12 text-lg font-headline transition-all active:scale-95" 
              disabled={pin.length < 4}
            >
              Unlock
            </Button>
          </form>
        ) : (
          <div className="space-y-4 animate-in slide-in-from-bottom-4">
            <p className="text-center text-sm font-medium mb-4">Who's entering today?</p>
            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="h-24 flex flex-col gap-2 hover:border-primary hover:bg-primary/5 transition-all group"
                onClick={() => handleIdentitySelect("Nabin")}
                disabled={loading}
              >
                <div className="p-2 bg-primary/10 rounded-full group-hover:scale-110 transition-transform">
                  <UserIcon className="w-6 h-6 text-primary" />
                </div>
                Nabin
              </Button>
              <Button 
                variant="outline" 
                className="h-24 flex flex-col gap-2 hover:border-secondary hover:bg-secondary/5 transition-all group"
                onClick={() => handleIdentitySelect("Karu")}
                disabled={loading}
              >
                <div className="p-2 bg-secondary/10 rounded-full group-hover:scale-110 transition-transform">
                  <UserIcon className="w-6 h-6 text-secondary" />
                </div>
                Karu
              </Button>
            </div>
            {loading && (
              <div className="flex flex-col items-center gap-2 mt-4">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] text-primary uppercase tracking-widest animate-pulse">Opening the door...</p>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-[10px] text-muted-foreground pt-12 uppercase tracking-widest opacity-50">
          Nabin ❤️ Karu
        </p>
      </div>
    </div>
  );
}
