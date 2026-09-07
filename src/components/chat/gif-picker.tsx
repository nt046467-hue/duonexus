"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Smile, ImagePlay, Heart, Sticker } from "lucide-react";
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
    label: "🔥 Vibes & Energy",
    emojis: [
      "🔥", "💫", "⭐", "🌙", "☀️", "🌈", "❄️", "⚡", "🌊", "💖", 
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

const NOTO_STICKERS = [
  { name: "Love", code: "1f970" },
  { name: "Kiss", code: "1f618" },
  { name: "Red Heart", code: "2764" },
  { name: "Heart Eyes", code: "1f60d" },
  { name: "Pink Hearts", code: "1f495" },
  { name: "Sparkling Heart", code: "1f496" },
  { name: "Heart Ribbon", code: "1f49d" },
  { name: "Rose", code: "1f339" },
  { name: "Bouquet", code: "1f490" },
  { name: "Ring", code: "1f48d" },
  { name: "Kiss Mark", code: "1f48b" },
  { name: "Hug", code: "1f917" },
  { name: "Pleading", code: "1f97a" },
  { name: "Party", code: "1f973" },
  { name: "Tears of Joy", code: "1f602" },
  { name: "Warm Smile", code: "1f60a" },
  { name: "Cool", code: "1f60e" },
  { name: "Star Eyes", code: "1f929" },
  { name: "Fire", code: "1f525" },
  { name: "100", code: "1f4af" },
  { name: "Namaste", code: "1f64f" },
  { name: "Thumbs Up", code: "1f44d" },
  { name: "Wave", code: "1f44b" },
  { name: "I Love You", code: "1f91f" },
  { name: "Butterfly", code: "1f98b" },
  { name: "Cute Cat", code: "1f431" },
  { name: "Cute Puppy", code: "1f436" },
  { name: "Panda", code: "1f43c" },
  { name: "Party Popper", code: "1f389" },
  { name: "Gift Box", code: "1f381" },
  { name: "Cheers", code: "1f37e" },
  { name: "Sunflower", code: "1f33b" },
  { name: "Rainbow", code: "1f308" },
  { name: "Shooting Star", code: "1f31f" },
  { name: "Cute Bunny", code: "1f430" },
  { name: "Teddy", code: "1f9f8" },
];

const KLIPY_KEY = process.env.NEXT_PUBLIC_KLIPY_API_KEY || "";
const KLIPY_BASE = "https://api.klipy.com/api/v1";

interface MediaItem {
  id: string;
  url: string;
  preview: string;
  width?: number;
  height?: number;
  isSticker?: boolean;
}

const FALLBACK_GIFS: MediaItem[] = [
  {
    id: "couple1",
    url: "https://media.giphy.com/media/l4pTdcifPzcEtCCg8/giphy.gif",
    preview: "https://media.giphy.com/media/l4pTdcifPzcEtCCg8/giphy.gif",
  },
  {
    id: "couple2",
    url: "https://media.giphy.com/media/143v0b4767W1Yk/giphy.gif",
    preview: "https://media.giphy.com/media/143v0b4767W1Yk/giphy.gif",
  },
  {
    id: "couple3",
    url: "https://media.giphy.com/media/3CCXHZWV6F6O9VQ7FL/giphy.gif",
    preview: "https://media.giphy.com/media/3CCXHZWV6F6O9VQ7FL/giphy.gif",
  },
  {
    id: "couple4",
    url: "https://media.giphy.com/media/5Govl6TJAX6FhIq577/giphy.gif",
    preview: "https://media.giphy.com/media/5Govl6TJAX6FhIq577/giphy.gif",
  },
  {
    id: "couple5",
    url: "https://media.giphy.com/media/l2YSgsunrP27Y47M4/giphy.gif",
    preview: "https://media.giphy.com/media/l2YSgsunrP27Y47M4/giphy.gif",
  },
  {
    id: "couple6",
    url: "https://media.giphy.com/media/k93vubaq1hgAM/giphy.gif",
    preview: "https://media.giphy.com/media/k93vubaq1hgAM/giphy.gif",
  },
];

function parseKlipyMedia(data: any): MediaItem[] {
  const items = data?.data?.data || [];
  return items.map((item: any) => {
    const file = item?.file || {};
    const md = file.md || file.hd || {};
    const gifUrl = md.gif?.url || item.url || "";
    const previewUrl = file.sd?.gif?.url || md.gif?.url || "";
    return {
      id: String(item.id || item.slug || Math.random()),
      url: gifUrl,
      preview: previewUrl,
    };
  }).filter((g: MediaItem) => g.url);
}

interface GifPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onGifSelect: (gifUrl: string) => void;
  onStickerSelect?: (stickerUrl: string) => void;
}

export function GifPicker({ onEmojiSelect, onGifSelect, onStickerSelect }: GifPickerProps) {
  const [gifQuery, setGifQuery] = useState("");
  const [stickerQuery, setStickerQuery] = useState("");
  const [gifs, setGifs] = useState<MediaItem[]>([]);
  const [apiStickers, setApiStickers] = useState<MediaItem[]>([]);
  const [isGifLoading, setIsGifLoading] = useState(false);
  const [isStickerLoading, setIsStickerLoading] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);

  const gifTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stickerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gifAbortRef = useRef<AbortController | null>(null);
  const stickerAbortRef = useRef<AbortController | null>(null);

  // Fetch GIFs
  const fetchGifs = useCallback(async (searchQuery: string) => {
    if (!KLIPY_KEY) {
      setGifs(FALLBACK_GIFS);
      setGifError(null);
      return;
    }

    gifAbortRef.current?.abort();
    gifAbortRef.current = new AbortController();
    setIsGifLoading(true);
    setGifError(null);
    try {
      const endpoint = searchQuery.trim()
        ? `${KLIPY_BASE}/${KLIPY_KEY}/gifs/search?q=${encodeURIComponent(searchQuery)}&limit=24`
        : `${KLIPY_BASE}/${KLIPY_KEY}/gifs/trending?limit=24`;
      const res = await fetch(endpoint, { signal: gifAbortRef.current.signal });
      if (!res.ok) throw new Error(`Klipy ${res.status}`);
      const data = await res.json();
      setGifs(parseKlipyMedia(data));
    } catch (e: any) {
      if (e.name !== "AbortError") setGifError("Could not load GIFs");
    } finally {
      setIsGifLoading(false);
    }
  }, []);

  // Fetch API Stickers if key exists
  const fetchApiStickers = useCallback(async (searchQuery: string) => {
    if (!KLIPY_KEY) return;
    stickerAbortRef.current?.abort();
    stickerAbortRef.current = new AbortController();
    setIsStickerLoading(true);
    try {
      const endpoint = searchQuery.trim()
        ? `${KLIPY_BASE}/${KLIPY_KEY}/stickers/search?q=${encodeURIComponent(searchQuery)}&limit=24`
        : `${KLIPY_BASE}/${KLIPY_KEY}/stickers/trending?limit=24`;
      const res = await fetch(endpoint, { signal: stickerAbortRef.current.signal });
      if (!res.ok) return;
      const data = await res.json();
      setApiStickers(parseKlipyMedia(data));
    } catch {
      // Fallback seamlessly to curated stickers
    } finally {
      setIsStickerLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGifs("");
    fetchApiStickers("");
  }, [fetchGifs, fetchApiStickers]);

  useEffect(() => {
    if (gifTimeoutRef.current) clearTimeout(gifTimeoutRef.current);
    gifTimeoutRef.current = setTimeout(() => fetchGifs(gifQuery), 400);
    return () => {
      if (gifTimeoutRef.current) clearTimeout(gifTimeoutRef.current);
    };
  }, [gifQuery, fetchGifs]);

  useEffect(() => {
    if (stickerTimeoutRef.current) clearTimeout(stickerTimeoutRef.current);
    stickerTimeoutRef.current = setTimeout(() => fetchApiStickers(stickerQuery), 400);
    return () => {
      if (stickerTimeoutRef.current) clearTimeout(stickerTimeoutRef.current);
    };
  }, [stickerQuery, fetchApiStickers]);

  const filteredNotoStickers = NOTO_STICKERS.filter((s) =>
    stickerQuery.trim() ? s.name.toLowerCase().includes(stickerQuery.toLowerCase()) : true
  );

  const handleSelectSticker = (url: string) => {
    if (onStickerSelect) {
      onStickerSelect(url);
    } else {
      onGifSelect(url);
    }
  };

  return (
    <Tabs defaultValue="stickers" className="w-full">
      <TabsList className="grid grid-cols-3 rounded-full bg-muted/50 p-1 h-8 mb-2">
        <TabsTrigger
          value="stickers"
          className="rounded-full text-[10px] uppercase font-headline tracking-widest py-1 gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          <Sticker className="w-3 h-3" /> Stickers
        </TabsTrigger>
        <TabsTrigger
          value="emoji"
          className="rounded-full text-[10px] uppercase font-headline tracking-widest py-1 gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          <Smile className="w-3 h-3" /> Emoji
        </TabsTrigger>
        <TabsTrigger
          value="gif"
          className="rounded-full text-[10px] uppercase font-headline tracking-widest py-1 gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          <ImagePlay className="w-3 h-3" /> GIF
        </TabsTrigger>
      </TabsList>

      {/* Stickers Tab */}
      <TabsContent value="stickers" className="mt-0 flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
          <Input
            value={stickerQuery}
            onChange={(e) => setStickerQuery(e.target.value)}
            placeholder="Search animated stickers..."
            className="pl-8 h-8 text-xs rounded-full bg-muted/40 border-primary/10 focus:border-primary/30"
          />
        </div>

        <div className="h-56 overflow-y-auto scrollbar-hide space-y-3 px-0.5">
          {/* Curated Transparent Animated Stickers (Noto 512 GIF) */}
          <div>
            <p className="text-[9px] font-headline uppercase tracking-widest text-muted-foreground/60 px-1 pb-1 pt-0.5 sticky top-0 bg-card/95 backdrop-blur-sm z-10">
              Animated Stickers
            </p>
            <div className="grid grid-cols-4 gap-2">
              {filteredNotoStickers.map((s) => {
                const url = `https://fonts.gstatic.com/s/e/notoemoji/latest/${s.code}/512.gif`;
                return (
                  <button
                    key={s.code}
                    onClick={() => handleSelectSticker(url)}
                    className="p-1.5 rounded-2xl hover:bg-primary/10 active:scale-90 transition-all flex items-center justify-center group"
                    title={s.name}
                  >
                    <img
                      src={url}
                      alt={s.name}
                      className="w-12 h-12 object-contain drop-shadow-sm select-none"
                      loading="lazy"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Online API Stickers (if available) */}
          {apiStickers.length > 0 && (
            <div>
              <p className="text-[9px] font-headline uppercase tracking-widest text-muted-foreground/60 px-1 pb-1 pt-0.5 sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                Trending Web Stickers
              </p>
              <div className="grid grid-cols-3 gap-2">
                {apiStickers.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => handleSelectSticker(st.url)}
                    className="p-1 rounded-xl hover:bg-primary/10 active:scale-95 transition-all flex items-center justify-center"
                  >
                    <img
                      src={st.preview || st.url}
                      alt="Sticker"
                      className="w-16 h-16 object-contain"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {isStickerLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          )}
        </div>
      </TabsContent>

      {/* Emoji Tab */}
      <TabsContent value="emoji" className="mt-0">
        <div className="max-h-56 overflow-y-auto scrollbar-hide px-1 space-y-3">
          {EMOJI_CATEGORIES.map((cat) => (
            <div key={cat.label}>
              <p className="text-[9px] font-headline uppercase tracking-widest text-muted-foreground/60 px-1 pb-1 pt-0.5 sticky top-0 bg-card/95 backdrop-blur-sm z-10">
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

      {/* GIF Tab */}
      <TabsContent value="gif" className="mt-0 flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
          <Input
            value={gifQuery}
            onChange={(e) => setGifQuery(e.target.value)}
            placeholder={KLIPY_KEY ? "Search GIFs..." : "Search GIFs..."}
            className="pl-8 h-8 text-xs rounded-full bg-muted/40 border-primary/10 focus:border-primary/30"
          />
        </div>

        <div className="h-56 overflow-y-auto scrollbar-hide">
          {isGifLoading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          )}
          {gifError && !isGifLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
              <p className="text-xs text-muted-foreground">{gifError}</p>
            </div>
          )}
          {!isGifLoading && !gifError && gifs.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-muted-foreground">No GIFs found</p>
            </div>
          )}
          {!isGifLoading && !gifError && gifs.length > 0 && (
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
      </TabsContent>
    </Tabs>
  );
}
