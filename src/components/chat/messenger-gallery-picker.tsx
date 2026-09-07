"use client";

import React, { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Camera,
  Check,
  Send,
  Folder,
  Image as ImageIcon,
  X,
} from "lucide-react";

// Google Photos 4-color authentic pinwheel SVG
function GooglePhotosIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path
        fill="#EA4335"
        d="M12 2a5 5 0 0 0-5 5v5h5a5 5 0 0 0 5-5 5 5 0 0 0-5-5z"
      />
      <path
        fill="#4285F4"
        d="M22 12a5 5 0 0 0-5-5h-5v5a5 5 0 0 0 5 5 5 5 0 0 0 5-5z"
      />
      <path
        fill="#34A853"
        d="M12 22a5 5 0 0 0 5-5v-5h-5a5 5 0 0 0-5 5 5 5 0 0 0 5 5z"
      />
      <path
        fill="#FBBC05"
        d="M2 12a5 5 0 0 0 5 5h5v-5a5 5 0 0 0-5-5 5 5 0 0 0-5 5z"
      />
    </svg>
  );
}

// Authentic Messenger / WhatsApp Media Gallery Icon
export function MessengerGalleryIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="18" height="18" x="3" y="3" rx="3.5" />
      <circle cx="8.5" cy="8.5" r="2" fill="currentColor" stroke="none" />
      <path d="M21 16.5l-5.5-5.5a2 2 0 0 0-2.8 0L3.5 20" />
    </svg>
  );
}

export interface GalleryPhotoItem {
  id: string;
  url: string;
  title?: string;
  source?: "chat" | "memory" | "curated" | "camera";
}

// Curated high-res romantic & aesthetic photos to ensure gallery is always rich and beautiful
const CURATED_GALLERY_PHOTOS: GalleryPhotoItem[] = [
  {
    id: "g-1",
    url: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&auto=format&fit=crop&q=80",
    title: "Love Flowers",
    source: "curated",
  },
  {
    id: "g-2",
    url: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=600&auto=format&fit=crop&q=80",
    title: "Heart Love",
    source: "curated",
  },
  {
    id: "g-3",
    url: "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=600&auto=format&fit=crop&q=80",
    title: "Couple Sunset",
    source: "curated",
  },
  {
    id: "g-4",
    url: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80",
    title: "Starry Night",
    source: "curated",
  },
  {
    id: "g-5",
    url: "https://images.unsplash.com/photo-1494774157365-9e04c6720e47?w=600&auto=format&fit=crop&q=80",
    title: "Cozy Moment",
    source: "curated",
  },
  {
    id: "g-6",
    url: "https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=600&auto=format&fit=crop&q=80",
    title: "Cherry Blossom",
    source: "curated",
  },
  {
    id: "g-7",
    url: "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=600&auto=format&fit=crop&q=80",
    title: "Pink Roses",
    source: "curated",
  },
  {
    id: "g-8",
    url: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=600&auto=format&fit=crop&q=80",
    title: "Holding Hands",
    source: "curated",
  },
  {
    id: "g-9",
    url: "https://images.unsplash.com/photo-1516575334481-f85287c2c82d?w=600&auto=format&fit=crop&q=80",
    title: "Candlelight Dinner",
    source: "curated",
  },
  {
    id: "g-10",
    url: "https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=600&auto=format&fit=crop&q=80",
    title: "Warm Sun",
    source: "curated",
  },
  {
    id: "g-11",
    url: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600&auto=format&fit=crop&q=80",
    title: "Celebration Balloons",
    source: "curated",
  },
  {
    id: "g-12",
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80",
    title: "Beach Paradise",
    source: "curated",
  },
];

export interface MessengerGalleryPickerProps {
  open: boolean;
  onClose: () => void;
  onSelectImage: (url: string, options?: { isHD?: boolean }) => void;
  onOpenNativePicker: () => void;
  onOpenCamera: () => void;
  chatPhotos?: string[];
  memoryPhotos?: string[];
  darkMode?: boolean;
}

export function MessengerGalleryPicker({
  open,
  onClose,
  onSelectImage,
  onOpenNativePicker,
  onOpenCamera,
  chatPhotos = [],
  memoryPhotos = [],
  darkMode = true,
}: MessengerGalleryPickerProps) {
  const [isHD, setIsHD] = useState(false);
  const [hdToast, setHdToast] = useState<string | null>(null);
  const hdToastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [activeAlbum, setActiveAlbum] = useState<"all" | "chat" | "curated">("all");
  const [showAlbumMenu, setShowAlbumMenu] = useState(false);

  const toggleHD = () => {
    setIsHD((prev) => {
      const next = !prev;
      if (hdToastTimerRef.current) clearTimeout(hdToastTimerRef.current);
      setHdToast(next ? "HD Photo Quality ON (1080p+) ✨" : "Standard Quality (Fast Send) ⚡");
      hdToastTimerRef.current = setTimeout(() => setHdToast(null), 2200);
      return next;
    });
  };

  const getOptimizedUrl = (url: string) => {
    if (isHD && url.includes("images.unsplash.com")) {
      return url.replace(/w=\d+/, "w=1600").replace(/q=\d+/, "q=95");
    }
    return url;
  };

  // Combine real chat images, memory images, and curated gallery photos
  const allPhotos = useMemo(() => {
    const list: GalleryPhotoItem[] = [];

    // Real chat photos sent in the conversation
    chatPhotos.forEach((url, i) => {
      if (url && !list.some((p) => p.url === url)) {
        list.push({
          id: `chat-${i}-${url.slice(-10)}`,
          url,
          title: "Shared Photo",
          source: "chat",
        });
      }
    });

    // Memory photos
    memoryPhotos.forEach((url, i) => {
      if (url && !list.some((p) => p.url === url)) {
        list.push({
          id: `mem-${i}-${url.slice(-10)}`,
          url,
          title: "Memory",
          source: "memory",
        });
      }
    });

    // Curated lovely couple / romance photos
    CURATED_GALLERY_PHOTOS.forEach((p) => {
      if (!list.some((item) => item.url === p.url)) {
        list.push(p);
      }
    });

    return list;
  }, [chatPhotos, memoryPhotos]);

  // Filtered by active album
  const displayedPhotos = useMemo(() => {
    if (activeAlbum === "chat") {
      return allPhotos.filter((p) => p.source === "chat" || p.source === "memory");
    }
    if (activeAlbum === "curated") {
      return allPhotos.filter((p) => p.source === "curated");
    }
    return allPhotos;
  }, [allPhotos, activeAlbum]);

  const toggleSelectPhoto = (url: string) => {
    setSelectedPhotos((prev) => {
      if (prev.includes(url)) {
        return prev.filter((u) => u !== url);
      }
      return [...prev, url];
    });
  };

  const handleSendSelected = () => {
    if (selectedPhotos.length === 0) return;
    selectedPhotos.forEach((url) => {
      onSelectImage(getOptimizedUrl(url), { isHD });
    });
    setSelectedPhotos([]);
    onClose();
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ y: 340, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 340, opacity: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className={`w-full flex flex-col select-none relative z-30 shadow-2xl border-t ${darkMode
        ? "bg-[#181818] border-zinc-800/80 text-white"
        : "bg-white border-gray-200 text-gray-900"
        }`}
      style={{
        height: "390px",
        maxHeight: "55vh",
      }}
    >
      {/* Top drag handle + Close button */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 40 || info.velocity.y > 200) {
            onClose();
          }
        }}
        className="w-full flex items-center justify-between px-3 pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none"
      >
        {/* Spacer */}
        <div className="w-8" />
        {/* Drag handle */}
        <div
          onClick={onClose}
          className={`w-10 h-1 rounded-full cursor-pointer hover:scale-105 active:scale-95 transition-transform ${darkMode ? "bg-zinc-600/70" : "bg-zinc-300"
            }`}
          title="Drag down or tap to close"
        />
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${darkMode
            ? "text-gray-400 hover:bg-zinc-800 hover:text-gray-200"
            : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            }`}
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>

      {/* Header bar: "All photos v" | Google Photos | HD Off */}
      <div className="flex items-center justify-between px-3.5 py-1.5 shrink-0 relative">
        {/* Left: Album Dropdown Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAlbumMenu(!showAlbumMenu)}
            className={`flex items-center gap-1.5 py-1 px-1.5 -ml-1 rounded-lg text-[15px] font-semibold tracking-tight transition-colors active:scale-95 ${darkMode
              ? "text-white hover:bg-zinc-800"
              : "text-gray-900 hover:bg-gray-100"
              }`}
          >
            <span>
              {activeAlbum === "all"
                ? "All photos"
                : activeAlbum === "chat"
                  ? "Shared in chat"
                  : "Romantic & Wallpapers"}
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${showAlbumMenu ? "rotate-180 text-[#00d2ff]" : "text-gray-400"
                }`}
            />
          </button>

          {/* Album Selector Menu */}
          {showAlbumMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowAlbumMenu(false)}
              />
              <div
                className={`absolute top-full left-0 mt-1.5 w-48 rounded-xl shadow-2xl border p-1 z-50 animate-in fade-in zoom-in-95 duration-150 ${darkMode
                  ? "bg-[#242424] border-zinc-700 text-gray-100"
                  : "bg-white border-gray-200 text-gray-800"
                  }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveAlbum("all");
                    setShowAlbumMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeAlbum === "all"
                    ? "text-[#00d2ff] bg-[#00d2ff]/10 font-bold"
                    : darkMode
                      ? "hover:bg-zinc-800"
                      : "hover:bg-gray-100"
                    }`}
                >
                  <span>All photos</span>
                  {activeAlbum === "all" && <Check className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveAlbum("chat");
                    setShowAlbumMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeAlbum === "chat"
                    ? "text-[#00d2ff] bg-[#00d2ff]/10 font-bold"
                    : darkMode
                      ? "hover:bg-zinc-800"
                      : "hover:bg-gray-100"
                    }`}
                >
                  <span>Shared in chat</span>
                  {activeAlbum === "chat" && <Check className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveAlbum("curated");
                    setShowAlbumMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeAlbum === "curated"
                    ? "text-[#00d2ff] bg-[#00d2ff]/10 font-bold"
                    : darkMode
                      ? "hover:bg-zinc-800"
                      : "hover:bg-gray-100"
                    }`}
                >
                  <span>Romantic & Wallpapers</span>
                  {activeAlbum === "curated" && <Check className="w-4 h-4" />}
                </button>

                <div
                  className={`my-1 border-t ${darkMode ? "border-zinc-700" : "border-gray-200"
                    }`}
                />

                <button
                  type="button"
                  onClick={() => {
                    setShowAlbumMenu(false);
                    onOpenNativePicker();
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-[#00d2ff] ${darkMode ? "hover:bg-zinc-800" : "hover:bg-gray-100"
                    }`}
                >
                  <Folder className="w-4 h-4" />
                  <span>Browse Device...</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right Action Buttons: Google Photos / Native Gallery + HD Toggle */}
        <div className="flex items-center gap-2">
          {/* Native phone photo gallery picker (Google Photos style icon) */}
          <button
            type="button"
            onClick={onOpenNativePicker}
            className={`p-1.5 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer ${darkMode ? "hover:bg-zinc-800" : "hover:bg-gray-100"
              }`}
            title="Choose from device gallery"
          >
            <GooglePhotosIcon className="w-5 h-5" />
          </button>

          {/* HD Toggle Pill Button */}
          <button
            type="button"
            onClick={toggleHD}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold transition-all active:scale-95 cursor-pointer ${isHD
              ? "border-[#00d2ff] bg-[#00d2ff]/15 text-[#00d2ff]"
              : darkMode
                ? "border-zinc-700 bg-zinc-800/80 text-gray-300 hover:border-zinc-600"
                : "border-gray-300 bg-gray-100 text-gray-700 hover:border-gray-400"
              }`}
            title={isHD ? "HD Quality is ON (1080p+)" : "Turn HD Quality ON"}
          >
            <span
              className={`text-[9px] font-black tracking-tighter px-1 py-[0.5px] rounded border ${isHD
                ? "border-[#00d2ff] bg-[#00d2ff] text-slate-950 font-bold"
                : darkMode
                  ? "border-zinc-600 text-gray-400"
                  : "border-gray-400 text-gray-600"
                }`}
            >
              HD
            </span>
            <span className="text-[11.5px] font-medium">
              {isHD ? "On" : "Off"}
            </span>
          </button>
        </div>
      </div>

      {/* HD Status Indicator Banner */}
      {hdToast && (
        <div className="absolute top-12 inset-x-0 z-50 flex justify-center pointer-events-none animate-in fade-in zoom-in-95 duration-200">
          <div className="px-3.5 py-1.5 rounded-full bg-black/90 backdrop-blur-md text-[#00d2ff] text-xs font-bold border border-[#00d2ff]/40 shadow-xl flex items-center gap-1.5">
            <span>{hdToast}</span>
          </div>
        </div>
      )}

      {/* 3-Column Photo Grid with smooth touch scrolling */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain px-1 pb-6 pt-1 touch-pan-y scrollbar-thin"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="grid grid-cols-3 gap-1">
          {/* Tile 1: Live Camera Open Tile */}
          <div
            onClick={onOpenCamera}
            className={`aspect-square relative flex flex-col items-center justify-center rounded-[2px] transition-all cursor-pointer active:scale-95 group ${darkMode
              ? "bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-300"
              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-black/20 dark:bg-white/10 mb-1.5 group-hover:scale-110 transition-transform">
              <Camera className="w-5 h-5 text-[#00d2ff]" />
            </div>
            <span className="text-[11.5px] font-semibold tracking-tight">Camera</span>
          </div>

          {/* Photo Tiles */}
          {displayedPhotos.map((photo, index) => {
            const isSelected = selectedPhotos.includes(photo.url);
            const selectionIndex = selectedPhotos.indexOf(photo.url) + 1;

            return (
              <div
                key={photo.id || index}
                onClick={() => toggleSelectPhoto(photo.url)}
                className="aspect-square relative overflow-hidden rounded-[2px] cursor-pointer group select-none active:scale-[0.98] transition-transform"
              >
                {/* Image */}
                <img
                  src={photo.url}
                  alt={photo.title || "Gallery photo"}
                  loading="lazy"
                  className={`w-full h-full object-cover transition-transform duration-200 group-hover:scale-105 ${isSelected ? "brightness-90" : ""
                    }`}
                />

                {/* Selected Overlay Border */}
                {isSelected && (
                  <div className="absolute inset-0 border-[3px] border-[#00d2ff] z-10 pointer-events-none" />
                )}

                {/* Selection Circle Badge (Top-Right) */}
                <div
                  className="absolute top-1.5 right-1.5 z-20"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelectPhoto(photo.url);
                  }}
                >
                  {isSelected ? (
                    <div className="w-6 h-6 rounded-full bg-[#00d2ff] text-slate-950 flex items-center justify-center font-bold text-xs shadow-md">
                      {selectedPhotos.length > 1 ? selectionIndex : <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-white/90 bg-black/30 backdrop-blur-xs flex items-center justify-center transition-transform hover:scale-110 shadow-sm" />
                  )}
                </div>

                {/* Quick 1-tap Send Button on bottom right of tile when hovered */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectImage(getOptimizedUrl(photo.url), { isHD });
                    onClose();
                  }}
                  className="absolute bottom-1 right-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Send photo"
                >
                  <div className="w-7 h-7 rounded-full bg-[#00d2ff] text-slate-950 flex items-center justify-center shadow-lg active:scale-90">
                    <Send className="w-3.5 h-3.5 ml-0.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Send Button Bar when photos are selected */}
      <AnimatePresence>
        {selectedPhotos.length > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className={`absolute bottom-3 right-3 z-30 flex items-center gap-2 shadow-2xl rounded-full p-1.5 ${darkMode ? "bg-zinc-900 border border-zinc-700" : "bg-white border border-gray-300"
              }`}
          >
            <span className="text-xs font-semibold px-2.5 text-gray-400">
              {selectedPhotos.length} selected
            </span>
            <button
              type="button"
              onClick={handleSendSelected}
              className="px-4 py-2 rounded-full bg-[#00d2ff] hover:bg-[#00c0eb] active:scale-95 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
