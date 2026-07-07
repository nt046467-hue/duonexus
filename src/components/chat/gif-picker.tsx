
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Smile, ImagePlay } from "lucide-react";
import { cn } from "@/lib/utils";

const EMOJI_CATEGORIES = [
  {
    label: "❤️ Love & Romance",
    emojis: [
      "❤️", "💖", "💝", "💕", "💞", "💓", "💗", "💘", "💌", "💋", 
      "🫶", "🫰", "💏", "💑", "👩‍❤️‍💋‍👨", "👨‍❤️‍💋‍👨", "👩‍❤️‍💋‍👩", "👩‍❤️‍👨", "👨‍❤️‍👨", "👩‍❤️‍👩",
      "❤️‍🔥", "❤️‍🩹", "❣️", "💟", "💔", "🧡", "💛", "💚", "💙", "💜", 
      "🖤", "🤍", "🤎", "🤟", "💋", "👄", "🌹", "💐", "🌷", "🌸", 
      "🌺", "💮", "🏵️", "🌻", "🌼", "🧸", "🥂", "🎈", "💍"
    ],
  },
  {
    label: "😀 Faces & Emotions",
    emojis: [
      "😂", "🥺", "😭", "🥹", "😊", "🤗", "😎", "😻", "😏", "🤩", 
      "🥳", "😜", "🤭", "😇", "🫠", "😴", "🤔", "🫡", "😤", "😈", 
      "🤤", "😋", "🥴", "😍", "🥰", "😘", "😚", "😙", "😗", "🥲"
    ],
  },
  {
    label: "✨ Vibes & Sparkles",
    emojis: [
      "✨", "🔥", "💫", "⭐", "🌙", "☀️", "🌈", "❄️", "⚡", "🌊", 
      "🍀", "🦋", "🌌", "🪄", "🎇", "🎆", "🫧", "💎", "🏆", "🎯"
    ],
  },
  {
    label: "🎉 Fun & Hobbies",
    emojis: [
      "🎉", "🎈", "🎁", "🎀", "🧸", "🪅", "🎊", "🎭", "🎬", "🎮", 
      "🕹️", "🎲", "🃏", "🎵", "🎶", "🎸", "🎹", "🎧", "📸", "🚀"
    ],
  },
  {
    label: "🐾 Cute Animals",
    emojis: [
      "🐱", "🐶", "🐰", "🦄", "🐼", "🐨", "🦊", "🐺", "🦁", "🐯", 
      "🐻", "🐮", "🐷", "🐸", "🐧", "🦋", "🐝", "🦄", "🐾", "🐠"
    ],
  },
  {
    label: "🍕 Food & Drinks",
    emojis: [
      "🍕", "🍓", "🍒", "🍑", "🍇", "🍎", "🥑", "🧁", "🍩", "🍪", 
      "🍭", "🍦", "🍰", "🎂", "🍫", "☕", "🍵", "🍷", "🥂", "🍹"
    ],
  },
];




const KLIPY_KEY = process.env.NEXT_PUBLIC_KLIPY_API_KEY || "";
const KLIPY_BASE = "https://api.klipy.com/api/v1";

interface GifResult {
  id: string;
  /** Animated GIF URL */
  url: string;
  /** Smaller preview still or thumbnail */
  preview: string;
  width: number;
  height: number;
}

const FALLBACK_GIFS: GifResult[] = [
  {
    id: "couple1",
    url: "https://media.giphy.com/media/l4pTdcifPzcEtCCg8/giphy.gif",
    preview: "https://media.giphy.com/media/l4pTdcifPzcEtCCg8/giphy.gif",
    width: 200,
    height: 150,
  },
  {
    id: "couple2",
    url: "https://media.giphy.com/media/143v0b4767W1Yk/giphy.gif",
    preview: "https://media.giphy.com/media/143v0b4767W1Yk/giphy.gif",
    width: 200,
    height: 150,
  },
  {
    id: "couple3",
    url: "https://media.giphy.com/media/3CCXHZWV6F6O9VQ7FL/giphy.gif",
    preview: "https://media.giphy.com/media/3CCXHZWV6F6O9VQ7FL/giphy.gif",
    width: 200,
    height: 150,
  },
  {
    id: "couple4",
    url: "https://media.giphy.com/media/5Govl6TJAX6FhIq577/giphy.gif",
    preview: "https://media.giphy.com/media/5Govl6TJAX6FhIq577/giphy.gif",
    width: 200,
    height: 150,
  },
  {
    id: "couple5",
    url: "https://media.giphy.com/media/l2YSgsunrP27Y47M4/giphy.gif",
    preview: "https://media.giphy.com/media/l2YSgsunrP27Y47M4/giphy.gif",
    width: 200,
    height: 150,
  },
  {
    id: "couple6",
    url: "https://media.giphy.com/media/k93vubaq1hgAM/giphy.gif",
    preview: "https://media.giphy.com/media/k93vubaq1hgAM/giphy.gif",
    width: 200,
    height: 150,
  },
];

function parseKlipy(data: any): GifResult[] {
  const items = data?.data?.data || [];
  return items.map((item: any) => {
    const file = item?.file || {};
    const md = file.md || file.hd || {};
    const gifUrl = md.gif?.url || item.url || "";
    const previewUrl = file.sd?.gif?.url || md.gif?.url || "";
    const width = md.gif?.width || 200;
    const height = md.gif?.height || 150;
    return {
      id: String(item.id || item.slug || Math.random()),
      url: gifUrl,
      preview: previewUrl,
      width,
      height
    };
  }).filter((g: GifResult) => g.url);
}

interface GifPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onGifSelect: (gifUrl: string) => void;
}

export function GifPicker({ onEmojiSelect, onGifSelect }: GifPickerProps) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchGifs = useCallback(async (searchQuery: string) => {
    if (!KLIPY_KEY) {
      setGifs(FALLBACK_GIFS);
      setError(null);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsLoading(true);
    setError(null);
    try {
      const endpoint = searchQuery.trim()
        ? `${KLIPY_BASE}/${KLIPY_KEY}/gifs/search?q=${encodeURIComponent(searchQuery)}&limit=24`
        : `${KLIPY_BASE}/${KLIPY_KEY}/gifs/trending?limit=24`;
      const res = await fetch(endpoint, { signal: abortRef.current.signal });
      if (!res.ok) throw new Error(`Klipy ${res.status}`);
      const data = await res.json();
      setGifs(parseKlipy(data));
    } catch (e: any) {
      if (e.name !== "AbortError") setError("Could not load GIFs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load trending on mount
  useEffect(() => {
    fetchGifs("");
  }, [fetchGifs]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => fetchGifs(query), 400);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query, fetchGifs]);

  return (
    <Tabs defaultValue="emoji" className="w-full">
      <TabsList className="grid grid-cols-2 rounded-full bg-muted/50 p-1 h-8 mb-2">
        <TabsTrigger
          value="emoji"
          className="rounded-full text-[10px] uppercase font-headline tracking-widest py-1 gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          <Smile className="w-3 h-3" /> Emoji
        </TabsTrigger>
        <TabsTrigger
          value="gif"
          className="rounded-full text-[10px] uppercase font-headline tracking-widest py-1 gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          <ImagePlay className="w-3 h-3" /> GIF
        </TabsTrigger>
      </TabsList>

      {/* Emoji tab — categorized like a real messenger */}
      <TabsContent value="emoji" className="mt-0">
        <div className="max-h-56 overflow-y-auto scrollbar-hide px-1 space-y-3">
          {EMOJI_CATEGORIES.map((cat) => (
            <div key={cat.label}>
              {/* Category header */}
              <p className="text-[9px] font-headline uppercase tracking-widest text-muted-foreground/60 px-1 pb-1 pt-0.5 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                {cat.label}
              </p>
              <div className="grid grid-cols-6 gap-0.5">
                {cat.emojis.map((emoji, i) => (
                  <button
                    key={`${cat.label}-${i}`}
                    onClick={() => onEmojiSelect(emoji)}
                    className="text-2xl hover:bg-primary/10 rounded-xl p-1.5 transition-all active:scale-75 leading-none"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </TabsContent>


      {/* GIF tab */}
      <TabsContent value="gif" className="mt-0 flex flex-col gap-2">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={KLIPY_KEY ? "Search GIFs..." : "Search requires Klipy API key..."}
            disabled={!KLIPY_KEY}
            className="pl-8 h-8 text-xs rounded-full bg-muted/40 border-primary/10 focus:border-primary/30"
          />
        </div>


        {/* Grid */}
        <div className="h-44 overflow-y-auto scrollbar-hide">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          )}
          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          )}
          {!isLoading && !error && gifs.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-muted-foreground">No GIFs found</p>
            </div>
          )}
          {!isLoading && !error && gifs.length > 0 && (
            <div className="columns-2 gap-1.5 space-y-1.5">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  onClick={() => onGifSelect(gif.url)}
                  className="w-full overflow-hidden rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 hover:opacity-90 active:scale-95 transition-all block"
                >
                  <img
                    src={gif.preview || gif.url}
                    alt="GIF"
                    className="w-full h-auto block bg-muted/30"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Attribution / Key notice */}
        {KLIPY_KEY ? (
          <p className="text-[9px] text-muted-foreground/40 text-center font-headline uppercase tracking-widest">
            Powered by Klipy
          </p>
        ) : (
          <p className="text-[9px] text-muted-foreground/60 text-center font-headline bg-primary/5 p-2 rounded-xl border border-primary/5">
            Displaying default couple GIFs. To search other GIFs, add your free Klipy API Key to .env.local (No card required!).
          </p>
        )}
      </TabsContent>
    </Tabs>

  );
}
