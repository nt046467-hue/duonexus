"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import {
  Search,
  X,
  Smile,
  Star,
  Clock,
  Loader2,
  Delete,
  Dog,
  Utensils,
  Dribbble,
  Car,
  Lightbulb,
  Hash,
  Flag,
} from "lucide-react";
import { searchEmojis } from "@/lib/emoji-search";

export const KLIPY_API_KEY = process.env.NEXT_PUBLIC_KLIPY_API_KEY || "";

// Sticker Tab Icon matching DuoNexus / Messenger
function MessengerStickerIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M15.5 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-9.5L15.5 3z" />
      <path d="M15 3v5a1 1 0 0 0 1 1h5" />
      <circle cx="8.5" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
      <path d="M9.5 16.5c.7.6 1.6.9 2.5.9s1.8-.3 2.5-.9" strokeWidth="1.8" />
    </svg>
  );
}

// GIF Badge Tab Icon
function MessengerGifBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center font-black text-[10px] leading-none rounded-[5px] border-[2px] px-1 py-[1.5px] tracking-tighter transition-colors ${
        active
          ? "border-current text-white dark:text-zinc-950"
          : "border-current opacity-75"
      }`}
    >
      GIF
    </span>
  );
}

export const STICKER_PACKS: {
  id: string;
  name: string;
  icon: string;
  thumb: string;
  stickers: string[];
}[] = [
  {
    id: "love",
    name: "Love & Romance",
    icon: "heart",
    thumb: "https://static.klipy.com/ii/4bbcf901ea0d5dec489bd8c608d7f1fd/a0/a7/bFYM0jn1Egny3mAKE2.gif",
    stickers: [
      "https://static.klipy.com/ii/4bbcf901ea0d5dec489bd8c608d7f1fd/a0/a7/bFYM0jn1Egny3mAKE2.gif",
      "https://static.klipy.com/ii/4184567b4c2af0d810857689fd514076/e8/98/859io8je7JxJRU8O2zwQ.gif",
      "https://static.klipy.com/ii/4bbcf901ea0d5dec489bd8c608d7f1fd/60/fa/ZDVrfpGDM4QSUl.gif",
      "https://static.klipy.com/ii/40e5f3c9157feea5d28a6b4ad3880d85/d8/4c/yaakVMwP.gif",
      "https://static.klipy.com/ii/4bbcf901ea0d5dec489bd8c608d7f1fd/1f/fd/pQzWItRiwARD.gif",
      "https://static.klipy.com/ii/c98c4a4935d23b95805f0befee091d8a/4f/f7/6uZq7iIg.gif",
      "https://static.klipy.com/ii/f10a5b8a9a8043b917448fb0ad499733/17/63/wQaZ5yGZAFf34RqRjH.gif",
      "https://static.klipy.com/ii/40e5f3c9157feea5d28a6b4ad3880d85/16/c2/VMBJRhXb.gif",
      "https://static.klipy.com/ii/a5166a66b33e26d783bf95ac62ea3cdb/3d/b8/Jytrbw7m.gif",
      "https://static.klipy.com/ii/40e5f3c9157feea5d28a6b4ad3880d85/73/a8/jmKg52Pc.gif",
      "https://static.klipy.com/ii/4bbcf901ea0d5dec489bd8c608d7f1fd/6e/da/QKSI3wVIwLkTlkVmM.gif",
      "https://static.klipy.com/ii/c98c4a4935d23b95805f0befee091d8a/7b/be/ebUNUfb5.gif",
    ],
  },
  {
    id: "mochi",
    name: "Peach & Goma",
    icon: "cat",
    thumb: "https://static.klipy.com/ii/4bbcf901ea0d5dec489bd8c608d7f1fd/5e/5e/alIulGXqrjG9PZN7YNHj.gif",
    stickers: [
      "https://static.klipy.com/ii/4bbcf901ea0d5dec489bd8c608d7f1fd/5e/5e/alIulGXqrjG9PZN7YNHj.gif",
      "https://static.klipy.com/ii/c98c4a4935d23b95805f0befee091d8a/ad/49/lcOs8g0d.gif",
      "https://static.klipy.com/ii/a5166a66b33e26d783bf95ac62ea3cdb/c5/88/pVoYt6hz.gif",
      "https://static.klipy.com/ii/40e5f3c9157feea5d28a6b4ad3880d85/17/89/zOZgdYnn.gif",
      "https://static.klipy.com/ii/4bbcf901ea0d5dec489bd8c608d7f1fd/45/70/zvs5WSFivnh8dpjJZ.gif",
      "https://static.klipy.com/ii/c98c4a4935d23b95805f0befee091d8a/c6/71/xY5uwqHV.gif",
      "https://static.klipy.com/ii/4bbcf901ea0d5dec489bd8c608d7f1fd/d2/99/mclP3q2R0pa30GKvO.gif",
      "https://static.klipy.com/ii/40e5f3c9157feea5d28a6b4ad3880d85/47/d2/N1B6GLPN.gif",
      "https://static.klipy.com/ii/a5166a66b33e26d783bf95ac62ea3cdb/8f/80/ygf8ub0L.gif",
      "https://static.klipy.com/ii/ffd4ac143e6335ac68951b787d3c1902/1e/93/aCXc5EiK.gif",
      "https://static.klipy.com/ii/4bbcf901ea0d5dec489bd8c608d7f1fd/a7/74/ixX9ULKy4p60BQV.gif",
      "https://static.klipy.com/ii/a5166a66b33e26d783bf95ac62ea3cdb/30/20/7Oj0trZX.gif",
    ],
  },
  {
    id: "pentol",
    name: "Quby Pentol",
    icon: "dumpling",
    thumb: "https://static.klipy.com/ii/a5166a66b33e26d783bf95ac62ea3cdb/11/ec/chMOJaAI.gif",
    stickers: [
      "https://static.klipy.com/ii/a5166a66b33e26d783bf95ac62ea3cdb/11/ec/chMOJaAI.gif",
      "https://static.klipy.com/ii/ffd4ac143e6335ac68951b787d3c1902/13/8b/kHzl9OMG.gif",
      "https://static.klipy.com/ii/4bbcf901ea0d5dec489bd8c608d7f1fd/7b/8a/q9UQhRIMCB1p9.gif",
      "https://static.klipy.com/ii/40e5f3c9157feea5d28a6b4ad3880d85/8f/48/2njzqlKN.gif",
      "https://static.klipy.com/ii/40e5f3c9157feea5d28a6b4ad3880d85/66/2f/unRAehG9.gif",
      "https://static.klipy.com/ii/c98c4a4935d23b95805f0befee091d8a/32/d2/BI5Zxffx.gif",
      "https://static.klipy.com/ii/4184567b4c2af0d810857689fd514076/c0/d9/VAwFvlonsRZWiV0BZ.gif",
      "https://static.klipy.com/ii/40e5f3c9157feea5d28a6b4ad3880d85/eb/bb/yLEau9vj.gif",
      "https://static.klipy.com/ii/40e5f3c9157feea5d28a6b4ad3880d85/ab/ca/Dsxi0734.gif",
      "https://static.klipy.com/ii/c98c4a4935d23b95805f0befee091d8a/e3/2e/L28lfNdh.gif",
      "https://static.klipy.com/ii/ffd4ac143e6335ac68951b787d3c1902/7d/1b/SWR6GJ5W.gif",
      "https://static.klipy.com/ii/c98c4a4935d23b95805f0befee091d8a/1e/e4/LUpkTC9N.gif",
    ],
  },
  {
    id: "mocha",
    name: "Milk & Mocha",
    icon: "bear",
    thumb: "https://static.klipy.com/ii/ffd4ac143e6335ac68951b787d3c1902/7c/48/PkJAI7wB.gif",
    stickers: [
      "https://static.klipy.com/ii/ffd4ac143e6335ac68951b787d3c1902/7c/48/PkJAI7wB.gif",
      "https://static.klipy.com/ii/40e5f3c9157feea5d28a6b4ad3880d85/1f/12/H02RfqPc.gif",
      "https://static.klipy.com/ii/4bbcf901ea0d5dec489bd8c608d7f1fd/38/9a/8E5S3muIKuHCyF73NF.gif",
      "https://static.klipy.com/ii/c98c4a4935d23b95805f0befee091d8a/c7/16/t5tXOjM5.gif",
      "https://static.klipy.com/ii/ffd4ac143e6335ac68951b787d3c1902/fd/c7/XJ72oIcd.gif",
      "https://static.klipy.com/ii/40e5f3c9157feea5d28a6b4ad3880d85/98/52/xHmMdPKQ.gif",
      "https://static.klipy.com/ii/a5166a66b33e26d783bf95ac62ea3cdb/63/ab/tbdoNL6w.gif",
      "https://static.klipy.com/ii/ffd4ac143e6335ac68951b787d3c1902/a0/45/zgBvWJ9D.gif",
      "https://static.klipy.com/ii/40e5f3c9157feea5d28a6b4ad3880d85/f0/76/yVqoKEB8.gif",
      "https://static.klipy.com/ii/c98c4a4935d23b95805f0befee091d8a/d5/3e/ye5tVBbn.gif",
      "https://static.klipy.com/ii/40e5f3c9157feea5d28a6b4ad3880d85/53/7f/lsaq7jjO.gif",
      "https://static.klipy.com/ii/4846b3f52590f2c38b4b8112890e71d5/ed/3e/ME2XkZjlSVQE.gif",
    ],
  },
  {
    id: "noto",
    name: "Noto Animated",
    icon: "sparkles",
    thumb: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f970/512.gif",
    stickers: [
      "1f970", "1f618", "1f48b", "1f496", "1f60d", "1f525", "1f917", "1f973", "1f602", "1f44f",
      "1f48e", "1f339", "1f381", "1f388", "1f48d", "1f490", "1f33a", "1f33b", "2764", "1f600",
      "1f609", "1f61c", "1f643", "1f929", "1f910", "1f920", "1f911", "1f47b", "1f984", "1f431",
      "1f436", "1f43c", "1f98b", "1f308", "2728", "1f31f", "1f4a5", "1f4ab", "1f44d", "1f44e",
    ].map((code) => `https://fonts.gstatic.com/s/e/notoemoji/latest/${code}/512.gif`),
  },
];

export const GIF_CATEGORIES = [
  "Trending", "Love", "Kiss", "Hugs", "Miss You",
  "Lol", "Happy", "Dance", "Sorry", "Cute",
];

export interface MessengerMediaPickerProps {
  open: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  onSelectSticker: (url: string) => void;
  onSelectGif: (url: string) => void;
  onBackspace?: () => void;
  darkMode?: boolean;
  initialTab?: "stickers" | "gifs" | "emojis" | "recent";
  fullEmojiCategories?: Record<string, string[]>;
  emojiTabIcons?: { key: string; label: string; icon: React.ReactNode }[];
  variant?: "drawer" | "popover";
  align?: "left" | "right";
  className?: string;
}

const DEFAULT_EMOJI_CATEGORIES: Record<string, string[]> = {
  "Smileys & people": ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥲", "☺️", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🥸", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😮‍💨", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🫣", "🫢", "🫡", "🤫", "🫠", "🤥", "😶", "😶‍🌫️", "😐", "😑", "😬", "🫨", "😮", "😯", "😲", "🥱", "😴", "🤤", "😪", "😵", "😵‍💫", "🫥", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠"],
  "Symbols": ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "☮️", "✝️", "☪️", "🕉️", "☸️", "✡️", "🔯", "🕎", "☯️", "☦️", "🛐", "⛎", "♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓", "🆔", "⚛️", "✨", "💫", "⭐", "🌟", "🔥", "💥", "💯", "🎉", "🎊"],
};

export function MessengerMediaPicker({
  open,
  onClose,
  onSelectEmoji,
  onSelectSticker,
  onSelectGif,
  onBackspace,
  darkMode = true,
  initialTab = "emojis",
  fullEmojiCategories,
  emojiTabIcons,
  variant = "drawer",
  align = "left",
  className,
}: MessengerMediaPickerProps) {

  const [activeTab, setActiveTab] = useState<"recent" | "emojis" | "stickers" | "gifs">(
    initialTab || "emojis"
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const isPopover = variant === "popover";

  useEffect(() => {
    if (initialTab && open) {
      setActiveTab(initialTab);
    }
  }, [initialTab, open]);

  // Handle escape key and click outside when in popover mode
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        containerRef.current?.contains(target) ||
        target?.closest("[data-media-picker-trigger]")
      ) {
        return;
      }
      onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    if (isPopover) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, onClose, isPopover]);

  // Recent emojis state (synced with localStorage)
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("duonexus_recent_emojis");
      return saved ? JSON.parse(saved) : ["❤️", "😘", "🥰", "😊", "🌸", "✨", "💕", "😍"];
    } catch {
      return ["❤️", "😘", "🥰", "😊", "🌸", "✨", "💕", "😍"];
    }
  });

  const handleEmojiClick = (emoji: string) => {
    onSelectEmoji(emoji);
    setRecentEmojis((prev) => {
      const next = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, 30);
      try {
        localStorage.setItem("duonexus_recent_emojis", JSON.stringify(next));
      } catch { }
      return next;
    });
  };

  // Search state
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sticker state
  const [selectedPackId, setSelectedPackId] = useState<string>("love");
  const [stickerSearchResults, setStickerSearchResults] = useState<string[]>([]);
  const [isLoadingStickers, setIsLoadingStickers] = useState(false);

  // GIF state
  const [activeGifCategory, setActiveGifCategory] = useState("Trending");
  const [gifResults, setGifResults] = useState<{ id: string | number; url: string; preview: string }[]>([]);
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);

  const gifTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stickerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dk = darkMode;

  const categories = fullEmojiCategories || DEFAULT_EMOJI_CATEGORIES;

  // Flattened emoji list for search
  const allEmojis = React.useMemo(() => {
    return Object.values(categories).flat();
  }, [categories]);


  // Klipy API fetch for GIFs
  const fetchGifs = async (query: string) => {
    setIsLoadingGifs(true);
    try {
      const isTrending = !query.trim() || query.toLowerCase() === "trending";
      const endpoint = isTrending
        ? `https://api.klipy.com/api/v1/${KLIPY_API_KEY}/gifs/trending?per_page=24`
        : `https://api.klipy.com/api/v1/${KLIPY_API_KEY}/gifs/search?q=${encodeURIComponent(query)}&per_page=24`;
      const res = await fetch(endpoint);
      const data = await res.json();
      if (data?.result && Array.isArray(data.data?.data)) {
        const items = data.data.data
          .map((item: any) => ({
            id: item.id || Math.random(),
            url: item.file?.hd?.gif?.url || item.file?.md?.gif?.url || item.file?.sm?.gif?.url,
            preview: item.file?.sm?.gif?.url || item.file?.md?.gif?.url || item.file?.hd?.gif?.url,
          }))
          .filter((x: any) => Boolean(x.url));
        setGifResults(items);
      } else {
        setGifResults([]);
      }
    } catch {
      setGifResults([]);
    } finally {
      setIsLoadingGifs(false);
    }
  };

  // Klipy API fetch for Stickers
  const fetchStickers = async (query: string) => {
    if (!query.trim()) {
      setStickerSearchResults([]);
      return;
    }
    setIsLoadingStickers(true);
    try {
      const res = await fetch(
        `https://api.klipy.com/api/v1/${KLIPY_API_KEY}/stickers/search?q=${encodeURIComponent(query)}&per_page=24`
      );
      const data = await res.json();
      if (data?.result && Array.isArray(data.data?.data)) {
        const urls = data.data.data
          .map((item: any) => item.file?.sm?.gif?.url || item.file?.hd?.webp?.url || item.file?.sm?.webp?.url)
          .filter(Boolean);
        setStickerSearchResults(urls);
      } else {
        setStickerSearchResults([]);
      }
    } catch {
      setStickerSearchResults([]);
    } finally {
      setIsLoadingStickers(false);
    }
  };

  // Live GIF search debounce
  useEffect(() => {
    if (activeTab === "gifs" && open) {
      if (gifTimerRef.current) clearTimeout(gifTimerRef.current);
      gifTimerRef.current = setTimeout(() => {
        fetchGifs(searchQuery.trim() || activeGifCategory);
      }, 300);
    }
    return () => {
      if (gifTimerRef.current) clearTimeout(gifTimerRef.current);
    };
  }, [activeTab, searchQuery, activeGifCategory, open]);

  // Live Sticker search debounce
  useEffect(() => {
    if (activeTab === "stickers" && searchQuery.trim()) {
      if (stickerTimerRef.current) clearTimeout(stickerTimerRef.current);
      stickerTimerRef.current = setTimeout(() => {
        fetchStickers(searchQuery.trim());
      }, 350);
    } else {
      setStickerSearchResults([]);
    }
    return () => {
      if (stickerTimerRef.current) clearTimeout(stickerTimerRef.current);
    };
  }, [activeTab, searchQuery]);

  // Focus search input when search is toggled on
  useEffect(() => {
    if (isSearching) {
      searchInputRef.current?.focus();
    }
  }, [isSearching]);

  const currentPack = STICKER_PACKS.find((p) => p.id === selectedPackId) || STICKER_PACKS[0];

  const scrollToEmojiCategory = (catKey: string) => {
    if (activeTab !== "emojis") {
      setActiveTab("emojis");
    }
    setTimeout(() => {
      const target = document.getElementById(`mobile-emoji-cat-${catKey}`);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  };

  // Quick jump category list
  const bottomCategoryStrip = [
    { key: "recent", label: "Recent", icon: <Clock className="w-[18px] h-[18px]" /> },
    { key: "Smileys & people", label: "Smileys", icon: <Smile className="w-[18px] h-[18px]" /> },
    { key: "Animals & nature", label: "Animals", icon: <Dog className="w-[18px] h-[18px]" /> },
    { key: "Food & drink", label: "Food", icon: <Utensils className="w-[18px] h-[18px]" /> },
    { key: "Activity", label: "Activity", icon: <Dribbble className="w-[18px] h-[18px]" /> },
    { key: "Travel & places", label: "Travel", icon: <Car className="w-[18px] h-[18px]" /> },
    { key: "Objects", label: "Objects", icon: <Lightbulb className="w-[18px] h-[18px]" /> },
    { key: "Symbols", label: "Symbols", icon: <Hash className="w-[18px] h-[18px]" /> },
    { key: "Flags", label: "Flags", icon: <Flag className="w-[18px] h-[18px]" /> },
  ];

  const content = (
    <>
      {/* Top Drag Indicator Line (drawer only) */}
      {!isPopover && (
        <div className="w-9 h-1 rounded-full mx-auto my-1.5 opacity-25 bg-current shrink-0" />
      )}

      {/* Top Header / Tab Bar */}
      <div className={`px-3 ${isPopover ? "pt-2.5 pb-2" : "pb-1.5"} shrink-0 flex items-center gap-2`}>

        {isSearching ? (
          /* Inline Search Input Mode (replaces tab bar) */
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full w-full border animate-in fade-in zoom-in-95 duration-150 ${
              dk ? "bg-zinc-800/80 border-zinc-700/60" : "bg-white border-gray-200 shadow-sm"
            }`}
          >
            <Search className="w-4 h-4 text-[#6952d7] dark:text-[#9f8dff] shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={
                activeTab === "stickers"
                  ? "Search stickers..."
                  : activeTab === "gifs"
                  ? "Search GIFs..."
                  : "Search emojis..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent outline-none text-[13px] w-full placeholder-gray-400 dark:placeholder-zinc-500 font-medium"
            />
            <button
              type="button"
              onClick={() => {
                setIsSearching(false);
                setSearchQuery("");
              }}
              className="p-1 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
              title="Close search"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Normal Tab Bar: Search Icon + Rounded-Pill Bar */
          <div className="flex items-center justify-between w-full">
            {/* Search Trigger Button */}
            <button
              type="button"
              onClick={() => setIsSearching(true)}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                dk
                  ? "text-zinc-400 hover:text-white hover:bg-zinc-800/70"
                  : "text-gray-500 hover:text-gray-800 hover:bg-gray-200/70"
              }`}
              title="Search"
            >
              <Search className="w-[19px] h-[19px]" />
            </button>

            {/* Rounded Pill Tabs Bar (Icon-only, matching DuoNexus active pill) */}
            <div
              className={`flex items-center gap-1 p-1 rounded-full text-xs ${
                dk ? "bg-zinc-800/70 border border-zinc-700/40" : "bg-gray-200/70 border border-gray-300/40"
              }`}
            >
              {/* Star / Recent Tab */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab("recent");
                  setSearchQuery("");
                }}
                title="Recent"
                className={`w-9 h-8 rounded-full flex items-center justify-center transition-all duration-150 ${
                  activeTab === "recent"
                    ? "bg-[#6952d7] text-white dark:bg-[#9f8dff] dark:text-zinc-950 shadow-sm scale-105"
                    : dk
                    ? "text-zinc-400 hover:text-zinc-200"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <Star className="w-[18px] h-[18px]" />
              </button>

              {/* Emoji Tab (Smile) */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab("emojis");
                  setSearchQuery("");
                }}
                title="Emoji"
                className={`w-9 h-8 rounded-full flex items-center justify-center transition-all duration-150 ${
                  activeTab === "emojis"
                    ? "bg-[#6952d7] text-white dark:bg-[#9f8dff] dark:text-zinc-950 shadow-sm scale-105"
                    : dk
                    ? "text-zinc-400 hover:text-zinc-200"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <Smile className="w-[18px] h-[18px]" />
              </button>

              {/* Stickers Tab */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab("stickers");
                  setSearchQuery("");
                }}
                title="Stickers"
                className={`w-9 h-8 rounded-full flex items-center justify-center transition-all duration-150 ${
                  activeTab === "stickers"
                    ? "bg-[#6952d7] text-white dark:bg-[#9f8dff] dark:text-zinc-950 shadow-sm scale-105"
                    : dk
                    ? "text-zinc-400 hover:text-zinc-200"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <MessengerStickerIcon className="w-[18px] h-[18px]" />
              </button>

              {/* GIF Tab */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab("gifs");
                  setSearchQuery("");
                }}
                title="GIFs"
                className={`w-9 h-8 rounded-full flex items-center justify-center transition-all duration-150 ${
                  activeTab === "gifs"
                    ? "bg-[#6952d7] text-white dark:bg-[#9f8dff] dark:text-zinc-950 shadow-sm scale-105"
                    : dk
                    ? "text-zinc-400 hover:text-zinc-200"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <MessengerGifBadge active={activeTab === "gifs"} />
              </button>
            </div>

            {/* Close Panel Button */}
            <button
              type="button"
              onClick={onClose}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                dk
                  ? "text-zinc-400 hover:text-white hover:bg-zinc-800/70"
                  : "text-gray-500 hover:text-gray-800 hover:bg-gray-200/70"
              }`}
              title="Close picker"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* TAB CONTENTS: Keep all mounted simultaneously to preserve scroll positions */}
      <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
        {/* 1. RECENT TAB */}
        <div
          className={`flex-1 min-h-0 flex-col overflow-y-auto px-3 pb-2 scrollbar-hide ${
            activeTab === "recent" ? "flex" : "hidden"
          }`}
        >
          <span
            className={`text-[11px] font-bold uppercase tracking-wider block my-2 ${
              dk ? "text-zinc-400" : "text-gray-500"
            }`}
          >
            Recently Used Emojis
          </span>
          {recentEmojis.length > 0 ? (
            <div className="grid grid-cols-7 sm:grid-cols-8 gap-1">
              {(searchQuery.trim()
                ? recentEmojis.filter((e) => searchEmojis(searchQuery, [e]).length > 0)
                : recentEmojis
              ).map((emoji, idx) => (
                <EmojiCell key={`${emoji}-${idx}`} emoji={emoji} onSelect={handleEmojiClick} />
              ))}
            </div>
          ) : (
            <div className="h-32 flex flex-col items-center justify-center text-center p-4 text-gray-400 dark:text-zinc-500">
              <Clock className="w-7 h-7 mb-1 opacity-60" />
              <p className="text-xs font-medium">No recently used emojis yet</p>
              <p className="text-[11px] opacity-75 mt-0.5">Tap any emoji from the emoji tab to see it here</p>
            </div>
          )}
        </div>

        {/* 2. EMOJI TAB */}
        <div
          id="mobile-emoji-scroll-container"
          className={`flex-1 min-h-0 flex-col overflow-y-auto px-3 pb-2 scrollbar-hide space-y-4 ${
            activeTab === "emojis" ? "flex" : "hidden"
          }`}
        >
          {searchQuery.trim() ? (
            <div>
              <span
                className={`text-[11px] font-bold uppercase tracking-wider block mb-2 sticky top-0 py-1 backdrop-blur-md z-10 ${
                  dk ? "bg-[#18181A]/95 text-zinc-400" : "bg-[#F3F2EE]/95 text-gray-500"
                }`}
              >
                Search results
              </span>
              <div className="grid grid-cols-7 sm:grid-cols-8 gap-1">
                {searchEmojis(searchQuery, allEmojis).map((emoji, i) => (
                  <EmojiCell key={`${emoji}-${i}`} emoji={emoji} onSelect={handleEmojiClick} />
                ))}
              </div>
            </div>
          ) : (
            Object.entries(categories).map(([catKey, emojis]) => (
              <div key={catKey} id={`mobile-emoji-cat-${catKey}`} className="pt-0.5">
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider block mb-2 sticky top-0 py-1 backdrop-blur-md z-10 ${
                    dk ? "bg-[#18181A]/95 text-zinc-400" : "bg-[#F3F2EE]/95 text-gray-500"
                  }`}
                >
                  {catKey}
                </span>
                <div className="grid grid-cols-7 sm:grid-cols-8 gap-1">
                  {emojis.map((emoji, idx) => (
                    <EmojiCell key={`${catKey}-${emoji}-${idx}`} emoji={emoji} onSelect={handleEmojiClick} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 3. STICKERS TAB */}
        <div
          className={`flex-1 min-h-0 flex-col overflow-hidden ${
            activeTab === "stickers" ? "flex" : "hidden"
          }`}
        >
          {/* Pack Thumbnails (hidden during search) */}
          {!searchQuery.trim() && (
            <div
              className={`shrink-0 flex items-center gap-2.5 px-3 py-1.5 overflow-x-auto scrollbar-hide border-b ${
                dk ? "border-zinc-800/80" : "border-gray-200/80"
              }`}
            >
              {STICKER_PACKS.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  title={pack.name}
                  onClick={() => setSelectedPackId(pack.id)}
                  className={`relative flex-shrink-0 w-9 h-9 rounded-full overflow-hidden border-2 transition-all duration-200 ${
                    selectedPackId === pack.id
                      ? "border-[#6952d7] dark:border-[#9f8dff] scale-[1.12] shadow-md ring-2 ring-[#6952d7]/30"
                      : dk
                      ? "border-zinc-700 opacity-60 hover:opacity-95"
                      : "border-gray-300 opacity-65 hover:opacity-95"
                  }`}
                >
                  <img src={pack.thumb} alt={pack.name} className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}

          {/* Pack Name */}
          {!searchQuery.trim() && (
            <div className="px-3 pt-1.5 pb-1 shrink-0">
              <span
                className={`text-[10px] font-bold uppercase tracking-widest ${
                  dk ? "text-zinc-500" : "text-gray-400"
                }`}
              >
                {currentPack.name}
              </span>
            </div>
          )}

          {/* Sticker Grid */}
          <div className="flex-1 overflow-y-auto px-2 pb-2 scrollbar-hide">
            {isLoadingStickers ? (
              <div className="h-40 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#6952d7] dark:text-[#9f8dff]" />
                <span className="text-xs text-gray-400">Finding stickers...</span>
              </div>
            ) : searchQuery.trim() ? (
              stickerSearchResults.length > 0 ? (
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {stickerSearchResults.map((url, i) => (
                    <StickerCell
                      key={i}
                      url={url}
                      onSelect={() => {
                        onSelectSticker(url);
                        onClose();
                      }}
                      dark={dk}
                    />
                  ))}
                </div>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-center text-gray-400 p-4">
                  <p className="text-sm font-medium">No stickers found for &quot;{searchQuery}&quot;</p>
                  <p className="text-xs text-gray-500 mt-1">Try &quot;love&quot;, &quot;cat&quot;, &quot;hug&quot; or &quot;funny&quot;</p>
                </div>
              )
            ) : (
              <div className="grid grid-cols-4 gap-2 pt-1">
                {currentPack.stickers.map((url, idx) => (
                  <StickerCell
                    key={idx}
                    url={url}
                    onSelect={() => {
                      onSelectSticker(url);
                      onClose();
                    }}
                    dark={dk}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 4. GIFS TAB */}
        <div
          className={`flex-1 min-h-0 flex-col overflow-hidden ${
            activeTab === "gifs" ? "flex" : "hidden"
          }`}
        >
          {/* Category Filter Pills (hidden during active search text) */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-hide shrink-0 border-b ${
              dk ? "border-zinc-800/80" : "border-gray-200/80"
            }`}
          >
            {GIF_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setActiveGifCategory(cat);
                  setSearchQuery("");
                  fetchGifs(cat);
                }}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                  activeGifCategory === cat && !searchQuery
                    ? "bg-[#6952d7] text-white dark:bg-[#9f8dff] dark:text-zinc-950 shadow-sm"
                    : dk
                    ? "bg-zinc-800 text-gray-300 hover:bg-zinc-700"
                    : "bg-gray-200/80 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* GIF Results */}
          <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
            {isLoadingGifs ? (
              <div className="h-44 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#6952d7] dark:text-[#9f8dff]" />
                <span className="text-xs font-medium text-gray-400">Loading GIFs...</span>
              </div>
            ) : gifResults.length > 0 ? (
              <div className="columns-2 gap-2 space-y-2">
                {gifResults.map((gif) => (
                  <div
                    key={gif.id}
                    onClick={() => {
                      onSelectGif(gif.url);
                      onClose();
                    }}
                    className="break-inside-avoid relative rounded-xl overflow-hidden cursor-pointer group border border-white/5 hover:border-[#6952d7] dark:hover:border-[#9f8dff] transition-all hover:scale-[1.02] active:scale-95 bg-black/10"
                  >
                    <img
                      src={gif.preview}
                      alt="GIF"
                      className="w-full h-auto object-cover rounded-xl"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                      <span className="text-[10px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm">
                        GIF
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-center p-4 text-gray-400">
                <p className="text-sm font-medium">No GIFs found</p>
                <p className="text-xs text-gray-500 mt-1">Try another search term</p>
              </div>
            )}
          </div>

          <div
            className={`px-3 py-1 text-center shrink-0 border-t ${
              dk ? "border-zinc-800/80 text-zinc-600 bg-[#111]/30" : "border-gray-200 text-gray-400 bg-gray-50/50"
            }`}
          >
            <span className="text-[9px] tracking-widest uppercase font-bold">Powered by KLIPY</span>
          </div>
        </div>
      </div>

      {/* c) BOTTOM CATEGORY QUICK-JUMP STRIP: For Emoji & Recent tab only, hidden on Stickers or GIF tab */}
      {(activeTab === "emojis" || activeTab === "recent") && (
        <div
          className={`shrink-0 border-t flex items-center justify-between px-2 py-1 ${
            dk ? "border-zinc-800/80 bg-[#121214]" : "border-gray-200 bg-gray-100/90"
          }`}
        >
          {bottomCategoryStrip.map((item) => (
            <button
              key={item.key}
              type="button"
              title={item.label}
              onClick={() => {
                if (item.key === "recent") {
                  setActiveTab("recent");
                } else {
                  scrollToEmojiCategory(item.key);
                }
              }}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                (activeTab === "recent" && item.key === "recent") || (activeTab === "emojis" && item.key === "Smileys & people")
                  ? "text-[#6952d7] dark:text-[#9f8dff]"
                  : dk
                  ? "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
                  : "text-gray-400 hover:text-gray-700 hover:bg-gray-200"
              }`}
            >
              {item.icon}
            </button>
          ))}

          {/* Keyboard Backspace / Delete Icon */}
          <button
            type="button"
            title="Delete previous character"
            onClick={onBackspace}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
              dk ? "text-zinc-400 hover:text-red-400 hover:bg-zinc-800" : "text-gray-500 hover:text-red-500 hover:bg-gray-200"
            } active:scale-90`}
          >
            <Delete className="w-[18px] h-[18px]" />
          </button>
        </div>
      )}
    </>
  );

  if (!open) return null;

  if (isPopover) {
    return (
      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        className={`absolute bottom-full mb-3 ${
          align === "left"
            ? "left-[-8px] sm:left-[-12px] right-auto"
            : "right-[-8px] sm:right-[-12px] left-auto"
        } z-[100] w-[340px] sm:w-[370px] max-w-[calc(100vw-24px)] h-[460px] max-h-[65vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden select-none animate-in fade-in zoom-in-95 duration-150 ${
          dk ? "bg-[#18181A] border-zinc-800 text-white" : "bg-white border-gray-200 text-gray-900"
        } ${className || ""}`}
      >
        {/* Speech Bubble Arrow pointing down to the trigger button */}
        <div
          className={`absolute -bottom-2 ${
            align === "left" ? "left-6 sm:left-7" : "right-6 sm:right-7"
          } w-4 h-4 rotate-45 border-r border-b ${
            dk ? "bg-[#18181A] border-zinc-800" : "bg-white border-gray-200"
          }`}
        />
        {content}
      </div>
    );

  }

  return (
    <motion.div
      ref={containerRef}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 350, opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className={`w-full overflow-hidden flex flex-col border-t select-none shrink-0 z-20 ${
        dk ? "bg-[#18181A] border-zinc-800 text-white" : "bg-[#F3F2EE] border-gray-200 text-gray-900"
      } ${className || ""}`}
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      onClick={(e) => e.stopPropagation()}
    >
      {content}
    </motion.div>
  );
}

function StickerCell({ url, onSelect, dark }: { url: string; onSelect: () => void; dark: boolean }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`aspect-square flex items-center justify-center rounded-2xl overflow-hidden p-1.5 transition-all hover:scale-[1.1] active:scale-95 border ${
        dark
          ? "bg-zinc-800/40 border-zinc-700/40 hover:border-[#9f8dff] hover:bg-zinc-800/70"
          : "bg-white border-gray-200/90 hover:border-[#6952d7] hover:bg-purple-50/30"
      }`}
    >
      <img src={url} alt="Sticker" className="w-full h-full object-contain pointer-events-none" loading="lazy" />
    </button>
  );
}

function EmojiCell({ emoji, onSelect }: { emoji: string; onSelect: (e: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(emoji)}
      className="w-10 h-10 flex items-center justify-center text-[23px] rounded-xl hover:scale-125 active:scale-90 transition-transform hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
    >
      {emoji}
    </button>
  );
}
