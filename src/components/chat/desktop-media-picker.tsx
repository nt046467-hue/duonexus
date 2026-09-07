"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Smile, Loader2, Plus, ChevronDown } from "lucide-react";
import { searchEmojis } from "@/lib/emoji-search";

const KLIPY_API_KEY = "3S5TuqL9AlT1oBzpg85fjcVGDEb2KkDwYgj96JW5j3M79kjRyFI0Ogg8YaX28fW9";

// ─── Sticker Packs ─────────────────────────────────────────────────────────────
const STICKER_PACKS: { id: string; name: string; thumb: string; stickers: string[] }[] = [
  {
    id: "love",
    name: "Love",
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
    name: "Quby",
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
    name: "Noto",
    thumb: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f970/512.gif",
    stickers: [
      "1f970", "1f618", "1f48b", "1f496", "1f60d", "1f525", "1f917", "1f973", "1f602", "1f44f",
      "1f48e", "1f339", "1f381", "1f388", "1f48d", "1f490", "1f33a", "1f33b", "2764", "1f600",
      "1f609", "1f61c", "1f643", "1f929", "1f910", "1f920", "1f911", "1f47b", "1f984", "1f431",
      "1f436", "1f43c", "1f98b", "1f308", "2728", "1f31f", "1f4a5", "1f4ab", "1f44d", "1f44e",
    ].map((c) => `https://fonts.gstatic.com/s/e/notoemoji/latest/${c}/512.gif`),
  },
];

const GIF_CATS = ["Trending", "Love", "Kiss", "Hugs", "Miss You", "Lol", "Happy", "Dance", "Sorry", "Cute"];

const RECENTLY_USED_KEY = "duonexus_recent_emojis";
function getRecentEmojis(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTLY_USED_KEY) || "[]");
  } catch {
    return [];
  }
}
function addRecentEmoji(emoji: string) {
  try {
    const existing = getRecentEmojis().filter((e) => e !== emoji);
    localStorage.setItem(RECENTLY_USED_KEY, JSON.stringify([emoji, ...existing].slice(0, 16)));
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. DEDICATED DESKTOP STICKER PICKER (Screenshot 1 Match)
// Positioned directly above Sticker Icon with speech-bubble tail pointing down
// ─────────────────────────────────────────────────────────────────────────────
export function DesktopStickerPicker({
  open,
  onClose,
  onSelectSticker,
  darkMode = true,
}: {
  open: boolean;
  onClose: () => void;
  onSelectSticker: (url: string) => void;
  darkMode?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [packId, setPackId] = useState("love");
  const [isSearching, setIsSearching] = useState(false);
  const [stickerQ, setStickerQ] = useState("");
  const [stickerResults, setStickerResults] = useState<string[]>([]);
  const [loadingStickers, setLoadingStickers] = useState(false);
  const searchTimer = useRef<NodeJS.Timeout | null>(null);
  const [showPackMenu, setShowPackMenu] = useState(false);
  const [showStickerStore, setShowStickerStore] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
        setShowPackMenu(false);
        setShowStickerStore(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showPackMenu) setShowPackMenu(false);
        else if (showStickerStore) setShowStickerStore(false);
        else onClose();
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, showPackMenu, showStickerStore]);

  const searchStickers = useCallback(async (q: string) => {
    if (!q.trim()) {
      setStickerResults([]);
      return;
    }
    setLoadingStickers(true);
    try {
      const res = await fetch(
        `https://api.klipy.com/v1/stickers/search?key=${KLIPY_API_KEY}&q=${encodeURIComponent(q)}&limit=24`,
        { headers: { Accept: "application/json" } }
      );
      if (res.ok) {
        const data = await res.json();
        const items = data?.data || data?.results || [];
        const urls = items
          .map((item: any) => item?.images?.original?.url || item?.url || item?.media?.gif)
          .filter(Boolean);
        setStickerResults(urls);
      }
    } catch {
      setStickerResults([]);
    } finally {
      setLoadingStickers(false);
    }
  }, []);

  const handleSearchChange = (val: string) => {
    setStickerQ(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchStickers(val), 350);
  };

  if (!open) return null;
  const currentPack = STICKER_PACKS.find((p) => p.id === packId) || STICKER_PACKS[0];

  return (
    <div
      ref={containerRef}
      onClick={(e) => e.stopPropagation()}
      className={`absolute bottom-full left-[-8px] mb-3 z-50 w-[340px] sm:w-[360px] h-[460px] flex flex-col rounded-2xl shadow-2xl border ${
        darkMode
          ? "bg-[#18181A] border-zinc-800 text-white"
          : "bg-white border-gray-200 text-gray-900"
      } animate-in fade-in zoom-in-95 duration-150 select-none`}
    >
      {/* Speech Bubble Arrow pointing down to the Sticker button */}
      <div
        className={`absolute -bottom-2 left-6 w-4 h-4 rotate-45 border-r border-b ${
          darkMode ? "bg-[#18181A] border-zinc-800" : "bg-white border-gray-200"
        }`}
      />

      {/* Top Pack Bar (Search, Pack Circles with blue underline, Chevron, Plus) */}
      <div
        className={`px-3 py-2 flex items-center gap-2 border-b shrink-0 rounded-t-2xl ${
          darkMode ? "border-zinc-800/80 bg-[#161618]" : "border-gray-100 bg-gray-50/70"
        }`}
      >
        {isSearching ? (
          <div className="flex-1 flex items-center gap-1.5 bg-black/10 dark:bg-white/10 rounded-xl px-2.5 py-1">
            <Search size={13} className="text-gray-400 shrink-0" />
            <input
              type="text"
              autoFocus
              placeholder="Search stickers..."
              value={stickerQ}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="bg-transparent outline-none text-xs w-full text-foreground placeholder-muted-foreground"
            />
            <button
              onClick={() => {
                setIsSearching(false);
                setStickerQ("");
              }}
              className="text-gray-400 hover:text-foreground"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <>
            {/* Search Icon */}
            <button
              type="button"
              onClick={() => setIsSearching(true)}
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                darkMode ? "text-zinc-400 hover:text-white hover:bg-zinc-800" : "text-gray-400 hover:bg-gray-200"
              }`}
              title="Search stickers"
            >
              <Search size={15} />
            </button>

            {/* Pack Thumbnails with blue underline for active pack */}
            <div className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-hide py-0.5">
              {STICKER_PACKS.map((pack) => {
                const isActive = packId === pack.id && !stickerQ;
                return (
                  <button
                    key={pack.id}
                    type="button"
                    title={pack.name}
                    onClick={() => {
                      setPackId(pack.id);
                      setStickerQ("");
                      setIsSearching(false);
                    }}
                    className="relative shrink-0 w-8 h-8 rounded-lg overflow-hidden group transition-all"
                  >
                    <img
                      src={pack.thumb}
                      alt={pack.name}
                      className={`w-full h-full object-cover transition-opacity ${
                        isActive ? "opacity-100 scale-105" : "opacity-45 group-hover:opacity-80"
                      }`}
                      loading="lazy"
                    />
                    {isActive && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[3px] rounded-full bg-[#0084ff]" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Dropdown Chevron (Pack Selector) */}
            <button
              type="button"
              title="All sticker packs"
              onClick={() => {
                setShowPackMenu(!showPackMenu);
                setShowStickerStore(false);
              }}
              className={`w-6 h-6 rounded flex items-center justify-center shrink-0 transition-colors ${
                showPackMenu
                  ? "bg-blue-500/20 text-[#0084ff]"
                  : darkMode
                  ? "text-zinc-500 hover:text-white"
                  : "text-gray-400 hover:text-gray-700"
              }`}
            >
              <ChevronDown size={14} />
            </button>

            {/* Plus Button (Sticker Store) */}
            <button
              type="button"
              title="Sticker Store"
              onClick={() => {
                setShowStickerStore(!showStickerStore);
                setShowPackMenu(false);
              }}
              className={`w-6 h-6 rounded flex items-center justify-center shrink-0 transition-colors ${
                showStickerStore
                  ? "bg-blue-500/20 text-[#0084ff]"
                  : darkMode
                  ? "text-zinc-500 hover:text-white"
                  : "text-gray-400 hover:text-gray-700"
              }`}
            >
              <Plus size={14} />
            </button>
          </>
        )}
      </div>

      {/* Pack Selector Dropdown (Chevron Menu) */}
      {showPackMenu && (
        <div
          className={`absolute top-12 right-3 z-30 w-52 rounded-2xl p-2 shadow-2xl border ${
            darkMode
              ? "bg-[#222224] border-zinc-700/80 text-white"
              : "bg-white border-gray-200 text-gray-900"
          } animate-in fade-in zoom-in-95 duration-100`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">
            All Sticker Packs
          </p>
          <div className="space-y-1 mt-1 max-h-48 overflow-y-auto">
            {STICKER_PACKS.map((pack) => (
              <button
                key={pack.id}
                type="button"
                onClick={() => {
                  setPackId(pack.id);
                  setShowPackMenu(false);
                }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  packId === pack.id
                    ? "bg-[#0084ff] text-white"
                    : darkMode
                    ? "hover:bg-white/10 text-zinc-300"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
              >
                <img src={pack.thumb} alt={pack.name} className="w-6 h-6 rounded-md object-cover" />
                <span className="truncate flex-1 text-left">{pack.name}</span>
                {packId === pack.id && <span className="text-[10px] font-bold">Active</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sticker Store Modal (Plus Button) */}
      {showStickerStore && (
        <div
          className={`absolute inset-0 z-40 rounded-2xl p-4 flex flex-col ${
            darkMode ? "bg-[#18181A]/95 text-white" : "bg-white/95 text-gray-900"
          } backdrop-blur-md animate-in fade-in zoom-in-95 duration-150`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-border/40">
            <div className="flex items-center gap-2">
              <span className="text-base">🛍️</span>
              <div>
                <h4 className="text-sm font-bold leading-none">Sticker Store</h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">Explore cute couple sticker packs</p>
              </div>
            </div>
            <button
              onClick={() => setShowStickerStore(false)}
              className="p-1 rounded-full text-muted-foreground hover:text-foreground"
            >
              <X size={15} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-2 space-y-2.5">
            {STICKER_PACKS.map((pack) => (
              <div
                key={pack.id}
                className={`p-2.5 rounded-2xl border flex items-center justify-between ${
                  darkMode ? "bg-zinc-800/40 border-zinc-700/50" : "bg-gray-50 border-gray-200"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img src={pack.thumb} alt={pack.name} className="w-10 h-10 rounded-xl object-cover" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold block truncate">{pack.name}</span>
                    <span className="text-[10px] text-muted-foreground">{pack.stickers.length} stickers</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPackId(pack.id);
                    setShowStickerStore(false);
                  }}
                  className={`text-[11px] font-bold px-3 py-1 rounded-full ${
                    packId === pack.id
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-[#0084ff] text-white hover:bg-blue-600"
                  }`}
                >
                  {packId === pack.id ? "Added ✅" : "Use Pack"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Pack Name Header */}
      {!stickerQ.trim() && (
        <div className="px-4 pt-2.5 pb-1 shrink-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {currentPack.name}
          </span>
        </div>
      )}

      {/* 3-Column Large Stickers Grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 pt-1 scrollbar-thin">
        {loadingStickers ? (
          <div className="h-48 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#0084ff]" />
            <span className="text-xs text-muted-foreground">Finding stickers...</span>
          </div>
        ) : stickerQ.trim() && stickerResults.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
            No stickers found
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {(stickerQ.trim() ? stickerResults : currentPack.stickers).map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onSelectSticker(url);
                  onClose();
                }}
                className={`aspect-square p-2 rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${
                  darkMode
                    ? "hover:bg-white/5 border border-transparent hover:border-[#0084ff]/30"
                    : "hover:bg-blue-50/50 border border-transparent hover:border-blue-200"
                }`}
              >
                <img src={url} alt="sticker" className="w-full h-full object-contain pointer-events-none" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. DEDICATED DESKTOP GIF PICKER
// Positioned directly above GIF Icon with speech-bubble tail pointing down
// ─────────────────────────────────────────────────────────────────────────────
export function DesktopGifPicker({
  open,
  onClose,
  onSelectGif,
  darkMode = true,
}: {
  open: boolean;
  onClose: () => void;
  onSelectGif: (url: string) => void;
  darkMode?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [gifQ, setGifQ] = useState("");
  const [gifCat, setGifCat] = useState("Trending");
  const [gifs, setGifs] = useState<{ id: string | number; url: string; preview: string }[]>([]);
  const [loadingGifs, setLoadingGifs] = useState(false);
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  const fetchGifs = useCallback(async (q: string) => {
    setLoadingGifs(true);
    try {
      const isTrending = !q.trim() || q.toLowerCase() === "trending";
      const endpoint = isTrending
        ? `https://api.klipy.com/v1/gifs/trending?key=${KLIPY_API_KEY}&limit=24`
        : `https://api.klipy.com/v1/gifs/search?key=${KLIPY_API_KEY}&q=${encodeURIComponent(q)}&limit=24`;

      const res = await fetch(endpoint, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const data = await res.json();
        const items = data?.data || data?.results || [];
        const mapped = items
          .map((item: any, i: number) => {
            const url = item?.images?.original?.url || item?.url || item?.media?.gif;
            const preview = item?.images?.downsized?.url || item?.preview || url;
            return url ? { id: item?.id || i, url, preview } : null;
          })
          .filter(Boolean);
        setGifs(mapped);
      }
    } catch {
      setGifs([]);
    } finally {
      setLoadingGifs(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchGifs(gifCat);
  }, [open, gifCat, fetchGifs]);

  const handleSearchChange = (val: string) => {
    setGifQ(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (val.trim()) {
        fetchGifs(val);
      } else {
        fetchGifs(gifCat);
      }
    }, 350);
  };

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      onClick={(e) => e.stopPropagation()}
      className={`absolute bottom-full left-[-40px] mb-3 z-50 w-[350px] sm:w-[380px] h-[480px] flex flex-col rounded-2xl shadow-2xl border ${
        darkMode
          ? "bg-[#18181A] border-zinc-800 text-white"
          : "bg-white border-gray-200 text-gray-900"
      } animate-in fade-in zoom-in-95 duration-150 select-none`}
    >
      {/* Speech Bubble Arrow pointing down to the GIF button */}
      <div
        className={`absolute -bottom-2 left-14 w-4 h-4 rotate-45 border-r border-b ${
          darkMode ? "bg-[#18181A] border-zinc-800" : "bg-white border-gray-200"
        }`}
      />

      {/* Search Header */}
      <div className="p-3 pb-2 shrink-0">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
            darkMode
              ? "bg-zinc-800/80 border-zinc-700/60"
              : "bg-gray-100 border-gray-200"
          }`}
        >
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search GIFs on Klipy..."
            value={gifQ}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="bg-transparent outline-none text-xs w-full text-foreground placeholder-muted-foreground"
          />
          {gifQ && (
            <button onClick={() => { setGifQ(""); fetchGifs(gifCat); }} className="text-muted-foreground hover:text-foreground">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Category Pills */}
      <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto scrollbar-hide shrink-0">
        {GIF_CATS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setGifCat(c);
              setGifQ("");
              fetchGifs(c);
            }}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              gifCat === c && !gifQ
                ? "bg-[#0084ff] text-white shadow-sm"
                : darkMode
                ? "bg-zinc-800 text-zinc-400 hover:text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* 2-Column Masonry GIFs */}
      <div className="flex-1 overflow-y-auto px-3 pb-2 scrollbar-thin">
        {loadingGifs ? (
          <div className="h-48 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-7 h-7 animate-spin text-[#0084ff]" />
            <span className="text-xs text-muted-foreground">Loading GIFs...</span>
          </div>
        ) : gifs.length > 0 ? (
          <div className="columns-2 gap-2 space-y-2">
            {gifs.map((gif) => (
              <div
                key={gif.id}
                onClick={() => {
                  onSelectGif(gif.url);
                  onClose();
                }}
                className="break-inside-avoid relative rounded-xl overflow-hidden cursor-pointer group border border-white/5 hover:border-[#0084ff] transition-all hover:scale-[1.02] active:scale-95 shadow-sm"
              >
                <img src={gif.preview} alt="GIF" className="w-full h-auto object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                  <span className="text-[9px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded">GIF</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
            No GIFs found
          </div>
        )}
      </div>

      <div
        className={`px-3 py-1.5 text-center shrink-0 border-t text-[9px] tracking-widest uppercase font-bold ${
          darkMode ? "border-zinc-800/80 text-zinc-600" : "border-gray-100 text-gray-400"
        }`}
      >
        Powered by KLIPY
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. DEDICATED DESKTOP EMOJI PICKER (Screenshot 2 Match)
// Positioned directly above Smiley Emoji Icon on the right with speech-bubble tail
// ─────────────────────────────────────────────────────────────────────────────
export function DesktopEmojiPicker({
  open,
  onClose,
  onSelectEmoji,
  darkMode = true,
  fullEmojiCategories,
  emojiTabIcons,
}: {
  open: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  darkMode?: boolean;
  fullEmojiCategories: Record<string, string[]>;
  emojiTabIcons: { key: string; label: string; icon: React.ReactNode }[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [emojiQ, setEmojiQ] = useState("");
  const [activeCategory, setActiveCategory] = useState(
    Object.keys(fullEmojiCategories)[0] || "Smileys & people"
  );
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);

  useEffect(() => {
    if (open) setRecentEmojis(getRecentEmojis());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  // Scroll spy: Update activeCategory as user scrolls through categories
  const handleScroll = () => {
    if (emojiQ.trim() || !scrollAreaRef.current) return;
    const containerTop = scrollAreaRef.current.getBoundingClientRect().top;
    const categories = Object.keys(fullEmojiCategories);

    for (let i = categories.length - 1; i >= 0; i--) {
      const cat = categories[i];
      const el = categoryRefs.current[cat];
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top - containerTop <= 80) {
          setActiveCategory(cat);
          break;
        }
      }
    }
  };

  const scrollToCategory = (catKey: string) => {
    setActiveCategory(catKey);
    setEmojiQ("");
    const target = categoryRefs.current[catKey];
    if (target && scrollAreaRef.current) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handlePickEmoji = (emoji: string) => {
    addRecentEmoji(emoji);
    setRecentEmojis(getRecentEmojis());
    onSelectEmoji(emoji);
  };

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      onClick={(e) => e.stopPropagation()}
      className={`absolute bottom-full right-0 mb-3 z-50 w-[340px] sm:w-[360px] h-[480px] flex flex-col rounded-2xl shadow-2xl border ${
        darkMode
          ? "bg-[#18181A] border-zinc-800 text-white"
          : "bg-white border-gray-200 text-gray-900"
      } animate-in fade-in zoom-in-95 duration-150 select-none`}
    >
      {/* Speech Bubble Arrow pointing down to the Emoji button on the right */}
      <div
        className={`absolute -bottom-2 right-4 w-4 h-4 rotate-45 border-r border-b ${
          darkMode ? "bg-[#18181A] border-zinc-800" : "bg-white border-gray-200"
        }`}
      />

      {/* Top Search Input */}
      <div className="p-3 pb-2 shrink-0 border-b border-border/40">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
            darkMode
              ? "bg-zinc-800/80 border-zinc-700/60"
              : "bg-gray-100 border-gray-200"
          }`}
        >
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search emoji..."
            value={emojiQ}
            onChange={(e) => setEmojiQ(e.target.value)}
            className="bg-transparent outline-none text-xs w-full text-foreground placeholder-muted-foreground"
          />
          {emojiQ && (
            <button
              onClick={() => setEmojiQ("")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Emoji Continuous Scroll List (All Categories stacked) */}
      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 pb-2 scrollbar-thin space-y-3"
      >
        {emojiQ.trim() ? (
          <div>
            <p className="text-[11px] font-bold text-muted-foreground mb-1.5 sticky top-0 py-1 backdrop-blur-md z-10">
              Search results
            </p>
            <div className="grid grid-cols-8 gap-0.5">
              {searchEmojis(emojiQ, Object.values(fullEmojiCategories).flat()).map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handlePickEmoji(emoji)}
                  className="w-9 h-9 flex items-center justify-center text-[22px] rounded-lg hover:scale-125 active:scale-90 transition-transform hover:bg-black/5 dark:hover:bg-white/10"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Recently Used Section */}
            {recentEmojis.length > 0 && (
              <div className="pt-1">
                <p
                  className={`text-[11px] font-bold mb-1.5 sticky top-0 py-1 backdrop-blur-md z-10 ${
                    darkMode ? "bg-[#18181A]/95 text-zinc-400" : "bg-white/95 text-gray-500"
                  }`}
                >
                  Recently used
                </p>
                <div className="grid grid-cols-8 gap-0.5">
                  {recentEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handlePickEmoji(emoji)}
                      className="w-9 h-9 flex items-center justify-center text-[22px] rounded-lg hover:scale-125 active:scale-90 transition-transform hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Continuous List of ALL Categories */}
            {Object.entries(fullEmojiCategories).map(([catKey, emojis]) => (
              <div
                key={catKey}
                ref={(el) => {
                  categoryRefs.current[catKey] = el;
                }}
                className="pt-1"
              >
                <p
                  className={`text-[11px] font-bold mb-1.5 sticky top-0 py-1 backdrop-blur-md z-10 ${
                    darkMode ? "bg-[#18181A]/95 text-zinc-400" : "bg-white/95 text-gray-500"
                  }`}
                >
                  {catKey}
                </p>
                <div className="grid grid-cols-8 gap-0.5">
                  {emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handlePickEmoji(emoji)}
                      className="w-9 h-9 flex items-center justify-center text-[22px] rounded-lg hover:scale-125 active:scale-90 transition-transform hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Bottom Category Navigation Bar */}
      <div
        className={`shrink-0 border-t flex items-center justify-between px-2 py-1 rounded-b-2xl ${
          darkMode ? "border-zinc-800/80 bg-[#161618]" : "border-gray-100 bg-gray-50"
        }`}
      >
        {emojiTabIcons.map((t) => (
          <button
            key={t.key}
            type="button"
            title={t.label}
            onClick={() => scrollToCategory(t.key)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
              activeCategory === t.key && !emojiQ
                ? darkMode
                  ? "text-[#5E8BFF] bg-blue-500/15 scale-105"
                  : "text-[#0084ff] bg-blue-50 scale-105"
                : darkMode
                ? "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            }`}
          >
            {t.icon}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Backward-compatible unified wrapper
// ─────────────────────────────────────────────────────────────────────────────
export function DesktopMediaPicker(props: any) {
  if (props.initialTab === "stickers") {
    return <DesktopStickerPicker {...props} />;
  }
  if (props.initialTab === "gifs") {
    return <DesktopGifPicker {...props} />;
  }
  return <DesktopEmojiPicker {...props} />;
}
