"use client";

import React, { useEffect, useLayoutEffect, useState, useRef, useMemo, useCallback, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { signInAnonymously, updateProfile } from "firebase/auth";
import {
  collection,
  query,
  limit,
  addDoc,
  serverTimestamp,
  setDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  getDocs,
  where,
  startAfter,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  useFirestore,
  useUser,
  useCollection,
  useDoc,
  useMemoFirebase,
  useAuth,
} from "@/firebase";
import { ProfileSheet } from "@/components/chat/profile-sheet";
import { useWebRTC } from "@/hooks/use-webrtc";
import { IncomingCall } from "@/components/chat/incoming-call";
import { CallScreen } from "@/components/chat/call-screen";
import { MoodCheckin, MoodBadges } from "@/components/chat/mood-checkin";
import { useViewport } from "@/hooks/use-viewport";
import { DesktopNavRail } from "@/components/chat/desktop-nav-rail";
import { ConversationListPanel } from "@/components/chat/conversation-list-panel";
import { WallpaperDialog, WallpaperConfig, DEFAULT_WALLPAPER } from "@/components/chat/wallpaper-dialog";
import { StreakModal } from "@/components/chat/streak-modal";
import { CameraModal } from "@/components/chat/camera-modal";
import { MessengerMediaPicker } from "@/components/chat/messenger-media-picker";
import {
  MessengerGalleryPicker,
  MessengerGalleryIcon,
} from "@/components/chat/messenger-gallery-picker";
import {
  DesktopMediaPicker,
  DesktopStickerPicker,
  DesktopGifPicker,
  DesktopEmojiPicker,
} from "@/components/chat/desktop-media-picker";
import {
  MobileSelectionHeader,
  MobileReactionPill,
  MobileReactionSheet,
  MessageInfoModal,
  MobileDeleteMessageModal,
} from "@/components/chat/mobile-message-interactions";
import { cn } from "@/lib/utils";
import { searchEmojis } from "@/lib/emoji-search";

import {
  ArrowLeft,
  ChevronDown,
  MoreVertical,
  Smile,
  Paperclip,
  Mic,
  Send,
  Ban,
  Check,
  CheckCheck,
  Flame,
  Phone,
  Video,
  User as UserIcon,
  Bell,
  MapPin,
  ThumbsUp,
  BellOff,
  Image as ImageIcon,
  Camera,
  Trash2,
  Copy,
  CornerUpLeft,
  Plus,
  X,
  Search,
  Gamepad2,
  Navigation,
  ChevronRight,
  Dog,
  Utensils,
  Dribbble,
  Car,
  Lightbulb,
  Hash,
  Flag,
  Home as HomeIcon,
  LayoutGrid,
  MessageCircle,
  Archive,
  Settings as SettingsIcon,
  Heart,
  Calendar,
  Edit2,
  ChevronUp,
  Loader2,
  LogOut,
  Play,
  Pause,
  Download,
  Sun,
  Moon,
  Sparkles,
  Palette,
  Volume2,
  VolumeX,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { dailyAiConversationPrompt } from "@/ai/flows/daily-ai-conversation-prompt";
import { format, isToday, isYesterday } from "date-fns";
import { signOut } from "firebase/auth";

export interface Message {
  id: string;
  senderUid?: string;
  senderName?: string;
  senderRole?: "nabin" | "karu" | string;
  sender?: "me" | "other";
  content?: string;
  text?: string;
  type?: "text" | "image" | "audio" | "video" | "gif" | "sticker";
  timestamp?: any;
  time?: string;
  status?: "sent" | "delivered" | "read" | "seen";
  waveform?: number[];
  replyToId?: string;
  replyToContent?: string;
  replyToSender?: string;
  replyToType?: "text" | "image" | "audio" | "video" | "gif" | "sticker";
  replyTo?: {
    sender: "me" | "other";
    text: string;
  };
  reactions?: string[];
  isDeleted?: boolean;
  linkPreview?: {
    title: string;
    url: string;
  };
}

const PAGE_SIZE = 50;
const SEND_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3";
const RECEIVE_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3";

const defaultReactions = ["❤️", "😆", "😮", "😢", "😚", "👍"];

const fullEmojiCategories: Record<string, string[]> = {
  "Smileys & people": ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥲", "☺️", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🥸", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👹", "👺", "🤡", "💩", "👻", "💀", "☠️", "👽", "👾", "🤖", "🎃", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾", "👋", "🤚", "🖐", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "🤲", "🤝", "🙏", "💅", "🤳", "💪", "🦾", "🦵", "🦶", "👂", "🦻", "👃", "🫀", "🫁", "🧠", "🦷", "🦴", "👀", "👁", "👅", "👄", "🫦", "💋", "🩸"],
  "Animals & nature": ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐻‍❄️", "🐨", "🐯", "🦁", "🐮", "🐷", "🐽", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🦋", "🐌", "🐞", "🐜", "🦟", "🦗", "🕷", "🦂", "🐢", "🐍", "🦎", "🦕", "🐙", "🦑", "🦐", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🦭", "🐊", "🐅", "🐆", "🦓", "🦍", "🦧", "🐘", "🦛", "🦏", "🐪", "🐫", "🦒", "🦘", "🐃", "🐂", "🐄", "🐎", "🐖", "🐏", "🐑", "🦙", "🐐", "🦌", "🐕", "🐩", "🦮", "🐈", "🐈‍⬛", "🐓", "🦃", "🦤", "🦚", "🦜", "🦢", "🦩", "🕊", "🐇", "🦝", "🦨", "🦡", "🦦", "🦥", "🐁", "🐀", "🐿", "🦔", "🌵", "🎄", "🌲", "🌳", "🌴", "🪵", "🌱", "🌿", "☘️", "🍀", "🎍", "🪴", "🎋", "🍃", "🍂", "🍁", "🪺", "🪹", "🍄", "🐚", "🪸", "🪨", "🌾", "💐", "🌷", "🌹", "🥀", "🪷", "🌺", "🌸", "🌼", "🌻", "🌞", "🌝", "🌛", "🌜", "🌚", "🌕", "🌖", "🌗", "🌘", "🌑", "🌒", "🌓", "🌔", "🌙", "🌟", "⭐", "🌠", "🌌", "☁️", "⛅", "🌤", "🌈", "🌧", "⛈", "🌩", "🌨", "❄️", "☃️", "⛄", "🌬", "💨", "💧", "💦", "🫧", "🌊", "🌫"],
  "Food & drink": ["🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶", "🫑", "🌽", "🥕", "🫒", "🧄", "🧅", "🥔", "🍠", "🥐", "🥯", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳", "🧈", "🥞", "🧇", "🥓", "🥩", "🍗", "🍖", "🌭", "🍔", "🍟", "🍕", "🫓", "🥪", "🥙", "🧆", "🌮", "🌯", "🫔", "🥗", "🥘", "🫕", "🥫", "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟", "🦪", "🍤", "🍙", "🍚", "🍘", "🍥", "🥠", "🥮", "🍢", "🍡", "🍧", "🍨", "🍦", "🥧", "🧁", "🍰", "🎂", "🍮", "🍭", "🍬", "🍫", "🍿", "🍩", "🍪", "🌰", "🥜", "🍯", "🥛", "🍼", "🫖", "☕️", "🍵", "🧃", "🥤", "🧋", "🍶", "🍺", "🍻", "🥂", "🍷", "🥃", "🍸", "🍹", "🧉", "🍾", "🧊", "🥄", "🍴", "🍽", "🥣", "🥡", "🥢", "🧂"],
  "Activity": ["⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🪃", "🥅", "⛳", "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛼", "🛷", "⛸", "🥌", "🎿", "⛷", "🏂", "🪂", "🏋️", "🤼", "🤸", "⛹", "🤺", "🤾", "🏌", "🏇", "🧘", "🏄", "🏊", "🤽", "🚣", "🧗", "🚵", "🚴", "🏆", "🥇", "🥈", "🥉", "🏅", "🎖", "🏵", "🎗", "🎫", "🎟", "🎪", "🤹", "🎭", "🎨", "🎬", "🎤", "🎧", "🎼", "🎵", "🎶", "🎹", "🥁", "🪘", "🎷", "🎺", "🪗", "🎸", "🪕", "🎻", "🎲", "♟", "🎯", "🎳", "🪄", "🎮", "🕹"],
  "Travel & places": ["🚗", "🚕", "🚙", "🚌", "🚎", "🏎", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚", "🚛", "🚜", "🏍", "🛵", "🛺", "🚲", "🛴", "🛹", "🛼", "🚏", "🛣", "🛤", "⛽", "🚨", "🚥", "🚦", "🛑", "🚧", "⚓", "🛟", "⛵", "🚤", "🛥", "🛳", "⛴", "🚢", "✈️", "🛩", "🛫", "🛬", "🪂", "💺", "🚁", "🚟", "🚠", "🚡", "🛰", "🚀", "🛸", "🌍", "🌎", "🌏", "🧭", "🗺", "🏔", "⛰", "🌋", "🗻", "🏕", "🏖", "🏜", "🏝", "🏞", "🏟", "🏛", "🏗", "🧱", "🪨", "🪵", "🛖", "🏘", "🏚", "🏠", "🏡", "🏢", "🏣", "🏤", "🏥", "🏦", "🏨", "🏩", "🏪", "🏫", "🏬", "🏭", "🏯", "🏰", "💒", "🗼", "🗽", "⛪", "🕌", "🛕", "🕍", "⛩", "🕋", "⛲", "⛺", "🌁", "🌃", "🏙", "🌄", "🌅", "🌆", "🌇", "🌉", "🎠", "🛝", "🎡", "🎢", "💈", "🎪"],
  "Objects": ["⌚", "📱", "📲", "💻", "⌨️", "🖥", "🖨", "🖱", "🖲", "🕹", "💾", "💿", "📀", "🧮", "📷", "📸", "📹", "🎥", "📽", "🎞", "📞", "☎️", "📟", "📠", "📺", "📻", "🧭", "⏱", "⏲", "⏰", "🕰", "⌛", "⏳", "📡", "🔋", "🪫", "🔌", "💡", "🔦", "🕯", "🪔", "🧯", "🛢", "💰", "🪙", "💴", "💵", "💶", "💷", "💸", "💳", "🧾", "💹", "✉️", "📧", "📨", "📩", "📤", "📥", "📦", "📫", "📪", "📬", "📭", "📮", "🗳", "✏️", "✒️", "🖋", "🖊", "📝", "📁", "📂", "🗂", "📅", "📆", "🗒", "🗓", "📇", "📈", "📉", "📊", "📋", "📌", "📍", "📎", "🖇", "📏", "📐", "✂️", "🗃", "🗄", "🗑", "🔒", "🔓", "🔏", "🔐", "🔑", "🗝", "🔨", "🪓", "⛏", "⚒", "🛠", "🗡", "⚔️", "🔫", "🪃", "🛡", "🪚", "🔧", "🪛", "🔩", "⚙️", "🗜", "⚖️", "🦯", "🔗", "⛓", "🪝", "🧲", "🪜", "⚗️", "🧪", "🧫", "🧬", "🔬", "🔭", "💊", "💉", "🩸", "🩹", "🩺", "🚪", "🪞", "🪟", "🛏", "🛋", "🪑", "🚽", "🪠", "🚿", "🛁", "🪤", "🪒", "🧴", "🧷", "🧹", "🧺", "🧻", "🪣", "🧼", "🫧", "🪥", "🧽", "🛒", "🚬", "⚰️", "🪦", "⚱️", "🧿", "🪬", "🗺", "🧸", "🪆", "🖼", "🧵", "🪡", "🧶", "🪢", "👑", "👒", "🎩", "🪖", "⛑", "💄", "💍", "💎", "📢", "📣", "📯", "🔔", "🔕"],
  "Symbols": ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "☮️", "✝️", "☪️", "🕉", "✡️", "🔯", "🪯", "☯️", "☦️", "🛐", "⛎", "♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓", "🔀", "🔁", "🔂", "▶️", "⏩", "⏭", "⏯", "◀️", "⏪", "⏮", "🔼", "⏫", "🔽", "⏬", "⏸", "⏹", "⏺", "⏏", "🎦", "🔅", "🔆", "📶", "🛜", "📳", "📴", "♀️", "♂️", "⚧", "✖", "➕", "➖", "➗", "🟰", "♾", "‼️", "⁉️", "❓", "❔", "❕", "❗", "〰️", "💱", "💲", "⚕", "♻️", "⚜", "🔱", "📛", "🔰", "⭕", "✅", "☑️", "✔️", "❌", "❎", "➰", "➿", "〽️", "✳️", "✴️", "❇️", "💠", "🔷", "🔶", "🔹", "🔸", "🔺", "🔻", "💡", "⭐", "🌟", "✨", "💫", "⚡", "🔥", "🎉", "🎊", "🎈", "🎁", "🎀", "🎗"],
  "Flags": ["🏁", "🚩", "🎌", "🏴", "🏳", "🏳️‍🌈", "🏳️‍⚧️", "🏴‍☠️", "🇦🇫", "🇦🇱", "🇩🇿", "🇦🇩", "🇦🇴", "🇦🇬", "🇦🇷", "🇦🇲", "🇦🇺", "🇦🇹", "🇦🇿", "🇧🇸", "🇧🇭", "🇧🇩", "🇧🇧", "🇧🇾", "🇧🇪", "🇧🇿", "🇧🇯", "🇧🇹", "🇧🇴", "🇧🇦", "🇧🇼", "🇧🇷", "🇧🇳", "🇧🇬", "🇧🇫", "🇧🇮", "🇨🇻", "🇰🇭", "🇨🇲", "🇨🇦", "🇨🇫", "🇹🇩", "🇨🇱", "🇨🇳", "🇨🇴", "🇰🇲", "🇨🇬", "🇨🇩", "🇨🇷", "🇨🇮", "🇭🇷", "🇨🇺", "🇨🇾", "🇨🇿", "🇩🇰", "🇩🇯", "🇩🇲", "🇩🇴", "🇪🇨", "🇪🇬", "🇸🇻", "🇬🇶", "🇪🇷", "🇪🇪", "🇸🇿", "🇪🇹", "🇫🇯", "🇫🇮", "🇫🇷", "🇬🇦", "🇬🇲", "🇬🇪", "🇩🇪", "🇬🇭", "🇬🇷", "🇬🇩", "🇬🇹", "🇬🇳", "🇬🇼", "🇬🇾", "🇭🇹", "🇭🇳", "🇭🇺", "🇮🇸", "🇮🇳", "🇮🇩", "🇮🇷", "🇮🇶", "🇮🇪", "🇮🇱", "🇮🇹", "🇯🇲", "🇯🇵", "🇯🇴", "🇰🇿", "🇰🇪", "🇰🇮", "🇰🇵", "🇰🇷", "🇰🇼", "🇰🇬", "🇱🇦", "🇱🇻", "🇱🇧", "🇱🇸", "🇱🇷", "🇱🇾", "🇱🇮", "🇱🇹", "🇱🇺", "🇲🇬", "🇲🇼", "🇲🇾", "🇲🇻", "🇲🇱", "🇲🇹", "🇲🇭", "🇲🇷", "🇲🇺", "🇲🇽", "🇫🇲", "🇲🇩", "🇲🇨", "🇲🇳", "🇲🇪", "🇲🇦", "🇲🇿", "🇲🇲", "🇳🇦", "🇳🇷", "🇳🇵", "🇳🇱", "🇳🇿", "🇳🇮", "🇳🇪", "🇳🇬", "🇳🇴", "🇴🇲", "🇵🇰", "🇵🇼", "🇵🇸", "🇵🇦", "🇵🇬", "🇵🇾", "🇵🇪", "🇵🇭", "🇵🇱", "🇵🇹", "🇶🇦", "🇷🇴", "🇷🇺", "🇷🇼", "🇰🇳", "🇱🇨", "🇻🇨", "🇼🇸", "🇸🇲", "🇸🇹", "🇸🇦", "🇸🇳", "🇷🇸", "🇸🇨", "🇸🇱", "🇸🇬", "🇸🇰", "🇸🇮", "🇸🇧", "🇸🇴", "🇿🇦", "🇸🇸", "🇪🇸", "🇱🇰", "🇸🇩", "🇸🇷", "🇸🇪", "🇨🇭", "🇸🇾", "🇹🇼", "🇹🇯", "🇹🇿", "🇹🇭", "🇹🇱", "🇹🇬", "🇹🇴", "🇹🇹", "🇹🇳", "🇹🇷", "🇹🇲", "🇹🇻", "🇺🇬", "🇺🇦", "🇦🇪", "🇬🇧", "🇺🇸", "🇺🇾", "🇺🇿", "🇻🇺", "🇻🇪", "🇻🇳", "🇾🇪", "🇿🇲", "🇿🇼", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "🏴󠁧󠁢󠁷󠁬󠁳󠁿"],
};

// Stickers — animated Google Noto emoji via CDN
const STICKER_CODES = [
  "1f970", "1f618", "1f48b", "1f496", "1f60d", "1f525", "1f917", "1f973", "1f602", "1f44f",
  "1f48e", "1f339", "1f381", "1f388", "1f48d", "1f490", "1f33a", "1f33b", "2764", "1f600",
  "1f609", "1f61c", "1f643", "1f929", "1f910", "1f920", "1f911", "1f47b", "1f984", "1f431",
  "1f436", "1f43c", "1f98b", "1f339", "1f33c", "1f308", "2728", "1f31f", "1f4a5", "1f4ab",
  "1f44d", "1f44e", "1f64c", "1f64f", "1f4aa", "1f91e", "270c", "1f91f", "1f596", "1f44b",
];
const stickers = STICKER_CODES.map(
  (code) => `https://fonts.gstatic.com/s/e/notoemoji/latest/${code}/512.gif`
);

/** Waveform visualizer & player for voice audio notes */
function ChatAudioMessage({
  src,
  isMe,
  waveform,
}: {
  src: string;
  isMe: boolean;
  waveform?: number[];
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const bars = useMemo(() => {
    if (waveform && waveform.length >= 8) {
      const max = Math.max(...waveform, 1);
      return waveform.slice(0, 24).map((w) => Math.max(0.18, w / max));
    }
    return [0.2, 0.4, 0.65, 0.85, 0.45, 0.3, 0.55, 0.9, 0.7, 0.45, 0.3, 0.6, 0.8, 0.95, 0.5, 0.35, 0.6, 0.75, 0.4, 0.25];
  }, [waveform]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch((err) => {
        console.warn("Audio playback error:", err);
      });
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const dur = audio.duration;
    if (Number.isFinite(dur) && dur > 0) {
      setProgress(Math.max(0, Math.min(1, audio.currentTime / dur)));
      setCurrentTime(audio.currentTime);
      setDuration(dur);
    } else {
      setCurrentTime(audio.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.duration === Infinity) {
      // Chrome MediaRecorder WebM duration fix: seek to end and reset to get real duration
      audio.currentTime = 1e101;
      const onSeeked = () => {
        audio.removeEventListener("timeupdate", onSeeked);
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          setDuration(audio.duration);
        }
        audio.currentTime = 0;
      };
      audio.addEventListener("timeupdate", onSeeked, { once: true });
    } else if (Number.isFinite(audio.duration) && audio.duration > 0) {
      setDuration(audio.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  };

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || isNaN(secs) || secs <= 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Duration is unknowable for WebM blobs with no duration header until fully played
  const knownDuration = Number.isFinite(duration) && duration > 0;

  return (
    <div className="flex items-center gap-2.5 py-1 min-w-[210px] sm:min-w-[240px] select-none">
      <button
        type="button"
        onClick={togglePlay}
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-all hover:scale-105 active:scale-95",
          isMe
            ? "bg-black/15 hover:bg-black/25 text-black"
            : "bg-primary/15 hover:bg-primary/25 text-primary"
        )}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform Bar Track */}
      <div
        className="flex items-center gap-[2px] flex-1 h-8 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const ratio = Math.max(0, Math.min(1, clickX / rect.width));
          const audio = audioRef.current;
          if (!audio) return;

          const effDuration = Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.duration
            : Number.isFinite(duration) && duration > 0
              ? duration
              : 0;

          if (effDuration > 0) {
            const targetTime = ratio * effDuration;
            if (Number.isFinite(targetTime) && targetTime >= 0) {
              try {
                audio.currentTime = Math.max(0, Math.min(targetTime, effDuration));
                setProgress(ratio);
              } catch (err) {
                console.warn("Could not seek audio:", err);
              }
            }
          }
        }}
      >
        {bars.map((amp, idx) => {
          const isPast = idx / bars.length <= progress;
          return (
            <div
              key={idx}
              className={cn(
                "w-[3px] rounded-full transition-all duration-75",
                isPast
                  ? isMe ? "bg-black/90" : "bg-primary"
                  : isMe ? "bg-black/25" : "bg-primary/25"
              )}
              style={{ height: `${Math.max(4, Math.round(amp * 26))}px` }}
            />
          );
        })}
      </div>

      {/* Time duration readout */}
      <span className={cn(
        "text-[10px] font-mono font-semibold shrink-0 opacity-80",
        isMe ? "text-black/80" : "text-gray-400"
      )}>
        {isPlaying
          ? formatTime(currentTime)
          : knownDuration
            ? formatTime(duration)
            : "0:00"}
      </span>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        className="hidden"
      />
    </div>
  );
}

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

function MessengerGifIcon({ className = "w-5 h-5" }: { className?: string }) {
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
      <rect x="2.5" y="4" width="19" height="16" rx="4.5" />
      <text
        x="12"
        y="15.5"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
        fontSize="8.5"
        fontWeight="800"
        fontFamily="system-ui, -apple-system, sans-serif"
        letterSpacing="-0.3px"
      >
        GIF
      </text>
    </svg>
  );
}

function getCleanMessagePreview(msg?: Message | null, fallbackName: string = "partner") {
  if (!msg) {
    return {
      type: "empty" as const,
      text: `Tap to chat with ${fallbackName}`,
    };
  }
  const content = (msg.content || msg.text || "").trim();
  const type = msg.type;

  if (
    type === "audio" ||
    content.startsWith("data:audio/") ||
    (content.startsWith("blob:http") && content.includes("audio")) ||
    ((content.includes(".mp3") || content.includes(".webm") || content.includes(".wav")) && content.length > 40)
  ) {
    return {
      type: "audio" as const,
      text: "Voice message",
    };
  }
  if (type === "image" || content.startsWith("data:image/")) {
    return {
      type: "image" as const,
      text: "Photo",
    };
  }
  if (type === "video" || content.startsWith("data:video/")) {
    return {
      type: "video" as const,
      text: "Video",
    };
  }
  if (type === "sticker") {
    return {
      type: "sticker" as const,
      text: "Sticker",
    };
  }
  if (type === "gif" || content.includes("giphy.com") || content.includes("klipy.com") || content.includes("tenor.com")) {
    return {
      type: "gif" as const,
      text: "GIF",
    };
  }
  return {
    type: "text" as const,
    text: content || "Started a conversation",
  };
}

function RenderMessageSnippet({ msg, fallbackName }: { msg?: Message | null; fallbackName: string }) {
  const preview = getCleanMessagePreview(msg, fallbackName);

  if (preview.type === "audio") {
    return (
      <span className="flex items-center gap-1.5 text-blue-500 dark:text-blue-400 font-medium">
        <Mic className="w-3.5 h-3.5 shrink-0" />
        <span>Voice message</span>
      </span>
    );
  }
  if (preview.type === "image") {
    return (
      <span className="flex items-center gap-1.5 text-pink-500 dark:text-pink-400 font-medium">
        <Camera className="w-3.5 h-3.5 shrink-0" />
        <span>Photo</span>
      </span>
    );
  }
  if (preview.type === "video") {
    return (
      <span className="flex items-center gap-1.5 text-purple-500 dark:text-purple-400 font-medium">
        <Video className="w-3.5 h-3.5 shrink-0" />
        <span>Video</span>
      </span>
    );
  }
  if (preview.type === "sticker") {
    return (
      <span className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400 font-medium">
        <Sparkles className="w-3.5 h-3.5 shrink-0" />
        <span>Sticker</span>
      </span>
    );
  }
  if (preview.type === "gif") {
    return (
      <span className="flex items-center gap-1.5 text-indigo-500 dark:text-indigo-400 font-medium">
        <span className="text-[10px] font-black uppercase tracking-wider px-1 py-0.2 rounded bg-indigo-500/15 border border-indigo-500/30">
          GIF
        </span>
        <span>GIF animation</span>
      </span>
    );
  }
  return <span className="truncate">{preview.text}</span>;
}

export default function ChatPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const auth = useAuth();
  const { user, isLoading: isAuthLoading } = useUser();
  const { toast } = useToast();

  // Viewport breakpoint state
  const { isMobile, isTablet, isDesktop, isMounted } = useViewport();

  // Screen routing within page ('main' hub or 'chat' view)
  const [currentScreen, setCurrentScreen] = useState<"main" | "chat">("chat");
  const [activeTab, setActiveTab] = useState("chat");
  const [selectedConversation, setSelectedConversation] = useState<string | null>("karu");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "light") {
        setDarkMode(false);
        document.documentElement.classList.remove("dark");
      } else {
        setDarkMode(true);
        document.documentElement.classList.add("dark");
      }
    } catch {
      setDarkMode(true);
    }
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("theme", next ? "dark" : "light");
        if (next) document.documentElement.classList.add("dark");
        else document.documentElement.classList.remove("dark");
      } catch { }
      return next;
    });
  };

  const c = (light: string, dark: string) => (darkMode ? dark : light);

  // Identity state
  const [myId, setMyId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("duonexus_role") || "nabin";
    }
    return "nabin";
  });

  useEffect(() => {
    if (isAuthLoading) return;
    const role = typeof window !== "undefined" ? localStorage.getItem("duonexus_role") : null;

    if (!user) {
      if (role && auth) {
        signInAnonymously(auth)
          .then(async (cred) => {
            const displayName = role === "nabin" ? "Nabin" : "Karu";
            const photoURL = role === "nabin" ? "/avatars/nabin.png" : "/avatars/karu.png";
            await updateProfile(cred.user, { displayName, photoURL });
            setMyId(role);
          })
          .catch((err) => {
            console.error("Silent authentication failed:", err);
            router.push("/login");
          });
      } else {
        router.push("/login");
      }
    } else if (role) {
      setMyId(role);
    }
  }, [isAuthLoading, user, router, auth]);

  const partnerId = useMemo(() => {
    if (!myId) return "karu";
    return myId === "nabin" ? "karu" : "nabin";
  }, [myId]);

  const partnerName = partnerId
    ? partnerId.charAt(0).toUpperCase() + partnerId.slice(1)
    : "Partner";
  const myName =
    user?.displayName || (myId ? myId.charAt(0).toUpperCase() + myId.slice(1) : "Me");

  // Audio elements
  const sendAudioRef = useRef<HTMLAudioElement | null>(null);
  const receiveAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    sendAudioRef.current = new Audio(SEND_SOUND_URL);
    receiveAudioRef.current = new Audio(RECEIVE_SOUND_URL);
  }, []);

  // PRESENCE
  useEffect(() => {
    if (!firestore || !myId || !user) return;
    const userPresenceRef = doc(firestore, "presence", myId);
    const setOnlineStatus = (online: boolean) => {
      setDoc(userPresenceRef, { online, lastSeen: serverTimestamp() }, { merge: true }).catch(() => { });
    };
    setOnlineStatus(true);
    const handleVisibilityChange = () => setOnlineStatus(document.visibilityState === "visible");
    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", () => setOnlineStatus(true));
    window.addEventListener("blur", () => setOnlineStatus(false));
    window.addEventListener("beforeunload", () => setOnlineStatus(false));
    return () => {
      setOnlineStatus(false);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [firestore, myId, user]);

  // READ RECEIPTS — write when chat screen is open
  const [partnerLastSeenAt, setPartnerLastSeenAt] = useState<number>(0);

  // Write my lastSeenAt whenever I'm in the chat view
  useEffect(() => {
    const isChatActive = (!isMobile && selectedConversation === "karu" && activeTab === "chat") || (isMobile && currentScreen === "chat");
    if (!firestore || !myId || !isChatActive || !user) return;
    const ref = doc(firestore, "readReceipts", myId);
    setDoc(ref, { lastSeenAt: serverTimestamp() }, { merge: true }).catch(() => { });
    // Also refresh every 30s while chat is open
    const interval = setInterval(() => {
      setDoc(ref, { lastSeenAt: serverTimestamp() }, { merge: true }).catch(() => { });
    }, 30000);
    return () => clearInterval(interval);
  }, [firestore, myId, currentScreen, isMobile, selectedConversation, activeTab, user]);

  // Listen to partner's readReceipts
  useEffect(() => {
    if (!firestore || !partnerId || !user) return;
    const ref = doc(firestore, "readReceipts", partnerId);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data();
      if (data?.lastSeenAt) {
        const ms = data.lastSeenAt?.toMillis?.() ?? (data.lastSeenAt?.seconds ?? 0) * 1000;
        setPartnerLastSeenAt(ms);
      }
    }, (err) => {
      console.warn("readReceipts snapshot error:", err);
    });
    return () => unsub();
  }, [firestore, partnerId, user]);

  // Helper: compute real message status
  const getMessageStatus = (msg: Message): "sent" | "delivered" | "seen" => {
    const msgTs = msg.timestamp?.toMillis?.() ?? (msg.timestamp?.seconds ?? 0) * 1000;
    if (partnerLastSeenAt && msgTs && partnerLastSeenAt >= msgTs) return "seen";
    if (partnerPresence?.online) return "delivered";
    return msg.status === "delivered" || msg.status === "seen" ? msg.status : "sent";
  };

  // Partner presence listener
  const partnerPresenceRef = useMemoFirebase(() => {
    if (!firestore || !partnerId || !user) return null;
    return doc(firestore, "presence", partnerId);
  }, [firestore, partnerId, user]);
  const { data: partnerPresence } = useDoc(partnerPresenceRef);

  // Partner Profile
  const partnerProfileRef = useMemoFirebase(() => {
    if (!firestore || !partnerId || !user) return null;
    return doc(firestore, "profiles", partnerId);
  }, [firestore, partnerId, user]);
  const { data: partnerProfile } = useDoc(partnerProfileRef);

  // My Profile
  const myProfileRef = useMemoFirebase(() => {
    if (!firestore || !myId || !user) return null;
    return doc(firestore, "profiles", myId);
  }, [firestore, myId, user]);
  const { data: myProfile } = useDoc(myProfileRef);

  const finalMyName =
    myProfile?.displayName ||
    user?.displayName ||
    (myId ? myId.charAt(0).toUpperCase() + myId.slice(1) : "Me");

  const myAvatar =
    (myProfile?.photoURL && !myProfile.photoURL.startsWith("data:"))
      ? myProfile.photoURL
      : (user?.photoURL && !user.photoURL.startsWith("data:") ? user.photoURL : undefined) ||
      (myId === "karu" ? "/avatars/karu.png" : "/avatars/nabin.png");

  const partnerAvatar =
    (partnerProfile?.photoURL && !partnerProfile.photoURL.startsWith("data:"))
      ? partnerProfile.photoURL
      : (partnerId === "karu" ? "/avatars/karu.png" : "/avatars/nabin.png");

  const finalPartnerName = partnerProfile?.displayName || partnerName;

  // Wallpaper state & config
  const [isWallpaperModalOpen, setIsWallpaperModalOpen] = useState(false);
  const [wallpaperConfig, setWallpaperConfig] = useState<WallpaperConfig>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("duonexus_chat_wallpaper");
        if (saved) {
          const parsed = JSON.parse(saved);
          const isV2 = localStorage.getItem("duonexus_wallpaper_v2");
          return {
            ...DEFAULT_WALLPAPER,
            ...parsed,
            fit: isV2 ? (parsed.fit || "smart") : "smart",
          };
        }
      } catch { }
    }
    return DEFAULT_WALLPAPER;
  });

  const handleSaveWallpaper = (config: WallpaperConfig) => {
    setWallpaperConfig(config);
    try {
      localStorage.setItem("duonexus_chat_wallpaper", JSON.stringify(config));
      localStorage.setItem("duonexus_wallpaper_v2", "true");
    } catch { }
    if (firestore && myId) {
      setDoc(doc(firestore, "profiles", myId), { chatWallpaper: config }, { merge: true }).catch(() => { });
    }
    toast({
      title: "Wallpaper Applied 💕",
      description: "Your chat background has been updated!",
    });
  };

  // Streak state
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);

  // Relationship Stats (streak)
  const statsDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "global_stats", "relationship");
  }, [firestore, user]);
  const { data: globalStats } = useDoc(statsDocRef);

  // Real-time Firestore Messages
  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "messages"),
      orderBy("timestamp", "desc"),
      limit(PAGE_SIZE)
    );
  }, [firestore, user]);

  const { data: rawMessages, loading: messagesLoading } = useCollection(messagesQuery);

  // "Delete for me" version counter — must be declared BEFORE messages useMemo that reads it
  const [hiddenMsgVersion, setHiddenMsgVersion] = useState(0);

  const messages = useMemo(() => {
    if (!rawMessages) return [];
    // Filter out messages hidden for current user ("delete for me" feature)
    const hiddenKey = `hidden_msgs_${myId}`;
    let hiddenIds: string[] = [];
    try {
      hiddenIds = JSON.parse(localStorage.getItem(hiddenKey) || "[]");
    } catch { hiddenIds = []; }
    return [...rawMessages]
      .filter((m: any) => {
        if (hiddenIds.includes(m.id)) return false;
        // If message is deleted/unsent and was sent by me, deleted by me, or belongs to my account, hide completely for this user
        if (m.isDeleted && (m.senderRole === myId || m.senderUid === user?.uid || m.deletedBy === myId)) {
          return false;
        }
        return true;
      })
      .sort((a: any, b: any) => {
        const tA = (a.timestamp?.toMillis?.() ?? (a.timestamp?.seconds ?? 0) * 1000) || Date.now();
        const tB = (b.timestamp?.toMillis?.() ?? (b.timestamp?.seconds ?? 0) * 1000) || Date.now();
        return tA - tB;
      }) as Message[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawMessages, myId, user?.uid, hiddenMsgVersion]);

  // Real Streak Calculation from messages & Firestore
  const { realStreak, longestStreak, chattedToday } = useMemo(() => {
    const savedStreak = typeof globalStats?.streak === "number" ? globalStats.streak : 12;
    const savedLongest = typeof globalStats?.longestStreak === "number" ? globalStats.longestStreak : savedStreak;
    const todayStr = format(new Date(), "yyyy-MM-dd");

    // Check if there are messages today
    const hasMessageToday = messages.some((m) => {
      const ms = m.timestamp?.seconds ? m.timestamp.seconds * 1000 : m.timestamp?.toMillis ? m.timestamp.toMillis() : 0;
      return ms > 0 && format(new Date(ms), "yyyy-MM-dd") === todayStr;
    });

    return {
      realStreak: Math.max(1, savedStreak),
      longestStreak: Math.max(savedLongest, savedStreak),
      chattedToday: hasMessageToday,
    };
  }, [messages, globalStats]);

  const streak = realStreak;

  const handleUpdateStreak = async (newStreak: number) => {
    if (!firestore) return;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    await setDoc(
      doc(firestore, "global_stats", "relationship"),
      {
        streak: newStreak,
        longestStreak: Math.max(newStreak, globalStats?.longestStreak || newStreak),
        lastChatDate: todayStr,
        lastUpdated: serverTimestamp(),
      },
      { merge: true }
    );
    toast({
      title: "Streak Updated 🔥",
      description: `Love streak is now set to ${newStreak} days strong!`,
    });
  };

  // Notifications & User Preferences State
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("duonexus_sound_effects");
      return stored !== null ? stored === "true" : true;
    }
    return true;
  });
  const [vibrationEnabled, setVibrationEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("duonexus_vibration");
      return stored !== null ? stored === "true" : true;
    }
    return true;
  });
  const [hdDefaultEnabled, setHdDefaultEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("duonexus_hd_default");
      return stored !== null ? stored === "true" : false;
    }
    return false;
  });
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("duonexus_read_receipts");
      return stored !== null ? stored === "true" : true;
    }
    return true;
  });

  const handleToggleNotifications = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    try {
      localStorage.setItem("duonexus_notifications", String(enabled));
    } catch {}

    if (enabled) {
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "default") {
          const perm = await Notification.requestPermission();
          if (perm === "granted") {
            toast({
              title: "Notifications Enabled 🔔",
              description: "You will receive alerts when your partner sends a message.",
            });
            try {
              new Notification("DuoNexus", {
                body: "Notifications are now active for your chat! 💕",
                icon: partnerAvatar || "/favicon.ico",
              });
            } catch {}
          } else {
            toast({
              title: "Permission Blocked",
              description: "Please allow notifications in your browser settings to get alerts.",
              variant: "destructive",
            });
          }
        } else if (Notification.permission === "granted") {
          toast({
            title: "Notifications Active 🔔",
            description: "Alerts enabled for all incoming messages.",
          });
          try {
            new Notification("DuoNexus", {
              body: "Notifications are now active for your chat! 💕",
              icon: partnerAvatar || "/favicon.ico",
            });
          } catch {}
        } else {
          toast({
            title: "Browser Permission Denied",
            description: "Please enable notifications for this site in your browser site settings.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "In-App Alerts Active",
          description: "Sound and visual alerts enabled.",
        });
      }
    } else {
      toast({
        title: "Notifications Muted 🔕",
        description: "You will not receive push or sound notifications.",
      });
    }
  };

  const lastMessageIdRef = useRef<string | null>(null);

  // Sound & Native notification
  useEffect(() => {
    if (messages.length === 0) return;
    const latest = messages[messages.length - 1];
    if (latest.id !== lastMessageIdRef.current) {
      const isLatestMe = latest.senderRole ? latest.senderRole === myId : latest.senderUid === user?.uid;
      if (!isLatestMe) {
        // Play receive sound if notifications and sound effects are enabled
        if (notificationsEnabled && soundEffectsEnabled) {
          receiveAudioRef.current?.play().catch(() => { });
        }
        // Vibrate mobile device if enabled
        if (vibrationEnabled && typeof navigator !== "undefined" && navigator.vibrate) {
          try {
            navigator.vibrate([100, 50, 100]);
          } catch { }
        }
        // Native system browser push notification when away or tab is backgrounded
        if (
          notificationsEnabled &&
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted" &&
          (document.visibilityState !== "visible" || !document.hasFocus())
        ) {
          try {
            const bodyPreview =
              latest.type === "image" ? "📷 Sent a photo" :
              latest.type === "video" ? "🎥 Sent a video" :
              latest.type === "audio" ? "🎙️ Sent a voice note" :
              latest.type === "sticker" ? "🎭 Sent a sticker" :
              latest.type === "gif" ? "✨ Sent a GIF" :
              (latest.text || latest.content || "New message 💕");

            const notif = new Notification(finalPartnerName || "DuoNexus", {
              body: bodyPreview,
              icon: partnerAvatar || "/favicon.ico",
              tag: "duonexus-chat-msg",
            });
            notif.onclick = () => {
              window.focus();
              notif.close();
            };
          } catch (e) {
            console.log("Notification trigger error:", e);
          }
        }
      }
      lastMessageIdRef.current = latest.id;
    }
  }, [messages, myId, user, notificationsEnabled, soundEffectsEnabled, vibrationEnabled, finalPartnerName, partnerAvatar]);

  // Input & Reply & Attachment State
  const [inputText, setInputText] = useState("");
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showInputEmojiPicker, setShowInputEmojiPicker] = useState(false);
  const [showMobileGallery, setShowMobileGallery] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [mediaPickerInitialTab, setMediaPickerInitialTab] = useState<"stickers" | "gifs" | "emojis">("emojis");

  // Photos from chat messages for mobile gallery
  const chatPhotos = useMemo(() => {
    if (!messages) return [];
    return messages
      .filter((m: any) => m.type === "image" && m.content)
      .map((m: any) => m.content as string);
  }, [messages]);
  // Mobile: show/hide the left action icons when typing (collapsed by default when typing)
  const [showMobileLeftIcons, setShowMobileLeftIcons] = useState(false);
  // Dedicated desktop popups anchored to their specific icons
  const [activeDesktopPopup, setActiveDesktopPopup] = useState<"stickers" | "gifs" | "emojis" | null>(null);
  // Quick reaction emoji (defaults to Kiss '😘' as requested)
  const [quickReactionEmoji, setQuickReactionEmoji] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("duonexus_quick_emoji") || "😘";
      } catch { }
    }
    return "😘";
  });
  const [isQuickEmojiModalOpen, setIsQuickEmojiModalOpen] = useState(false);
  // Temp state for quick emoji picker — only committed on "Done"
  const [tempQuickEmoji, setTempQuickEmoji] = useState<string>("😘");
  const [showMenu, setShowMenu] = useState(false);
  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null);
  const [activeReactionMenu, setActiveReactionMenu] = useState<string | null>(null);
  const [activeFullEmojiPicker, setActiveFullEmojiPicker] = useState<string | null>(null);
  const [menuPlacement, setMenuPlacement] = useState<"up" | "down">("up");
  const [touchedMessageId, setTouchedMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  // Mobile WhatsApp-style selection, reactions & message info
  const [selectedMobileMessage, setSelectedMobileMessage] = useState<Message | null>(null);
  const [isMobileReactionSheetOpen, setIsMobileReactionSheetOpen] = useState(false);
  const [selectedInfoMessage, setSelectedInfoMessage] = useState<Message | null>(null);
  const [mobileDeleteMessage, setMobileDeleteMessage] = useState<Message | null>(null);

  // Real Firestore typing state & listeners
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const myTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Tracks whether user was near bottom before their own send (for smart auto-scroll)
  const lastSendWasMe = useRef(false);

  // Listen to partner's real typing status in Firestore
  useEffect(() => {
    if (!firestore || !partnerId || !user) return;
    const unsub = onSnapshot(doc(firestore, "typing", partnerId), (snap) => {
      const data = snap.data();
      if (!data) {
        setOtherIsTyping(false);
        return;
      }
      const lastTypedMs =
        data.lastTyped?.toMillis?.() ?? (data.lastTyped?.seconds ? data.lastTyped.seconds * 1000 : 0);
      const isRecent = Date.now() - lastTypedMs < 4000;
      setOtherIsTyping(Boolean(data.isTyping && isRecent));
    }, (err) => {
      console.warn("typing listener error:", err);
    });
    return () => unsub();
  }, [firestore, partnerId, user]);

  const notifyMyTyping = useCallback(() => {
    if (!firestore || !myId) return;
    setDoc(doc(firestore, "typing", myId), { isTyping: true, lastTyped: serverTimestamp() }, { merge: true }).catch(() => { });
    if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);
    myTypingTimeoutRef.current = setTimeout(() => {
      if (firestore && myId) {
        setDoc(doc(firestore, "typing", myId), { isTyping: false }, { merge: true }).catch(() => { });
      }
    }, 2800);
  }, [firestore, myId]);

  const stopMyTyping = useCallback(() => {
    if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);
    if (firestore && myId) {
      setDoc(doc(firestore, "typing", myId), { isTyping: false }, { merge: true }).catch(() => { });
    }
  }, [firestore, myId]);

  const handleInsertEmoji = (emoji: string) => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      const text = input.value;
      const nextText = text.slice(0, start) + emoji + text.slice(end);
      setInputText(nextText);
      const newPos = start + emoji.length;
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.selectionStart = newPos;
          inputRef.current.selectionEnd = newPos;
        }
      });
    } else {
      setInputText((prev) => prev + emoji);
    }
  };

  const handleBackspace = () => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      const text = input.value;
      if (start === end && start > 0) {
        const before = text.slice(0, start);
        const after = text.slice(end);
        const glyphs = Array.from(before);
        glyphs.pop();
        const newBefore = glyphs.join("");
        setInputText(newBefore + after);
        const newPos = newBefore.length;
        requestAnimationFrame(() => {
          if (inputRef.current) {
            inputRef.current.selectionStart = newPos;
            inputRef.current.selectionEnd = newPos;
          }
        });
      } else if (start !== end) {
        const before = text.slice(0, start);
        const after = text.slice(end);
        setInputText(before + after);
        requestAnimationFrame(() => {
          if (inputRef.current) {
            inputRef.current.selectionStart = start;
            inputRef.current.selectionEnd = start;
          }
        });
      }
    } else {
      setInputText((prev) => {
        const glyphs = Array.from(prev);
        glyphs.pop();
        return glyphs.join("");
      });
    }
  };


  // Messenger-style reaction details state
  const [viewingReactionsMsg, setViewingReactionsMsg] = useState<Message | null>(null);
  const [reactionDetailFilter, setReactionDetailFilter] = useState<string>("all");

  // Quick reactions
  const [quickReactions, setQuickReactions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("customReactions");
      return saved ? JSON.parse(saved) : defaultReactions;
    } catch {
      return defaultReactions;
    }
  });
  const [showReactionCustomizer, setShowReactionCustomizer] = useState(false);
  const [tempReactions, setTempReactions] = useState<string[]>([...quickReactions]);
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const emojiPalette = ["❤️", "😂", "😮", "😢", "🙏", "👍", "🤣", "🥰", "😍", "😒", "😭", "🔥", "😊", "😎", "😡", "🤯", "💀", "👀", "💯", "✨", "🎉", "💩", "💔", "🤔"];

  // Search in conversation
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [emojiSearchQuery, setEmojiSearchQuery] = useState("");
  // Emoji picker tabs (emoji categories + sticker)
  const emojiCategoryKeys = Object.keys(fullEmojiCategories);
  const [emojiPickerTab, setEmojiPickerTab] = useState<"emoji" | "sticker">("emoji");
  const [emojiActiveCategory, setEmojiActiveCategory] = useState<string>(emojiCategoryKeys[0]);

  // Tab icon mapping for bottom bar
  const emojiTabIcons: { key: string; label: string; icon: React.ReactNode }[] = [
    { key: "Smileys & people", label: "Smileys", icon: <Smile className="w-[18px] h-[18px]" /> },
    { key: "Animals & nature", label: "Animals", icon: <Dog className="w-[18px] h-[18px]" /> },
    { key: "Food & drink", label: "Food", icon: <Utensils className="w-[18px] h-[18px]" /> },
    { key: "Activity", label: "Activity", icon: <Dribbble className="w-[18px] h-[18px]" /> },
    { key: "Travel & places", label: "Travel", icon: <Car className="w-[18px] h-[18px]" /> },
    { key: "Objects", label: "Objects", icon: <Lightbulb className="w-[18px] h-[18px]" /> },
    { key: "Symbols", label: "Symbols", icon: <Hash className="w-[18px] h-[18px]" /> },
    { key: "Flags", label: "Flags", icon: <Flag className="w-[18px] h-[18px]" /> },
  ];

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 200);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Floating scroll-to-bottom state
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // Live camera modal state
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);

  // Messenger emoji reaction customizer state
  const [isCustomizingReactions, setIsCustomizingReactions] = useState(false);
  const [selectedCustomizeSlot, setSelectedCustomizeSlot] = useState<number>(0);

  const handleMessagesScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isUp = el.scrollHeight - el.scrollTop - el.clientHeight > 150;
    setShowScrollToBottom((prev) => (prev !== isUp ? isUp : prev));
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: "end" });
    }
    setShowScrollToBottom(false);
  }, []);

  // Scroll to bottom immediately on first mount (fixes refresh scroll position)
  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Scroll to bottom when messages first load after mount
  const hasScrolledOnLoad = useRef(false);
  useEffect(() => {
    if (!hasScrolledOnLoad.current && messages.length > 0 && !messagesLoading) {
      hasScrolledOnLoad.current = true;
      scrollToBottom("auto");
    }
  }, [messages, messagesLoading, scrollToBottom]);

  // Auto-scroll on new message or typing indicator
  // Only force-scroll if the user is already near the bottom, OR if their own message was just sent
  useEffect(() => {
    if (messages.length === 0) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNearBottom = distanceFromBottom < 200;
    if (isNearBottom || lastSendWasMe.current) {
      scrollToBottom("smooth");
      lastSendWasMe.current = false;
    }
  }, [messages, otherIsTyping, scrollToBottom]);

  // Scroll to bottom when switching back to chat view (e.g. Memories -> Chats or Desktop tab switch)
  useEffect(() => {
    const isChatActive =
      (!isMobile && activeTab === "chat" && selectedConversation === "karu") ||
      (isMobile && currentScreen === "chat");

    if (isChatActive) {
      scrollToBottom("auto");
      const raf = requestAnimationFrame(() => {
        scrollToBottom("auto");
      });
      const timer1 = setTimeout(() => {
        scrollToBottom("auto");
      }, 50);
      const timer2 = setTimeout(() => {
        scrollToBottom("auto");
      }, 150);

      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [activeTab, selectedConversation, currentScreen, isMobile, scrollToBottom]);

  // Sending message
  const handleSendMessage = async (
    content: string,
    type: "text" | "image" | "audio" | "video" | "gif" | "sticker" = "text",
    waveform?: number[]
  ) => {
    if (!firestore || (!content.trim() && type === "text")) return;

    // Detect link preview (ONLY for standard text, never for stickers, gifs, or media)
    let linkPreview: { title: string; url: string } | undefined = undefined;
    if (type === "text" && !content.includes("notoemoji") && !content.includes("gstatic.com")) {
      const urlMatch = content.match(/(https?:\/\/[^\s]+)/i);
      if (urlMatch) {
        try {
          const u = new URL(urlMatch[0]);
          linkPreview = {
            title: u.hostname.replace("www.", ""),
            url: u.hostname,
          };
        } catch { }
      }
    }

    try {
      sendAudioRef.current?.play().catch(() => { });

      const newMsgData: any = {
        senderUid: user?.uid || myId,
        senderName: myName,
        senderRole: myId,
        content: content.trim(),
        text: content.trim(),
        type,
        timestamp: serverTimestamp(),
        status: "sent",
        reactions: [],
      };

      if (waveform) newMsgData.waveform = waveform;
      if (linkPreview) newMsgData.linkPreview = linkPreview;

      if (replyingTo) {
        newMsgData.replyToId = replyingTo.id;
        const cleanReplyText = getCleanMessagePreview(replyingTo, finalPartnerName).text;
        newMsgData.replyToContent = cleanReplyText;
        newMsgData.replyToSender =
          replyingTo.senderRole === myId ? myName : finalPartnerName;
        newMsgData.replyToType = replyingTo.type || "text";
        newMsgData.replyTo = {
          sender: replyingTo.senderRole === myId ? "me" : "other",
          text: cleanReplyText,
        };
      }

      await addDoc(collection(firestore, "messages"), newMsgData);
      setInputText("");
      setReplyingTo(null);
      stopMyTyping();
      setActiveDesktopPopup(null);
      setShowInputEmojiPicker(false);
      setShowMobileLeftIcons(false);
      lastSendWasMe.current = true;

      // Auto-update real streak in Firestore (TikTok-style daily tracking)
      try {
        const todayStr = format(new Date(), "yyyy-MM-dd");
        const yesterdayStr = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");
        const lastChatDate = globalStats?.lastChatDate;
        let nextStreak = typeof globalStats?.streak === "number" ? globalStats.streak : realStreak;

        if (lastChatDate === yesterdayStr) {
          nextStreak += 1;
        } else if (lastChatDate === todayStr) {
          // already incremented today - keep streak safe
        } else if (!lastChatDate) {
          nextStreak = Math.max(1, nextStreak);
        } else {
          // Missed 1 or more days! Streak breaks and resets to 1
          nextStreak = 1;
        }

        const nextLongest = Math.max(nextStreak, globalStats?.longestStreak || nextStreak);
        await setDoc(
          doc(firestore, "global_stats", "relationship"),
          {
            streak: nextStreak,
            lastChatDate: todayStr,
            longestStreak: nextLongest,
            lastUpdated: serverTimestamp(),
          },
          { merge: true }
        );

        // Surprise Milestone Celebratory Alert
        if ([3, 7, 15, 30, 50, 100].includes(nextStreak) && lastChatDate === yesterdayStr) {
          toast({
            title: `🎉 ${nextStreak} Days Milestone Reached! 🔥`,
            description: "You unlocked a secret couple surprise voucher in Streak Hub!",
          });
        }
      } catch (e) {
        console.error("Streak sync error:", e);
      }

    } catch (err) {
      console.error("Failed to send message:", err);
      toast({ variant: "destructive", title: "Message not sent", description: "Please check your network." });
    }
  };

  const handleSendForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    handleSendMessage(inputText, "text");
  };

  const handleSendQuickLike = () => {
    handleSendMessage(quickReactionEmoji, "text");
  };

  const handleSetQuickReactionEmoji = async (emoji: string) => {
    setQuickReactionEmoji(emoji);
    try {
      localStorage.setItem("duonexus_quick_emoji", emoji);
    } catch { }
    if (firestore) {
      try {
        await setDoc(
          doc(firestore, "global_stats", "relationship"),
          { quickEmoji: emoji },
          { merge: true }
        );
      } catch (err) {
        console.warn("Failed to sync quick emoji:", err);
      }
    }
    toast({
      title: `Quick Reaction set to ${emoji} 💕`,
      description: "Tap the reaction icon anytime to send!",
    });
    setIsQuickEmojiModalOpen(false);
  };

  const handleSendLocation = () => {
    setShowPlusMenu(false);
    if (typeof window === "undefined" || !navigator.geolocation) {
      toast({ title: "Location unavailable", description: "Geolocation not supported by your browser." });
      return;
    }
    toast({ title: "Sharing location... 📍", description: "Fetching your current GPS position." });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const mapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
        handleSendMessage(`📍 Shared Location: ${mapsUrl}`, "text");
      },
      (err) => {
        console.warn("Location error:", err);
        toast({ variant: "destructive", title: "Location Denied", description: "Unable to retrieve your location. Please check browser permissions." });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Messenger-style reaction handler (records user, name, avatar, emoji)
  const handleReact = async (id: string, emoji: string) => {
    if (!firestore || !myId) return;
    const msg = messages.find((m) => m.id === id);
    if (!msg) return;

    const currentMap: Record<string, { emoji: string; name: string; avatar?: string; timestamp?: number }> =
      (msg as any).reactionsMap || {};
    const newMap = { ...currentMap };

    // Toggle: if I already reacted with THIS emoji, remove it; otherwise set/update
    if (newMap[myId]?.emoji === emoji) {
      delete newMap[myId];
    } else {
      newMap[myId] = {
        emoji,
        name: myName || (myId === "karu" ? "Karu" : "Nabin"),
        avatar: myAvatar || (myId === "karu" ? "/avatars/karu.png" : "/avatars/nabin.png"),
        timestamp: Date.now(),
      };
    }

    const updatedReactions = Object.values(newMap).map((r) => r.emoji);

    try {
      await updateDoc(doc(firestore, "messages", id), {
        reactionsMap: newMap,
        reactions: updatedReactions,
      });
    } catch (e) {
      console.error("Failed to update reaction with updateDoc, trying setDoc merge:", e);
      try {
        await setDoc(
          doc(firestore, "messages", id),
          {
            reactionsMap: newMap,
            reactions: updatedReactions,
          },
          { merge: true }
        );
      } catch (err2) {
        console.error("Failed to update reaction completely:", err2);
      }
    }

    setActiveReactionMenu(null);
    setActiveFullEmojiPicker(null);
  };

  const handleSaveReactions = () => {
    setQuickReactions(tempReactions);
    localStorage.setItem("customReactions", JSON.stringify(tempReactions));
    setShowReactionCustomizer(false);
  };

  // Message Actions
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => {
      setCopiedMessageId(null);
      setActiveMessageMenu(null);
    }, 2000);
  };

  const handleDeleteForEveryone = async (id: string) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, "messages", id), {
        content: "This message was unsent",
        text: "This message was unsent",
        isDeleted: true,
        deletedBy: myId,
        type: "text", // change type to text so media players/img tags are not rendered
      });
    } catch {
      await deleteDoc(doc(firestore, "messages", id));
    }
    setActiveMessageMenu(null);
  };

  const handleDeleteForMe = (id: string) => {
    // Store hidden message IDs in localStorage per user (client-side only "delete for me")
    try {
      const hiddenKey = `hidden_msgs_${myId}`;
      const existing: string[] = JSON.parse(localStorage.getItem(hiddenKey) || "[]");
      if (!existing.includes(id)) {
        existing.push(id);
        localStorage.setItem(hiddenKey, JSON.stringify(existing));
      }
    } catch { }
    // Increment version to force messages useMemo to recompute and hide this message
    setHiddenMsgVersion((v) => v + 1);
    setActiveMessageMenu(null);
  };

  // File / Camera Upload - processes selected files from native device gallery
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const isVideo = file.type.startsWith("video/");
        const isImage = file.type.startsWith("image/");
        const msgType = isVideo ? "video" : isImage ? "image" : "text";

        await handleSendMessage(dataUrl, msgType);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  // Audio Voice Recording State
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveWaveform, setLiveWaveform] = useState<number[]>([8, 14, 22, 16, 10, 20, 24, 14, 8, 18, 12, 16]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSimulatedAudioRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const startWaveformVisuals = () => {
    const loop = () => {
      if (analyserRef.current) {
        const freqData = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(freqData);
        const step = Math.max(1, Math.floor(freqData.length / 12));
        const sampled = Array.from({ length: 12 }, (_, i) => {
          const val = freqData[i * step] || 0;
          return Math.max(4, Math.round((val / 255) * 26));
        });
        setLiveWaveform(sampled);
      } else {
        // Natural pulsing wave
        setLiveWaveform(Array.from({ length: 12 }, () => Math.floor(Math.random() * 18 + 5)));
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
  };

  const startAudioRecording = async () => {
    try {
      audioChunksRef.current = [];
      setIsRecordingAudio(true);
      setRecordingSeconds(0);
      isSimulatedAudioRef.current = false;

      if (audioTimerRef.current) clearInterval(audioTimerRef.current);
      audioTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone API not available");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      // Real AudioContext analyser for live waveform
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          audioCtxRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;
        }
      } catch (e) {
        console.warn("AudioContext setup:", e);
      }

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const recordedBlob = new Blob(audioChunksRef.current, {
          type: mimeType || "audio/webm",
        });

        // Cleanup audio stream tracks
        stream.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;

        if (audioChunksRef.current.length > 0) {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const dataUrl = reader.result as string;
            const dummyWaveform = Array.from({ length: 24 }, () =>
              Math.floor(Math.random() * 20 + 8)
            );
            await handleSendMessage(dataUrl, "audio", dummyWaveform);
          };
          reader.readAsDataURL(recordedBlob);
        }
      };

      recorder.start(100);
      startWaveformVisuals();
    } catch (err: any) {
      console.warn("Direct mic unavailable, using simulated voice recording:", err);
      isSimulatedAudioRef.current = true;
      setIsRecordingAudio(true);
      startWaveformVisuals();
      toast({
        title: "Voice Recording Started 🎙️",
        description: "Recording audio note. Tap send when finished!",
      });
    }
  };

  const stopAndSendAudioRecording = () => {
    if (audioTimerRef.current) clearInterval(audioTimerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => { });
      audioCtxRef.current = null;
    }

    if (isSimulatedAudioRef.current) {
      // Create valid audible tone WAV so playback works even without a physical mic
      try {
        const sampleRate = 16000;
        const dur = Math.max(1, recordingSeconds || 2);
        const numSamples = sampleRate * dur;
        const buffer = new ArrayBuffer(44 + numSamples * 2);
        const view = new DataView(buffer);

        const writeStr = (offset: number, str: string) => {
          for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
        };
        writeStr(0, "RIFF");
        view.setUint32(4, 36 + numSamples * 2, true);
        writeStr(8, "WAVE");
        writeStr(12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeStr(36, "data");
        view.setUint32(40, numSamples * 2, true);

        for (let i = 0; i < numSamples; i++) {
          const t = i / sampleRate;
          const sample = Math.sin(2 * Math.PI * 260 * t) * 0.2 + Math.sin(2 * Math.PI * 520 * t) * 0.08;
          view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        }

        const blob = new Blob([buffer], { type: "audio/wav" });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = reader.result as string;
          const dummyWaveform = Array.from({ length: 24 }, () => Math.floor(Math.random() * 20 + 8));
          await handleSendMessage(dataUrl, "audio", dummyWaveform);
        };
        reader.readAsDataURL(blob);
      } catch (e) {
        console.error("Simulation tone failed:", e);
      }
      setIsRecordingAudio(false);
      setRecordingSeconds(0);
      return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingAudio(false);
  };

  const cancelAudioRecording = () => {
    if (audioTimerRef.current) clearInterval(audioTimerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => { });
      audioCtxRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    audioChunksRef.current = [];
    isSimulatedAudioRef.current = false;
    setIsRecordingAudio(false);
    setRecordingSeconds(0);
  };

  // Scroll to search match or replied message
  const scrollToMessage = (id: string) => {
    setIsSearching(false);
    setSearchQuery("");
    setDebouncedSearchQuery("");

    setTimeout(() => {
      const el = document.getElementById(`msg-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add(
          "ring-2",
          "ring-primary",
          "bg-primary/20",
          "transition-all",
          "duration-500",
          "rounded-2xl"
        );
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-primary", "bg-primary/20", "rounded-2xl");
        }, 2000);
      } else {
        toast({
          description: "Original message is further up in chat history.",
        });
      }
    }, 80);
  };

  const highlightMatch = (text: string, queryStr: string) => {
    if (!queryStr.trim()) return <>{text}</>;
    const parts = text.split(new RegExp(`(${queryStr})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === queryStr.toLowerCase() ? (
            <span key={i} className="bg-yellow-300 text-black rounded-sm px-0.5 font-bold">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </>
    );
  };

  // WebRTC Calling
  const [incomingCallInfo, setIncomingCallInfo] = useState<{ id: string; type: "audio" | "video" } | null>(null);

  const handleIncomingCall = useCallback((callId: string, type: "audio" | "video") => {
    setIncomingCallInfo({ id: callId, type });
  }, []);

  const handleCallEnded = useCallback(() => {
    setIncomingCallInfo(null);
  }, []);

  const handleCameraError = useCallback((errName: string) => {
    toast({
      variant: "destructive",
      title: "Camera Permission",
      description: errName === "NotReadableError" ? "Camera in use by another tab" : "Check camera permission.",
    });
  }, [toast]);

  const {
    startCall,
    answerCall,
    declineCall,
    endCall,
    switchCamera,
    callType,
    callState,
    localStream,
    remoteStream,
  } = useWebRTC({
    myId,
    partnerId,
    onIncomingCall: handleIncomingCall,
    onCallEnded: handleCallEnded,
    onCameraError: handleCameraError,
  });

  const handleStartCall = useCallback(
    (type: "audio" | "video") => {
      startCall(type);
    },
    [startCall]
  );

  // Memories
  const memoriesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, "memories"), orderBy("date", "desc"));
  }, [firestore, user]);
  const { data: memories } = useCollection(memoriesQuery);

  // Photos from memories for mobile gallery
  const memoryPhotosList = useMemo(() => {
    if (!memories) return [];
    return memories
      .filter((m: any) => m.photoURL || m.photo)
      .map((m: any) => (m.photoURL || m.photo) as string);
  }, [memories]);

  const [isMemoryDialogOpen, setIsMemoryDialogOpen] = useState(false);
  const [memoryTitle, setMemoryTitle] = useState("");
  const [memoryDate, setMemoryDate] = useState("");
  const [memoryType, setMemoryType] = useState<"milestone" | "anniversary" | "favorite">("milestone");
  const [memoryPhoto, setMemoryPhoto] = useState("");
  const [isSavingMemory, setIsSavingMemory] = useState(false);

  const handleSaveMemory = async () => {
    if (!firestore || !memoryTitle || !memoryDate) return;
    setIsSavingMemory(true);
    try {
      await addDoc(collection(firestore, "memories"), {
        title: memoryTitle,
        date: memoryDate,
        type: memoryType,
        photoURL: memoryPhoto || null,
        createdAt: serverTimestamp(),
      });
      setIsMemoryDialogOpen(false);
      setMemoryTitle("");
      setMemoryDate("");
      setMemoryPhoto("");
      toast({ title: "Memory Added 💕", description: "Saved to your shared milestone book." });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to save memory." });
    } finally {
      setIsSavingMemory(false);
    }
  };

  // Delete Memory
  const [memoryToDelete, setMemoryToDelete] = useState<{ id: string; title: string } | null>(null);
  const [isDeletingMemory, setIsDeletingMemory] = useState(false);

  const confirmDeleteMemory = async () => {
    if (!firestore || !memoryToDelete) return;
    setIsDeletingMemory(true);
    try {
      await deleteDoc(doc(firestore, "memories", memoryToDelete.id));
      toast({
        title: "Memory Deleted 🗑️",
        description: `"${memoryToDelete.title}" has been removed from your milestones.`,
      });
      setMemoryToDelete(null);
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete memory. Please try again.",
      });
    } finally {
      setIsDeletingMemory(false);
    }
  };

  // Profile Sheets
  const [isPartnerProfileSheetOpen, setIsPartnerProfileSheetOpen] = useState(false);
  const [isMyProfileOpen, setIsMyProfileOpen] = useState(false);
  const [editMyName, setEditMyName] = useState("");
  const [editMyPhotoURL, setEditMyPhotoURL] = useState("");
  const [isSavingMyProfile, setIsSavingMyProfile] = useState(false);
  const myPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Sync editing fields when opening My Profile
  useEffect(() => {
    if (isMyProfileOpen) {
      setEditMyName(finalMyName);
      setEditMyPhotoURL(myAvatar);
    }
  }, [isMyProfileOpen, finalMyName, myAvatar]);

  const resizeImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 500;
        let w = img.width, h = img.height;
        if (w > h) {
          if (w > MAX) { h *= MAX / w; w = MAX; }
        } else {
          if (h > MAX) { w *= MAX / h; h = MAX; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
    });
  };

  const handleMyPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const resized = await resizeImage(reader.result as string);
        setEditMyPhotoURL(resized);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveMyProfile = async () => {
    if (!firestore || !myId || !editMyName.trim()) return;
    setIsSavingMyProfile(true);
    try {
      const updatedPhoto = editMyPhotoURL || myAvatar;
      const updatedName = editMyName.trim();

      await setDoc(
        doc(firestore, "profiles", myId),
        {
          displayName: updatedName,
          photoURL: updatedPhoto,
          lastActive: serverTimestamp(),
        },
        { merge: true }
      );

      if (user) {
        await updateProfile(user, {
          displayName: updatedName,
          photoURL: updatedPhoto,
        });
      }

      toast({
        title: "Profile Updated ❤️",
        description: "Your name and photo have been updated successfully!",
      });
      setIsMyProfileOpen(false);
    } catch (e: any) {
      console.error("Failed to save profile:", e);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: e?.message || "Could not save your profile.",
      });
    } finally {
      setIsSavingMyProfile(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("duonexus_role");
      }
      if (auth) {
        await auth.signOut();
      }
      router.push("/login");
    } catch {
      router.push("/login");
    }
  };

  // Daily AI Love Spark
  const [dailyPrompt, setDailyPrompt] = useState<string | null>(null);
  const [isGeneratingSpark, setIsGeneratingSpark] = useState(false);

  const handleGenerateSpark = async (): Promise<string | undefined> => {
    setIsGeneratingSpark(true);
    try {
      const res = await dailyAiConversationPrompt({});
      setDailyPrompt(res.prompt);
      return res.prompt;
    } catch {
      const fallback = "What is one little thing I did recently that made you smile? 💕";
      setDailyPrompt(fallback);
      return fallback;
    } finally {
      setIsGeneratingSpark(false);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    try {
      localStorage.removeItem("duonexus_role");
      await signOut(auth);
      router.push("/login");
    } catch {
      router.push("/login");
    }
  };

  // Navigation tabs
  const tabs = [
    { id: "home", label: "Home", icon: HomeIcon },
    { id: "tools", label: "Tools", icon: LayoutGrid },
    { id: "chat", label: "Chat", icon: MessageCircle },
    { id: "memories", label: "Memories", icon: Archive },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];

  // ================= MOBILE MAIN HUB SCREEN =================
  const renderMobileMain = () => (
    <div
      className={`h-[100dvh] w-full flex flex-col font-sans transition-colors duration-300 select-none overflow-hidden ${c(
        "bg-[#4834d4]",
        "bg-[#0D0B1C]"
      )}`}
    >
      <div
        className="flex-1 p-6 overflow-y-auto flex flex-col"
        style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}
      >
        {/* DuoNexus Logo — Premium */}
        <div className="mt-4 mb-8 flex flex-col items-center text-center">
          {/* App Icon */}
          <div className="relative mb-4">
            <div
              className="w-20 h-20 rounded-[24px] flex items-center justify-center shadow-2xl"
              style={{
                background: "linear-gradient(135deg, #ff6b9d 0%, #c44dff 50%, #6d5aff 100%)",
                boxShadow: "0 20px 60px rgba(196,77,255,0.45), 0 4px 20px rgba(0,0,0,0.3)",
              }}
            >
              <Heart className="w-10 h-10 text-white fill-white drop-shadow-md" />
            </div>
            {/* Glow ring */}
            <div
              className="absolute inset-0 rounded-[24px] blur-xl opacity-40"
              style={{ background: "linear-gradient(135deg, #ff6b9d, #c44dff, #6d5aff)" }}
            />
          </div>
          <h1
            className="text-[32px] font-black text-white tracking-tight"
            style={{ textShadow: "0 2px 16px rgba(196,77,255,0.5)" }}
          >
            DuoNexus
          </h1>
          <p className="text-[14px] font-medium text-white/60 mt-1.5 tracking-wide">
            Your private space, just for two 💕
          </p>
        </div>

        {/* Tab Content inside Hub */}
        {activeTab === "home" || activeTab === "chat" ? (
          <div className="mt-auto mb-4 w-full space-y-4">
            {/* Daily Love Spark Banner */}
            {dailyPrompt ? (
              <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white animate-in fade-in">
                <div className="flex items-center gap-2 mb-1">
                  <Heart className="w-4 h-4 text-pink-300 fill-pink-300" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-pink-200">
                    Today's Love Spark
                  </span>
                </div>
                <p className="text-sm font-medium">{dailyPrompt}</p>
              </div>
            ) : null}

            {/* Chat List Item to open real conversation */}
            <div
              onClick={() => {
                setActiveTab("chat");
                setCurrentScreen("chat");
              }}
              className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer ${c(
                "bg-white",
                "bg-[#18181A]"
              )} hover:scale-[1.01] active:scale-[0.98] transition-all shadow-xl`}
            >
              <div className="relative">
                <img
                  src={partnerAvatar}
                  alt={finalPartnerName}
                  className="w-14 h-14 rounded-full object-cover shadow-sm border border-white/10 bg-black"
                />
                {partnerPresence?.online && (
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <h3 className={`font-semibold text-[16px] truncate ${c("text-gray-900", "text-white")}`}>
                    {finalPartnerName} ❤️
                  </h3>
                  <span className="text-[12px] font-semibold text-blue-500">
                    {messages.length > 0
                      ? isToday(new Date(messages[messages.length - 1].timestamp?.seconds * 1000 || Date.now()))
                        ? format(new Date(messages[messages.length - 1].timestamp?.seconds * 1000 || Date.now()), "h:mm a")
                        : "Recent"
                      : "Just now"}
                  </span>
                </div>
                <div className={`text-[14px] truncate ${c("text-gray-500", "text-gray-400")}`}>
                  <RenderMessageSnippet
                    msg={messages.length > 0 ? messages[messages.length - 1] : null}
                    fallbackName={finalPartnerName}
                  />
                </div>
              </div>

              <div className="w-2.5 h-2.5 bg-blue-500 rounded-full flex-shrink-0"></div>
            </div>

            {/* Streak Badge Card */}
            <div
              onClick={() => setIsStreakModalOpen(true)}
              className="flex items-center justify-between p-3.5 px-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white cursor-pointer hover:bg-white/15 transition-all shadow-md"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-orange-400 fill-orange-400 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider block text-orange-300">Love Streak</span>
                    <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-orange-500/20 text-orange-300">TikTok Flame</span>
                  </div>
                  <span className="text-sm font-semibold">{streak} Days Strong 🔥</span>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleGenerateSpark();
                }}
                disabled={isGeneratingSpark}
                className="h-8 text-xs text-white hover:bg-white/10 rounded-full gap-1.5"
              >
                <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400" />
                {isGeneratingSpark ? "Thinking..." : "Love Spark"}
              </Button>
            </div>
          </div>
        ) : activeTab === "tools" ? (
          <div className="mt-auto mb-4 w-full space-y-3 animate-in fade-in">
            <div className={`p-5 rounded-2xl shadow-xl ${c("bg-white", "bg-[#18181A]")}`}>
              <h3 className={`font-bold text-lg mb-2 ${c("text-gray-900", "text-white")}`}>Quick Calling</h3>
              <p className={`text-sm mb-4 ${c("text-gray-500", "text-gray-400")}`}>Start a crystal-clear call with {finalPartnerName}.</p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => {
                    setCurrentScreen("chat");
                    handleStartCall("video");
                  }}
                  className="gap-2 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  <Video className="w-5 h-5" /> Video Call
                </Button>
                <Button
                  onClick={() => {
                    setCurrentScreen("chat");
                    handleStartCall("audio");
                  }}
                  className="gap-2 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  <Phone className="w-5 h-5" /> Voice Call
                </Button>
              </div>
            </div>

            <div className={`p-5 rounded-2xl shadow-xl ${c("bg-white", "bg-[#18181A]")}`}>
              <h3 className={`font-bold text-lg mb-2 ${c("text-gray-900", "text-white")}`}>AI Conversation Sparks</h3>
              <p className={`text-sm mb-3 ${c("text-gray-500", "text-gray-400")}`}>Get romantic questions and sweet moments.</p>
              <Button
                onClick={handleGenerateSpark}
                disabled={isGeneratingSpark}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold"
              >
                {isGeneratingSpark ? "Generating Spark..." : "Generate Love Spark ❤️"}
              </Button>
            </div>
          </div>
        ) : activeTab === "memories" ? (
          <div className="mt-auto mb-4 w-full space-y-3 animate-in fade-in">
            <div className={`p-5 rounded-2xl shadow-xl ${c("bg-white", "bg-[#18181A]")}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-bold text-lg ${c("text-gray-900", "text-white")}`}>Our Milestones</h3>
                <Button
                  size="sm"
                  onClick={() => setIsMemoryDialogOpen(true)}
                  className="h-8 text-xs font-bold gap-1 rounded-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </Button>
              </div>

              {memories && memories.length > 0 ? (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {memories.map((m: any) => {
                    const typeConfig: Record<string, { emoji: string; color: string; bg: string }> = {
                      anniversary: { emoji: "💍", color: "#ec4899", bg: "rgba(236,72,153,0.12)" },
                      milestone: { emoji: "🏆", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
                      favorite: { emoji: "⭐", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
                    };
                    const cfg = typeConfig[m.type] || { emoji: "💕", color: "#6366f1", bg: "rgba(99,102,241,0.12)" };
                    return (
                      <div
                        key={m.id}
                        className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer ${c("bg-white border-gray-100 shadow-sm", "bg-zinc-900/60 border-zinc-700/60 shadow-black/20 shadow-md")}`}
                      >
                        {/* Icon */}
                        <div
                          className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-sm"
                          style={{ background: cfg.bg, border: `1.5px solid ${cfg.color}30` }}
                        >
                          {cfg.emoji}
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-bold text-[15px] truncate ${c("text-gray-900", "text-white")}`}>{m.title}</h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                              style={{ color: cfg.color, background: cfg.bg }}
                            >
                              {m.type}
                            </span>
                            <span className={`text-[12px] font-medium ${c("text-gray-400", "text-gray-500")}`}>{m.date}</span>
                          </div>
                        </div>
                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMemoryToDelete({ id: m.id, title: m.title || "Milestone" });
                          }}
                          className="p-1.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-500/10 active:scale-90 transition-all shrink-0"
                          title="Delete milestone"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="w-14 h-14 rounded-full bg-pink-500/10 flex items-center justify-center">
                    <Calendar className="w-7 h-7 text-pink-400" />
                  </div>
                  <p className={`text-sm font-medium text-center ${c("text-gray-500", "text-gray-400")}`}>No memories yet.<br />Add your first milestone! 💕</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Mobile Settings View with Real Toggler Switches */
          <div className="w-full space-y-4 pb-6 animate-in fade-in">
            {/* User Profile Card */}
            <div className={`p-4 rounded-3xl shadow-xl border ${c("bg-white border-gray-100", "bg-[#18181A] border-zinc-800")}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="relative">
                    <Avatar className="h-14 w-14 border-2 border-primary shadow-md">
                      <AvatarImage src={myAvatar} className="rounded-full object-cover" />
                      <AvatarFallback className="bg-primary/20 text-primary font-bold">
                        {finalMyName?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900 shadow-xs" />
                  </div>
                  <div>
                    <h3 className={`font-black text-lg leading-tight ${c("text-gray-900", "text-white")}`}>
                      {finalMyName}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                      {myId === "karu" ? "Karu • DuoNexus" : "Nabin • DuoNexus"}
                    </p>
                    <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-pink-500 bg-pink-500/10 px-2 py-0.5 rounded-full">
                      Connected with {finalPartnerName} 💕
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsMyProfileOpen(true)}
                  className="rounded-2xl text-xs font-bold border-primary/30 text-primary hover:bg-primary/10 active:scale-95 h-9 px-3"
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1" />
                  Edit
                </Button>
              </div>
            </div>

            {/* Notifications Section with Real Toggler */}
            <div className={`p-4 rounded-3xl shadow-xl border space-y-3.5 ${c("bg-white border-gray-100", "bg-[#18181A] border-zinc-800")}`}>
              <div className="flex items-center gap-2 pb-1 border-b border-gray-100 dark:border-zinc-800/80">
                <Bell className="w-4 h-4 text-emerald-500" />
                <h4 className={`text-xs font-bold uppercase tracking-wider ${c("text-gray-500", "text-zinc-400")}`}>
                  Notifications & Sounds
                </h4>
              </div>

              {/* Push Notifications Switch */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3 pr-2">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4 text-gray-400" />}
                  </div>
                  <div>
                    <p className={`text-sm font-bold leading-snug ${c("text-gray-900", "text-white")}`}>
                      Push Notifications
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                      {notificationsEnabled ? "Alerts enabled for all new messages" : "Notifications are muted"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={notificationsEnabled}
                  onCheckedChange={handleToggleNotifications}
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>

              {/* Message Sound Effects Switch */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3 pr-2">
                  <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    {soundEffectsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
                  </div>
                  <div>
                    <p className={`text-sm font-bold leading-snug ${c("text-gray-900", "text-white")}`}>
                      In-App Message Sounds
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                      {soundEffectsEnabled ? "Play send & receive chime" : "Silent in-app messaging"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={soundEffectsEnabled}
                  onCheckedChange={(checked) => {
                    setSoundEffectsEnabled(checked);
                    try {
                      localStorage.setItem("duonexus_sound_effects", String(checked));
                    } catch {}
                    if (checked) {
                      sendAudioRef.current?.play().catch(() => {});
                    }
                  }}
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              {/* Vibration Switch */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3 pr-2">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className={`text-sm font-bold leading-snug ${c("text-gray-900", "text-white")}`}>
                      Vibration & Haptics
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                      {vibrationEnabled ? "Vibrate on messages & reactions" : "Haptics disabled"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={vibrationEnabled}
                  onCheckedChange={(checked) => {
                    setVibrationEnabled(checked);
                    try {
                      localStorage.setItem("duonexus_vibration", String(checked));
                    } catch {}
                    if (checked && typeof navigator !== "undefined" && navigator.vibrate) {
                      navigator.vibrate(50);
                    }
                  }}
                  className="data-[state=checked]:bg-indigo-500"
                />
              </div>
            </div>

            {/* Appearance & Quality Section */}
            <div className={`p-4 rounded-3xl shadow-xl border space-y-3.5 ${c("bg-white border-gray-100", "bg-[#18181A] border-zinc-800")}`}>
              <div className="flex items-center gap-2 pb-1 border-b border-gray-100 dark:border-zinc-800/80">
                <Palette className="w-4 h-4 text-purple-500" />
                <h4 className={`text-xs font-bold uppercase tracking-wider ${c("text-gray-500", "text-zinc-400")}`}>
                  Appearance & Quality
                </h4>
              </div>

              {/* Dark Theme Switch */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3 pr-2">
                  <div className="w-9 h-9 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                    {darkMode ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                  </div>
                  <div>
                    <p className={`text-sm font-bold leading-snug ${c("text-gray-900", "text-white")}`}>
                      Dark Mode
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                      {darkMode ? "Dark AMOLED mode active" : "Light mode active"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={darkMode}
                  onCheckedChange={toggleDarkMode}
                  className="data-[state=checked]:bg-purple-600"
                />
              </div>

              {/* Default HD Quality Switch */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3 pr-2">
                  <div className="w-9 h-9 rounded-2xl bg-cyan-500/10 text-[#00d2ff] flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <p className={`text-sm font-bold leading-snug ${c("text-gray-900", "text-white")}`}>
                      HD Media Quality Default
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                      {hdDefaultEnabled ? "Upload photos & videos in high res by default" : "Standard resolution"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={hdDefaultEnabled}
                  onCheckedChange={(checked) => {
                    setHdDefaultEnabled(checked);
                    try {
                      localStorage.setItem("duonexus_hd_default", String(checked));
                    } catch {}
                  }}
                  className="data-[state=checked]:bg-[#00d2ff]"
                />
              </div>

              {/* Read Receipts Switch */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3 pr-2">
                  <div className="w-9 h-9 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                    <CheckCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className={`text-sm font-bold leading-snug ${c("text-gray-900", "text-white")}`}>
                      Read Receipts & Seen Time
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                      {readReceiptsEnabled ? "Send & receive seen timestamps" : "Read receipts off"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={readReceiptsEnabled}
                  onCheckedChange={(checked) => {
                    setReadReceiptsEnabled(checked);
                    try {
                      localStorage.setItem("duonexus_read_receipts", String(checked));
                    } catch {}
                  }}
                  className="data-[state=checked]:bg-blue-500"
                />
              </div>
            </div>

            {/* Account & Logout Card */}
            <div className={`p-4 rounded-3xl shadow-xl border space-y-3 ${c("bg-white border-gray-100", "bg-[#18181A] border-zinc-800")}`}>
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className={`text-sm font-bold ${c("text-gray-900", "text-white")}`}>Active Session</p>
                  <p className="text-xs text-muted-foreground capitalize">Account: {myId || "User"}</p>
                </div>
                <Button
                  onClick={handleSignOut}
                  variant="destructive"
                  className="h-9 px-4 rounded-2xl font-bold gap-2 text-xs shadow-md active:scale-95"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </Button>
              </div>
              <div className="pt-2 border-t border-gray-100 dark:border-zinc-800/80 text-center">
                <p className="text-[11px] text-muted-foreground font-medium">
                  DuoNexus v2.4.0 • Built with ❤️ for Two
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Curved 5-Tab Bar */}
      <div className="w-full px-4 pt-3 relative" style={{ paddingBottom: "max(1.8rem, env(safe-area-inset-bottom))" }}>
        <div
          className={`w-full h-[82px] rounded-[32px] relative flex justify-between items-center px-2 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.3)] ${c(
            "bg-white",
            "bg-[#18181A]"
          )}`}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === "chat") {
                    // Go directly into the conversation
                    setActiveTab("chat");
                    setCurrentScreen("chat");
                  } else {
                    setActiveTab(tab.id);
                  }
                }}
                className="relative flex-1 flex flex-col items-center justify-center h-full group touch-manipulation cursor-pointer"
              >
                {/* Elevated Circle Notch Indicator */}
                <div
                  className={`absolute flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-10 rounded-full ${isActive
                    ? "-top-[30px] w-[64px] h-[64px] border-[6px]"
                    : "top-3 w-8 h-8 border-[0px]"
                    } ${isActive
                      ? c("bg-white border-[#4834d4] shadow-md", "bg-[#18181A] border-[#0D0B1C] shadow-md")
                      : "bg-transparent border-transparent"
                    }`}
                >
                  <Icon
                    className={`transition-colors duration-200 ${isActive ? "w-7 h-7" : "w-6 h-6"
                      } ${isActive
                        ? c("text-[#4834d4]", "text-indigo-400")
                        : c("text-gray-400 group-hover:text-gray-600", "text-gray-500 group-hover:text-gray-300")
                      }`}
                    strokeWidth={isActive ? 2.2 : 1.5}
                  />
                </div>

                <span
                  className={`absolute bottom-3 text-[12px] transition-all duration-200 ${isActive
                    ? "font-bold " + c("text-gray-900", "text-white")
                    : "font-medium " + c("text-gray-400", "text-gray-500")
                    }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ================= DESKTOP PLACEHOLDER & TAB VIEWS =================
  const renderDesktopEmpty = () => (
    <div className={`flex-1 h-full flex flex-col items-center justify-center p-8 text-center select-none ${c("bg-[#F6F5F0]", "bg-[#121212]")}`}>
      <div className="relative mb-5 group">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-pink-500 via-rose-500 to-purple-500 p-0.5 shadow-xl shadow-pink-500/20 group-hover:scale-105 transition-transform">
          <div className={`w-full h-full rounded-[22px] flex items-center justify-center ${c("bg-white", "bg-[#18181A]")}`}>
            <Heart className="w-10 h-10 text-pink-500 fill-pink-500 animate-pulse" />
          </div>
        </div>
      </div>
      <h2 className={`text-2xl font-bold font-headline ${c("text-gray-900", "text-white")}`}>
        DuoNexus for Desktop
      </h2>
      <p className={`text-sm mt-2 max-w-sm font-medium ${c("text-gray-500", "text-gray-400")}`}>
        Select a conversation on the left to start sending messages, sweet photos, and voice notes 💕
      </p>
      <Button
        onClick={() => {
          setSelectedConversation("karu");
          setActiveTab("chat");
        }}
        className="mt-6 gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold shadow-lg shadow-pink-500/25 px-6 h-11 hover:opacity-95 transition-opacity"
      >
        <MessageCircle className="w-4 h-4" />
        <span>Open Chat with {finalPartnerName}</span>
      </Button>
    </div>
  );

  const renderDesktopMemories = () => (
    <div className={`flex-1 h-full overflow-y-auto p-6 lg:p-8 flex flex-col ${c("bg-[#F6F5F0]", "bg-[#121212]")}`}>
      <div className="max-w-3xl w-full mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`text-2xl lg:text-3xl font-bold font-headline flex items-center gap-2 ${c("text-gray-900", "text-white")}`}>
              <span>Our Milestones & Memories</span>
              <Heart className="w-6 h-6 text-pink-500 fill-pink-500" />
            </h2>
            <p className={`text-sm mt-1 font-medium ${c("text-gray-500", "text-gray-400")}`}>
              Cherish every moment of your journey together 💕
            </p>
          </div>
          <Button
            onClick={() => setIsMemoryDialogOpen(true)}
            className="gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Milestone</span>
          </Button>
        </div>

        {/* Love Streak Banner */}
        <div className={`p-5 rounded-2xl flex items-center justify-between border shadow-sm ${c("bg-white border-gray-100", "bg-[#18181A] border-zinc-800")}`}>
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/15 flex items-center justify-center">
              <Flame className="w-7 h-7 text-orange-500 fill-orange-500" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-orange-500 block">Love Streak</span>
              <span className={`text-lg font-bold font-headline ${c("text-gray-900", "text-white")}`}>{streak} Days Strong</span>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleGenerateSpark}
            disabled={isGeneratingSpark}
            className="rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold gap-1.5 shadow-sm"
          >
            <Heart className="w-3.5 h-3.5 text-white fill-white" />
            <span>{isGeneratingSpark ? "Thinking..." : "Generate Love Spark"}</span>
          </Button>
        </div>

        {/* Memories Grid */}
        {memories && memories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {memories.map((m: any) => {
              const typeConfig: Record<string, { emoji: string; color: string; bg: string }> = {
                anniversary: { emoji: "💍", color: "#ec4899", bg: "rgba(236,72,153,0.12)" },
                milestone: { emoji: "🏆", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
                favorite: { emoji: "⭐", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
              };
              const cfg = typeConfig[m.type] || { emoji: "💕", color: "#6366f1", bg: "rgba(99,102,241,0.12)" };
              return (
                <div
                  key={m.id}
                  className={`group p-4 rounded-2xl border flex items-center gap-4 transition-all hover:scale-[1.01] ${c("bg-white border-gray-100 shadow-sm", "bg-[#18181A] border-zinc-800 shadow-sm")}`}
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-sm"
                    style={{ background: cfg.bg, border: `1.5px solid ${cfg.color}30` }}
                  >
                    {cfg.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-bold text-base truncate ${c("text-gray-900", "text-white")}`}>{m.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ color: cfg.color, background: cfg.bg }}
                      >
                        {m.type}
                      </span>
                      <span className={`text-xs font-medium ${c("text-gray-400", "text-gray-500")}`}>{m.date}</span>
                    </div>
                  </div>
                  {/* Delete button (visible on hover) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMemoryToDelete({ id: m.id, title: m.title || "Milestone" });
                    }}
                    className="opacity-0 group-hover:opacity-100 p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-all shrink-0 cursor-pointer"
                    title="Delete milestone"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border ${c("bg-white border-gray-100", "bg-[#18181A] border-zinc-800")}`}>
            <div className="w-16 h-16 rounded-full bg-pink-500/10 flex items-center justify-center mb-3">
              <Calendar className="w-8 h-8 text-pink-400" />
            </div>
            <h3 className={`font-bold text-lg ${c("text-gray-900", "text-white")}`}>No memories saved yet</h3>
            <p className={`text-sm mt-1 mb-4 ${c("text-gray-500", "text-gray-400")}`}>
              Start capturing your beautiful relationship milestones!
            </p>
            <Button
              onClick={() => setIsMemoryDialogOpen(true)}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Your First Milestone</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  const renderDesktopHome = () => (
    <div className={`flex-1 h-full overflow-y-auto p-6 lg:p-8 flex flex-col ${c("bg-[#F6F5F0]", "bg-[#121212]")}`}>
      <div className="max-w-2xl w-full mx-auto space-y-6">
        {/* DuoNexus Logo & Banner */}
        <div className="text-center py-6">
          <div className="relative inline-block mb-3">
            <div
              className="w-16 h-16 rounded-[20px] flex items-center justify-center shadow-xl mx-auto"
              style={{
                background: "linear-gradient(135deg, #ff6b9d 0%, #c44dff 50%, #6d5aff 100%)",
              }}
            >
              <Heart className="w-8 h-8 text-white fill-white" />
            </div>
          </div>
          <h2 className={`text-2xl font-bold font-headline ${c("text-gray-900", "text-white")}`}>
            DuoNexus
          </h2>
          <p className={`text-sm mt-1 font-medium ${c("text-gray-500", "text-gray-400")}`}>
            Your private couple sanctuary 💕
          </p>
        </div>

        {/* Daily Love Spark */}
        {dailyPrompt && (
          <div className={`p-5 rounded-2xl border shadow-sm ${c("bg-white border-pink-100", "bg-[#18181A] border-pink-950/40")}`}>
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-pink-500 fill-pink-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-pink-500">Today's Love Spark</span>
            </div>
            <p className={`text-base font-medium ${c("text-gray-800", "text-gray-200")}`}>{dailyPrompt}</p>
          </div>
        )}

        {/* Quick Action to Karu Conversation */}
        <div
          onClick={() => {
            setSelectedConversation("karu");
            setActiveTab("chat");
          }}
          className={`p-4 rounded-2xl border flex items-center gap-4 cursor-pointer transition-all hover:scale-[1.01] ${c("bg-white border-gray-100 shadow-sm", "bg-[#18181A] border-zinc-800 shadow-sm")}`}
        >
          <div className="relative">
            <Avatar className="h-14 w-14 border-2 border-primary/20 bg-black">
              <AvatarImage src={partnerAvatar} className="rounded-full object-cover" />
              <AvatarFallback>{finalPartnerName?.[0] || "P"}</AvatarFallback>
            </Avatar>
            {partnerPresence?.online && (
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-background rounded-full" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`font-bold text-base flex items-center gap-1.5 ${c("text-gray-900", "text-white")}`}>
              <span>{finalPartnerName}</span>
              <Heart className="w-3.5 h-3.5 text-primary fill-primary" />
            </h3>
            <div className={`text-xs truncate mt-0.5 ${c("text-gray-500", "text-gray-400")}`}>
              <RenderMessageSnippet
                msg={messages.length > 0 ? messages[messages.length - 1] : null}
                fallbackName={finalPartnerName}
              />
            </div>
          </div>
          <Button size="sm" className="rounded-xl font-bold bg-primary text-primary-foreground">
            Chat
          </Button>
        </div>

        {/* Love Streak Card */}
        <div
          onClick={() => setIsStreakModalOpen(true)}
          className={`p-5 rounded-2xl flex items-center justify-between border shadow-sm cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all ${c("bg-white border-gray-100", "bg-[#18181A] border-zinc-800")}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center">
              <Flame className="w-6 h-6 text-orange-500 fill-orange-500 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-orange-500 block">Love Streak</span>
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-orange-500/10 text-orange-500">TikTok Flame</span>
              </div>
              <span className={`text-base font-bold font-headline ${c("text-gray-900", "text-white")}`}>{streak} Days Strong 🔥</span>
            </div>
          </div>
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleGenerateSpark();
            }}
            disabled={isGeneratingSpark}
            className="rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold gap-1 text-xs"
          >
            <Heart className="w-3 h-3 fill-white" />
            <span>{isGeneratingSpark ? "Thinking..." : "Love Spark"}</span>
          </Button>
        </div>
      </div>
    </div>
  );

  const renderDesktopTools = () => (
    <div className={`flex-1 h-full overflow-y-auto p-6 lg:p-8 flex flex-col ${c("bg-[#F6F5F0]", "bg-[#121212]")}`}>
      <div className="max-w-2xl w-full mx-auto space-y-6">
        <div>
          <h2 className={`text-2xl font-bold font-headline flex items-center gap-2 ${c("text-gray-900", "text-white")}`}>
            <LayoutGrid className="w-6 h-6 text-primary" />
            <span>Couple Calling & Tools</span>
          </h2>
          <p className={`text-sm mt-1 font-medium ${c("text-gray-500", "text-gray-400")}`}>
            Instant connection with {finalPartnerName}
          </p>
        </div>

        {/* Calling Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className={`p-5 rounded-2xl border flex flex-col justify-between shadow-sm ${c("bg-white border-gray-100", "bg-[#18181A] border-zinc-800")}`}>
            <div>
              <div className="w-12 h-12 rounded-2xl bg-blue-500/15 flex items-center justify-center mb-3">
                <Video className="w-6 h-6 text-blue-500" />
              </div>
              <h3 className={`font-bold text-base ${c("text-gray-900", "text-white")}`}>Video Call</h3>
              <p className={`text-xs mt-1 ${c("text-gray-500", "text-gray-400")}`}>Face-to-face HD private video.</p>
            </div>
            <Button
              onClick={() => {
                setSelectedConversation("karu");
                setActiveTab("chat");
                handleStartCall("video");
              }}
              className="mt-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2"
            >
              <Video className="w-4 h-4" /> Start Video
            </Button>
          </div>

          <div className={`p-5 rounded-2xl border flex flex-col justify-between shadow-sm ${c("bg-white border-gray-100", "bg-[#18181A] border-zinc-800")}`}>
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 flex items-center justify-center mb-3">
                <Phone className="w-6 h-6 text-emerald-500" />
              </div>
              <h3 className={`font-bold text-base ${c("text-gray-900", "text-white")}`}>Voice Call</h3>
              <p className={`text-xs mt-1 ${c("text-gray-500", "text-gray-400")}`}>Crystal-clear private audio.</p>
            </div>
            <Button
              onClick={() => {
                setSelectedConversation("karu");
                setActiveTab("chat");
                handleStartCall("audio");
              }}
              className="mt-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2"
            >
              <Phone className="w-4 h-4" /> Start Voice
            </Button>
          </div>
        </div>

        {/* AI Sparks */}
        <div className={`p-6 rounded-2xl border shadow-sm ${c("bg-white border-gray-100", "bg-[#18181A] border-zinc-800")}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-500">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`font-bold text-base ${c("text-gray-900", "text-white")}`}>AI Conversation Sparks</h3>
              <p className={`text-xs ${c("text-gray-500", "text-gray-400")}`}>Get romantic questions and deep conversation starters.</p>
            </div>
          </div>
          <Button
            onClick={handleGenerateSpark}
            disabled={isGeneratingSpark}
            className="w-full h-11 mt-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold"
          >
            {isGeneratingSpark ? "Generating Spark..." : "Generate Love Spark ❤️"}
          </Button>
        </div>
      </div>
    </div>
  );

  // ================= CHAT CONVERSATION VIEW =================
  const renderConversation = () => {
    let wallpaperSrc = "/wallpapers/messenger-love.jpg";
    if (wallpaperConfig.id === "sunset") wallpaperSrc = "/wallpapers/romantic-sunset.jpg";
    else if (wallpaperConfig.id === "midnight") wallpaperSrc = "/wallpapers/midnight-stars.jpg";
    else if (wallpaperConfig.id === "blossom") wallpaperSrc = "/wallpapers/cherry-blossom.jpg";
    else if (wallpaperConfig.id === "minimal") wallpaperSrc = "/wallpapers/velvet-minimal.jpg";
    else if (wallpaperConfig.id === "custom" && wallpaperConfig.customUrl) wallpaperSrc = wallpaperConfig.customUrl;

    const posX = typeof wallpaperConfig.positionX === "number" ? wallpaperConfig.positionX : 50;
    const posY = typeof wallpaperConfig.positionY === "number" ? wallpaperConfig.positionY : 35;
    const zoom = typeof wallpaperConfig.zoom === "number" ? wallpaperConfig.zoom : 100;
    const fitMode = wallpaperConfig.fit || "smart";
    const opacityVal = (wallpaperConfig.opacity || 85) / 100;

    return (
      <div
        className={`h-full w-full flex flex-col relative font-sans transition-colors duration-300 overflow-hidden ${c(
          "bg-[#F6F5F0]",
          "bg-[#121212]"
        )}`}
      >
        {/* Full-Screen Edge-to-Edge Chat Wallpaper Layer (Behind Header, Messages & Input) */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden select-none">
          {/* Ambient atmosphere backdrop */}
          <div
            className="absolute inset-0 transition-all duration-500 pointer-events-none"
            style={{
              backgroundImage: `url("${wallpaperSrc}")`,
              backgroundPosition: "center center",
              backgroundSize: "cover",
              filter: "blur(36px) saturate(1.35) brightness(0.8)",
              transform: "scale(1.2)",
              opacity: Math.max(0.3, opacityVal * 0.8),
            }}
          />

          {/* Crisp Wallpaper (Full Cover edge-to-edge on mobile, smart adaptive on desktop) */}
          <div className="absolute inset-0 transition-all duration-300 pointer-events-none flex items-center justify-center">
            <div
              className="w-full h-full transition-all duration-300"
              style={{
                backgroundImage: `url("${wallpaperSrc}")`,
                backgroundPosition: `${posX}% ${posY}%`,
                backgroundSize: zoom > 100
                  ? `${zoom}%`
                  : isMobile
                    ? "cover"
                    : (fitMode === "contain" ? "contain" : "cover"),
                backgroundRepeat: "no-repeat",
                opacity: opacityVal,
              }}
            />
          </div>

          {/* Gentle ambient readability wash */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: darkMode
                ? "linear-gradient(to bottom, rgba(10,10,14,0.3) 0%, rgba(10,10,14,0.05) 30%, rgba(10,10,14,0.1) 70%, rgba(10,10,14,0.45) 100%)"
                : "linear-gradient(to bottom, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.05) 30%, rgba(255,255,255,0.1) 70%, rgba(255,255,255,0.35) 100%)",
            }}
          />
        </div>

        {/* Top Header */}
        <header
          className={`px-3 sm:px-4 pb-3 flex items-end justify-between border-b z-20 transition-colors duration-300 min-h-[65px] backdrop-blur-md ${c(
            "bg-[#F6F5F0]/85 border-gray-200/80",
            "bg-[#18181A]/85 border-zinc-800/80"
          )}`}
          style={{ paddingTop: isMobile ? "max(0.75rem, env(safe-area-inset-top))" : "0.75rem" }}
        >
        {isSearching ? (
          <div className="flex items-center w-full gap-3 h-full animate-in fade-in slide-in-from-right-4 duration-200">
            <button
              onClick={() => {
                setIsSearching(false);
                setSearchQuery("");
              }}
              className={`p-2 -ml-2 rounded-full transition-colors ${c(
                "hover:bg-gray-200 text-gray-700",
                "hover:bg-zinc-800 text-gray-200"
              )}`}
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <input
              autoFocus
              type="text"
              placeholder="Search in conversation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`flex-1 bg-transparent border-none outline-none text-[16px] font-medium min-w-0 ${c(
                "text-gray-900 placeholder-gray-500",
                "text-gray-100 placeholder-gray-400"
              )}`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className={`p-1.5 rounded-full transition-colors ${c(
                  "hover:bg-gray-200 text-gray-600",
                  "hover:bg-zinc-700 text-gray-300"
                )}`}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        ) : isMobile && selectedMobileMessage ? (
          /* MOBILE SELECTION HEADER (WhatsApp style - Screenshot 1) */
          <MobileSelectionHeader
            selectedMessage={selectedMobileMessage}
            onClearSelection={() => setSelectedMobileMessage(null)}
            onReply={() => {
              setReplyingTo(selectedMobileMessage);
              setSelectedMobileMessage(null);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            onDelete={() => {
              setMobileDeleteMessage(selectedMobileMessage);
            }}
            onCopy={() => {
              handleCopy(
                selectedMobileMessage.id,
                selectedMobileMessage.content || selectedMobileMessage.text || ""
              );
              toast({ title: "Copied", description: "Message copied to clipboard" });
              setSelectedMobileMessage(null);
            }}
            onOpenInfo={() => {
              setSelectedInfoMessage(selectedMobileMessage);
              setSelectedMobileMessage(null);
            }}
          />
        ) : isMobile ? (
          /* MOBILE HEADER (<768px): Rebuilt as clean single row with zero overlapping elements */
          <div className="flex items-center justify-between w-full min-w-0">
            {/* LEFT: Back arrow -> Avatar (with anchored online/offline badge) -> Name + Status */}
            <div className="flex items-center gap-2 flex-1 min-w-0 pr-1">
              <button
                type="button"
                onClick={() => setCurrentScreen("main")}
                className={`w-9 h-9 flex-shrink-0 flex items-center justify-center -ml-1 rounded-full transition-colors active:scale-95 ${c(
                  "hover:bg-gray-200 text-gray-700",
                  "hover:bg-zinc-800 text-gray-200"
                )}`}
                title="Back to conversations"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {/* Avatar with anchored online/offline status dot badge */}
              <div
                onClick={() => setIsPartnerProfileSheetOpen(true)}
                className="relative flex-shrink-0 cursor-pointer hover:opacity-90 active:scale-95 transition-all"
              >
                <img
                  src={partnerAvatar}
                  alt={finalPartnerName}
                  className={`w-10 h-10 rounded-full object-cover border shadow-xs ${c(
                    "border-gray-200 bg-black",
                    "border-zinc-700 bg-black"
                  )}`}
                />
                <span
                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 transition-colors ${
                    partnerPresence?.online ? "bg-emerald-500" : "bg-gray-400"
                  } ${c("border-white", "border-[#18181A]")}`}
                />
              </div>

              {/* Name & Status stacked vertically */}
              <div
                onClick={() => setIsPartnerProfileSheetOpen(true)}
                className="flex flex-col cursor-pointer flex-1 min-w-0 justify-center leading-tight"
              >
                <h1 className={`text-[15px] font-semibold leading-tight flex items-center gap-1 min-w-0 ${c(
                  "text-gray-900",
                  "text-white"
                )}`}>
                  <span className="truncate min-w-0">{finalPartnerName}</span>
                  <span className="text-red-500 text-xs flex-shrink-0">❤️</span>
                </h1>
                <span className={`text-[11px] font-medium truncate mt-0.5 ${
                  otherIsTyping
                    ? "text-emerald-500 font-semibold"
                    : c("text-gray-500", "text-gray-400")
                }`}>
                  {otherIsTyping ? "typing..." : partnerPresence?.online ? "Online" : "Offline"}
                </span>
              </div>
            </div>

            {/* RIGHT: Reaction-count pill -> Video Call -> Phone Call -> Three-dot Menu */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Reaction-count / Streak Pill (hidden on ultra-narrow <360px screens to prevent collision) */}
              <div
                onClick={() => setIsStreakModalOpen(true)}
                className={`hidden min-[360px]:flex items-center gap-1 px-2.5 h-8 rounded-full shadow-xs border flex-shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-all select-none ${chattedToday
                  ? "bg-gradient-to-r from-orange-500 to-rose-500 border-orange-400/40 text-white shadow-orange-500/20"
                  : c("bg-[#2A2726] border-[#1C1A19] text-white", "bg-zinc-800 border-zinc-700 text-amber-400")
                  }`}
                title="Love Streak"
              >
                <Flame className={`w-3.5 h-3.5 flex-shrink-0 ${chattedToday ? "text-white fill-white animate-pulse" : "text-amber-400 fill-amber-400"}`} />
                <span className="text-[12px] font-bold tracking-tight">{streak}</span>
              </div>

              {/* Video Call */}
              <button
                type="button"
                onClick={() => handleStartCall("video")}
                className={`w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full transition-colors active:scale-95 ${c(
                  "hover:bg-gray-200 text-gray-600",
                  "hover:bg-zinc-800 text-gray-300"
                )}`}
                title="Video call"
              >
                <Video className="w-5 h-5 text-blue-500" />
              </button>

              {/* Audio Call */}
              <button
                type="button"
                onClick={() => handleStartCall("audio")}
                className={`w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full transition-colors active:scale-95 ${c(
                  "hover:bg-gray-200 text-gray-600",
                  "hover:bg-zinc-800 text-gray-300"
                )}`}
                title="Phone call"
              >
                <Phone className="w-5 h-5 text-emerald-500" />
              </button>

              {/* Three Dot Menu using DropdownMenu for reliable outside click dismissal */}
              <DropdownMenu open={showMenu} onOpenChange={setShowMenu}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={`w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full transition-colors active:scale-95 cursor-pointer ${showMenu
                      ? c("bg-gray-200 text-gray-800", "bg-zinc-800 text-gray-100")
                      : c("hover:bg-gray-200 text-gray-600", "hover:bg-zinc-800 text-gray-300")
                      }`}
                    title="More options"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className={`w-64 py-1.5 rounded-2xl shadow-2xl border z-50 animate-in fade-in zoom-in-95 duration-100 ${c(
                    "bg-white border-gray-100 text-gray-800",
                    "bg-[#233138] border-[#2a3942] text-white"
                  )}`}
                >
                  <DropdownMenuItem
                    onClick={() => {
                      setIsSearching(true);
                      setShowMenu(false);
                    }}
                    className="px-4 py-3 flex items-center gap-3 cursor-pointer rounded-xl mx-1"
                  >
                    <Search className="w-5 h-5 text-gray-400" />
                    <span className="text-[15px] font-medium">Search in Conversation</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      setIsWallpaperModalOpen(true);
                      setShowMenu(false);
                    }}
                    className="px-4 py-3 flex items-center gap-3 cursor-pointer rounded-xl mx-1"
                  >
                    <Palette className="w-5 h-5 text-pink-500" />
                    <span className="text-[15px] font-medium">Chat Wallpaper 💕</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      setTempQuickEmoji(quickReactionEmoji);
                      setIsQuickEmojiModalOpen(true);
                      setShowMenu(false);
                    }}
                    className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer rounded-xl mx-1"
                  >
                    <div className="flex items-center gap-3">
                      <Heart className="w-5 h-5 text-rose-500 fill-rose-500/20" />
                      <span className="text-[15px] font-medium">Quick Reaction</span>
                    </div>
                    <span className="text-xl leading-none px-1.5 py-0.5 rounded-lg bg-black/5 dark:bg-white/10">{quickReactionEmoji}</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      setIsMyProfileOpen(true);
                      setShowMenu(false);
                    }}
                    className="px-4 py-3 flex items-center gap-3 cursor-pointer rounded-xl mx-1"
                  >
                    <UserIcon className="w-5 h-5 text-gray-400" />
                    <span className="text-[15px] font-medium">My Profile</span>
                  </DropdownMenuItem>

                  {/* Real Notification Toggler */}
                  <div
                    onClick={async (e) => {
                      e.stopPropagation();
                      const next = !notificationsEnabled;
                      setNotificationsEnabled(next);
                      try {
                        localStorage.setItem("duonexus_notifications", String(next));
                      } catch { }

                      if (next) {
                        if (typeof window !== "undefined" && "Notification" in window) {
                          if (Notification.permission === "default") {
                            const perm = await Notification.requestPermission();
                            if (perm === "granted") {
                              toast({
                                title: "Notifications Active 🔔",
                                description: "You will receive alerts for new messages.",
                              });
                            } else {
                              toast({
                                title: "Notification Permission Blocked",
                                description: "Please enable notifications in your browser settings.",
                                variant: "destructive",
                              });
                            }
                          } else if (Notification.permission === "granted") {
                            toast({
                              title: "Notifications Active 🔔",
                              description: "Alerts enabled for all new messages.",
                            });
                          }
                        } else {
                          toast({
                            title: "Notifications Active 🔔",
                            description: "Chat sound & alerts are enabled.",
                          });
                        }
                      } else {
                        toast({
                          title: "Notifications Muted 🔕",
                          description: "Chat notifications are muted.",
                        });
                      }
                    }}
                    className={`w-full px-4 py-3 flex items-center justify-between gap-3 cursor-pointer rounded-xl mx-1 transition-colors ${c(
                      "hover:bg-gray-100",
                      "hover:bg-white/10"
                    )}`}
                  >
                    <div className="flex items-center gap-3">
                      {notificationsEnabled ? (
                        <Bell className="w-5 h-5 text-emerald-400 shrink-0" />
                      ) : (
                        <BellOff className="w-5 h-5 text-gray-400 shrink-0" />
                      )}
                      <div className="flex flex-col text-left">
                        <span className="text-[15px] font-medium leading-tight">Notifications</span>
                        <span className="text-[11px] opacity-60 leading-tight mt-0.5">
                          {notificationsEnabled ? "Active" : "Muted"}
                        </span>
                      </div>
                    </div>
                    <Switch
                      checked={notificationsEnabled}
                      onCheckedChange={() => { }}
                      className="data-[state=checked]:bg-emerald-500 pointer-events-none"
                    />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ) : (
          /* DESKTOP HEADER (≥768px): Completely untouched desktop layout */
          <>
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 animate-in fade-in slide-in-from-left-4 duration-200">
              <button
                onClick={() => {
                  setSelectedConversation(null);
                }}
                className="hidden w-10 h-10 flex-shrink-0 items-center justify-center -ml-2 rounded-full transition-colors hover:bg-gray-200 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-200"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>

              <div
                onClick={() => setIsPartnerProfileSheetOpen(true)}
                className="relative flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
              >
                <img
                  src={partnerAvatar}
                  alt={finalPartnerName}
                  className={`w-10 h-10 rounded-full object-cover border shadow-sm ${c(
                    "border-gray-200 bg-black",
                    "border-zinc-700 bg-black"
                  )}`}
                />
              </div>

              <div
                onClick={() => setIsPartnerProfileSheetOpen(true)}
                className="flex flex-col cursor-pointer hover:opacity-90 transition-opacity flex-1 min-w-0"
              >
                <h1 className={`text-[17px] font-semibold leading-tight flex items-center gap-1 min-w-0 ${c(
                  "text-gray-900",
                  "text-white"
                )}`}>
                  <span className="truncate min-w-0 flex-shrink">{finalPartnerName}</span>
                  <span className="text-red-500 text-sm flex-shrink-0">❤️</span>
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {otherIsTyping ? (
                    <motion.span
                      className="w-2 h-2 rounded-full flex-shrink-0 bg-emerald-400"
                      animate={{ opacity: [1, 0.35, 1], scale: [1, 0.85, 1] }}
                      transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                    />
                  ) : (
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${partnerPresence?.online ? "bg-emerald-500" : "bg-gray-400"
                        }`}
                    />
                  )}
                  <AnimatePresence mode="wait">
                    {otherIsTyping ? (
                      <motion.span
                        key="typing-label"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="text-[13px] font-semibold truncate text-emerald-500"
                      >
                        typing...
                      </motion.span>
                    ) : (
                      <motion.span
                        key="online-label"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className={`text-[13px] font-medium truncate ${c("text-gray-500", "text-gray-400")}`}
                      >
                        {partnerPresence?.online ? "Online" : "Offline"}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-0 sm:gap-1 flex-shrink-0">
              {/* Streak Badge */}
              <div
                onClick={() => setIsStreakModalOpen(true)}
                className={`flex items-center gap-1.5 px-3 h-8 sm:h-9 rounded-full mr-1 sm:mr-2 shadow-sm border flex-shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-all select-none ${chattedToday
                  ? "bg-gradient-to-r from-orange-500 to-rose-500 border-orange-400/40 text-white shadow-orange-500/20 shadow-md"
                  : c("bg-[#2A2726] border-[#1C1A19] text-white", "bg-zinc-800 border-zinc-700 text-amber-400")
                  }`}
                title="Love Streak — Click for details & goals"
              >
                <Flame className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${chattedToday ? "text-white fill-white animate-pulse" : "text-amber-400 fill-amber-400"}`} />
                <span className="text-[12px] sm:text-[13px] font-bold tracking-wide">{streak}</span>
              </div>

              {/* Video Call */}
              <button
                onClick={() => handleStartCall("video")}
                className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full transition-colors ${c(
                  "hover:bg-gray-200 text-gray-600",
                  "hover:bg-zinc-800 text-gray-300"
                )}`}
              >
                <Video className="w-5 h-5 text-blue-500" />
              </button>

              {/* Audio Call */}
              <button
                onClick={() => handleStartCall("audio")}
                className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full transition-colors ${c(
                  "hover:bg-gray-200 text-gray-600",
                  "hover:bg-zinc-800 text-gray-300"
                )}`}
              >
                <Phone className="w-5 h-5 text-emerald-500" />
              </button>

              {/* Three Dot Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full transition-colors ${showMenu
                    ? c("bg-gray-200 text-gray-800", "bg-zinc-800 text-gray-100")
                    : c("hover:bg-gray-200 text-gray-600", "hover:bg-zinc-800 text-gray-300")
                    }`}
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)}></div>
                    <div
                      className={`absolute right-0 top-full mt-2 w-56 rounded-xl shadow-2xl border z-50 py-1.5 overflow-hidden origin-top-right animate-in fade-in zoom-in-95 duration-100 ${c(
                        "bg-white border-gray-100",
                        "bg-[#2A2726] border-zinc-700"
                      )}`}
                    >
                      <button
                        onClick={() => {
                          setIsSearching(true);
                          setShowMenu(false);
                        }}
                        className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${c(
                          "hover:bg-gray-50 text-gray-800",
                          "hover:bg-zinc-800 text-gray-200"
                        )}`}
                      >
                        <Search className={`w-5 h-5 ${c("text-gray-500", "text-gray-400")}`} />
                        <span className="text-[15px] font-medium">Search in Conversation</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsWallpaperModalOpen(true);
                          setShowMenu(false);
                        }}
                        className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${c(
                          "hover:bg-gray-50 text-gray-800",
                          "hover:bg-zinc-800 text-gray-200"
                        )}`}
                      >
                        <Palette className="w-5 h-5 text-pink-500" />
                        <span className="text-[15px] font-medium">Chat Wallpaper 💕</span>
                      </button>

                      {/* Quick Reaction Customizer Option */}
                      <button
                        onClick={() => {
                          setTempQuickEmoji(quickReactionEmoji); // seed with current saved
                          setIsQuickEmojiModalOpen(true);
                          setShowMenu(false);
                        }}
                        className={`w-full px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors ${c(
                          "hover:bg-gray-50 text-gray-800",
                          "hover:bg-zinc-800 text-gray-200"
                        )}`}
                      >
                        <div className="flex items-center gap-3">
                          <Heart className="w-5 h-5 text-rose-500 fill-rose-500/20" />
                          <span className="text-[15px] font-medium">Quick Reaction</span>
                        </div>
                        <span className="text-xl leading-none px-1 py-0.5 rounded-lg bg-black/5 dark:bg-white/5">{quickReactionEmoji}</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsMyProfileOpen(true);
                          setShowMenu(false);
                        }}
                        className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${c(
                          "hover:bg-gray-50 text-gray-800",
                          "hover:bg-zinc-800 text-gray-200"
                        )}`}
                      >
                        <UserIcon className={`w-5 h-5 ${c("text-gray-500", "text-gray-400")}`} />
                        <span className="text-[15px] font-medium">My Profile</span>
                      </button>

                      <button
                        onClick={() => {
                          setNotificationsEnabled(!notificationsEnabled);
                          setShowMenu(false);
                        }}
                        className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${c(
                          "hover:bg-gray-50 text-gray-800",
                          "hover:bg-zinc-800 text-gray-200"
                        )}`}
                      >
                        {notificationsEnabled ? (
                          <BellOff className={`w-5 h-5 ${c("text-gray-500", "text-gray-400")}`} />
                        ) : (
                          <Bell className={`w-5 h-5 ${c("text-gray-500", "text-gray-400")}`} />
                        )}
                        <span className="text-[15px] font-medium">
                          {notificationsEnabled ? "Mute Notifications" : "Unmute Notifications"}
                        </span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 relative overflow-hidden flex flex-col z-10 bg-transparent">
        <div
          ref={scrollContainerRef}
          onScroll={handleMessagesScroll}
          className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 flex flex-col gap-2 relative z-10 scrollbar-hide bg-transparent smooth-momentum-scroll"
          onClick={() => {
            setActiveMessageMenu(null);
            setActiveReactionMenu(null);
            setActiveFullEmojiPicker(null);
            setShowInputEmojiPicker(false);
            setShowMobileGallery(false);
            setTouchedMessageId(null);
            setSelectedMobileMessage(null);
          }}
        >
          {/* Date Pill */}
          <div className="flex justify-center mb-3">
            <span
              className={`text-xs font-semibold px-4 py-1.5 rounded-full shadow-sm border tracking-wide select-none ${c(
                "bg-white text-gray-500 border-gray-200",
                "bg-[#262322] text-gray-400 border-zinc-800"
              )}`}
            >
              Today
            </span>
          </div>

          {/* Empty state */}
          {messages.length === 0 && !messagesLoading && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
              <div className="w-16 h-16 rounded-full bg-pink-500/10 flex items-center justify-center mb-3 animate-pulse">
                <Heart className="w-8 h-8 text-pink-500 fill-pink-500" />
              </div>
              <h3 className={`font-bold text-lg ${c("text-gray-900", "text-white")}`}>Your private space is ready</h3>
              <p className="text-sm text-gray-400 mt-1">Send a message to start chatting 💕</p>
            </div>
          )}

          {/* Search empty state */}
          {debouncedSearchQuery.trim() &&
            messages.filter((m) => (m.content || m.text || "").toLowerCase().includes(debouncedSearchQuery.toLowerCase())).length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center px-4 animate-in fade-in duration-300">
              <Search className={`w-12 h-12 mb-4 opacity-20 ${c("text-gray-900", "text-white")}`} />
              <p className={`text-[16px] font-semibold ${c("text-gray-900", "text-white")}`}>No messages found</p>
              <p className={`text-[14px] mt-1 ${c("text-gray-500", "text-gray-400")}`}>Try searching for another word.</p>
            </div>
          ) : (
            (debouncedSearchQuery.trim()
              ? messages.filter((m) => (m.content || m.text || "").toLowerCase().includes(debouncedSearchQuery.toLowerCase()))
              : messages
            ).map((msg, index, filteredMessages) => {
              const isMe = msg.senderRole ? msg.senderRole === myId : msg.senderUid === user?.uid;
              const nextMsg = index < filteredMessages.length - 1 ? filteredMessages[index + 1] : null;
              const isLastInGroup = !nextMsg || (nextMsg.senderRole ? nextMsg.senderRole !== msg.senderRole : nextMsg.senderUid !== msg.senderUid);
              const msgContent = msg.content || msg.text || "";

              // Format message time
              const msgTs = msg.timestamp?.seconds ? msg.timestamp.seconds * 1000 : Date.now();
              const timeStr = format(new Date(msgTs), "h:mm a");

              const actionButtons = (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute ${isMe ? "right-0 sm:right-full sm:mr-1.5 flex-row-reverse" : "left-0 sm:left-full sm:ml-1.5 flex-row"
                    } -top-10 sm:inset-y-0 sm:my-auto sm:h-8 flex items-center gap-1 px-1.5 py-0.5 rounded-full shadow-md sm:shadow-none bg-white sm:bg-transparent dark:bg-zinc-800 sm:dark:bg-transparent border border-gray-100 sm:border-transparent dark:border-zinc-700 sm:dark:border-transparent transition-opacity duration-200 z-30 ${activeMessageMenu === msg.id || activeReactionMenu === msg.id || activeFullEmojiPicker === msg.id || touchedMessageId === msg.id
                      ? "opacity-100 pointer-events-auto"
                      : "opacity-0 sm:group-hover:opacity-100 pointer-events-none sm:group-hover:pointer-events-auto"
                    }`}
                >
                  {/* Reaction button */}
                  {!msg.isDeleted && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const openDown = rect.top < 410;
                          setMenuPlacement(openDown ? "down" : "up");

                          if (activeReactionMenu === msg.id || activeFullEmojiPicker === msg.id) {
                            setActiveReactionMenu(null);
                            setActiveFullEmojiPicker(null);
                          } else {
                            setActiveReactionMenu(msg.id);
                            setActiveFullEmojiPicker(null);
                          }
                          setActiveMessageMenu(null);
                          setIsCustomizingReactions(false);
                        }}
                        className={`w-8 h-8 flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95 ${activeReactionMenu === msg.id || activeFullEmojiPicker === msg.id
                          ? c("bg-[#D1E0DA] text-gray-900 shadow-sm", "bg-zinc-700 text-white shadow-sm")
                          : c("bg-[#E8F0ED] hover:bg-[#D1E0DA] text-gray-700", "bg-zinc-800 hover:bg-zinc-700 text-gray-300")
                          }`}
                        title="React"
                      >
                        <Smile className="w-[16px] h-[16px]" />
                      </button>

                      {/* Step 1: Floating Quick Reaction Bar (6 emojis + Plus button) */}
                      {activeReactionMenu === msg.id && (
                        <>
                          <div
                            className="fixed inset-0 z-40 cursor-default"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveReactionMenu(null);
                            }}
                          />
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute ${menuPlacement === "down" ? "top-full mt-2" : "bottom-full mb-2"} ${isMe ? "right-0" : "left-0"
                              } ${menuPlacement === "down" ? (isMe ? "origin-top-right" : "origin-top-left") : (isMe ? "origin-bottom-right" : "origin-bottom-left")
                              } flex items-center gap-0.5 sm:gap-1 p-1 sm:p-1.5 rounded-full shadow-2xl border z-50 animate-in fade-in zoom-in-90 duration-150 select-none ${c(
                                "bg-white/95 backdrop-blur-xl border-gray-100 text-gray-900 shadow-black/15",
                                "bg-[#242426]/95 backdrop-blur-xl border-zinc-800 text-gray-100 shadow-black/40"
                              )}`}
                          >
                            {quickReactions.slice(0, 6).map((emoji, slotIdx) => (
                              <button
                                key={slotIdx}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReact(msg.id, emoji);
                                  setActiveReactionMenu(null);
                                }}
                                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-[20px] sm:text-[22px] rounded-full hover:scale-130 active:scale-95 transition-all duration-150 hover:-translate-y-0.5 cursor-pointer"
                                title={emoji}
                              >
                                {emoji}
                              </button>
                            ))}

                            {/* Plus button to open full emoji reaction picker */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                const openDown = rect.top < 410;
                                setMenuPlacement(openDown ? "down" : "up");

                                setActiveReactionMenu(null);
                                setActiveFullEmojiPicker(msg.id);
                              }}
                              className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95 ml-0.5 cursor-pointer ${c(
                                "bg-gray-100 hover:bg-gray-200 text-gray-600",
                                "bg-zinc-800 hover:bg-zinc-700 text-gray-300"
                              )}`}
                              title="More reactions"
                            >
                              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                            </button>
                          </div>
                        </>
                      )}

                      {/* Step 2: Full Reaction Picker (Opened when clicking '+' on quick reaction bar) */}
                      {activeFullEmojiPicker === msg.id && (
                        <>
                          <div
                            className="fixed inset-0 z-40 cursor-default"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveFullEmojiPicker(null);
                              setIsCustomizingReactions(false);
                            }}
                          />
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute ${menuPlacement === "down" ? "top-full mt-2" : "bottom-full mb-3.5"} ${isMe ? "right-0" : "left-0"
                              } ${menuPlacement === "down" ? (isMe ? "origin-top-right" : "origin-top-left") : (isMe ? "origin-bottom-right" : "origin-bottom-left")
                              } w-[300px] sm:w-[325px] max-h-[min(395px,calc(100vh-140px))] h-[395px] flex flex-col rounded-3xl shadow-2xl border z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden ${c(
                                "bg-white border-gray-100 text-gray-900",
                                "bg-[#242426] border-zinc-800 text-gray-100"
                              )}`}
                          >
                            {/* Search Header */}
                            <div className={`p-3 pb-2 shrink-0 border-b ${c("border-gray-100", "border-zinc-800/80")}`}>
                              <div className={`flex items-center px-3 py-1.5 rounded-full ${c("bg-gray-100 text-gray-800", "bg-zinc-800 text-gray-200")}`}>
                                <Search className="w-4 h-4 mr-2 text-gray-400 shrink-0" />
                                <input
                                  type="text"
                                  placeholder="Search emoji"
                                  value={emojiSearchQuery}
                                  onChange={(e) => setEmojiSearchQuery(e.target.value)}
                                  className="bg-transparent outline-none text-[13px] w-full"
                                />
                                {emojiSearchQuery && (
                                  <button
                                    type="button"
                                    onClick={() => setEmojiSearchQuery("")}
                                    className="text-gray-400 hover:text-gray-200 ml-1"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Your reactions / Customise Header */}
                            <div className="px-3.5 pt-2 pb-1 flex items-center justify-between shrink-0">
                              <span className="text-[12px] font-semibold text-muted-foreground">
                                {isCustomizingReactions ? "Choose slot to customize:" : "Your reactions"}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsCustomizingReactions(!isCustomizingReactions);
                                }}
                                className="text-[12px] font-bold text-blue-500 hover:underline cursor-pointer"
                              >
                                {isCustomizingReactions ? "Done" : "Customise"}
                              </button>
                            </div>

                            {/* 6 Quick Reaction Emojis */}
                            <div className="px-3 pb-2 flex items-center justify-between shrink-0">
                              {quickReactions.map((emoji, slotIdx) => (
                                <button
                                  key={slotIdx}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isCustomizingReactions) {
                                      setSelectedCustomizeSlot(slotIdx);
                                    } else {
                                      handleReact(msg.id, emoji);
                                      setActiveFullEmojiPicker(null);
                                    }
                                  }}
                                  className={cn(
                                    "w-10 h-10 flex items-center justify-center text-[24px] rounded-xl transition-all",
                                    isCustomizingReactions && selectedCustomizeSlot === slotIdx
                                      ? "ring-2 ring-blue-500 bg-blue-500/15 scale-110"
                                      : "hover:scale-125 hover:bg-muted/40 active:scale-95"
                                  )}
                                  title={isCustomizingReactions ? `Slot ${slotIdx + 1}` : emoji}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>

                            {/* Category Header */}
                            <div className="px-3.5 pt-1 pb-1 shrink-0">
                              <span className="text-[12px] font-semibold text-muted-foreground">
                                {emojiSearchQuery ? "Search Results" : emojiActiveCategory}
                              </span>
                            </div>

                            {/* Emoji Grid */}
                            <div className="flex-1 overflow-y-auto px-3 pb-2 scrollbar-hide">
                              {(() => {
                                const displayEmojis = emojiSearchQuery.trim()
                                  ? searchEmojis(
                                    emojiSearchQuery,
                                    Object.values(fullEmojiCategories).flat()
                                  )
                                  : fullEmojiCategories[emojiActiveCategory] || [];

                                if (displayEmojis.length === 0) {
                                  return (
                                    <div className="flex flex-col items-center justify-center h-28 text-center text-xs text-muted-foreground">
                                      No emoji found
                                    </div>
                                  );
                                }

                                return (
                                  <div className="grid grid-cols-6 gap-1">
                                    {displayEmojis.map((emoji) => (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (isCustomizingReactions) {
                                            const updated = [...quickReactions];
                                            updated[selectedCustomizeSlot] = emoji;
                                            setQuickReactions(updated);
                                            try {
                                              localStorage.setItem("customReactions", JSON.stringify(updated));
                                            } catch { }
                                            setSelectedCustomizeSlot((prev) => (prev + 1) % 6);
                                          } else {
                                            handleReact(msg.id, emoji);
                                            setActiveFullEmojiPicker(null);
                                          }
                                        }}
                                        className="w-10 h-10 flex items-center justify-center text-[22px] rounded-xl hover:scale-125 hover:bg-muted/30 transition-transform"
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Bottom Category Icon Bar */}
                            {!emojiSearchQuery && (
                              <div className={`flex items-center justify-between px-2 py-1.5 border-t shrink-0 ${c("border-gray-100 bg-gray-50/90", "border-zinc-800 bg-[#1e1e20]")}`}>
                                {emojiTabIcons.map((tab) => (
                                  <button
                                    key={tab.key}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEmojiActiveCategory(tab.key);
                                    }}
                                    className={cn(
                                      "w-7 h-7 flex items-center justify-center rounded-lg transition-colors text-xs",
                                      emojiActiveCategory === tab.key
                                        ? "text-blue-500 bg-blue-500/15 font-bold"
                                        : "text-muted-foreground hover:text-foreground"
                                    )}
                                    title={tab.label}
                                  >
                                    {tab.icon}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Tooltip speech caret pointing toward the Smile button */}
                            <div
                              className={`absolute w-0 h-0 border-x-8 border-x-transparent ${isMe ? "right-3.5" : "left-3.5"
                                } ${menuPlacement === "down"
                                  ? `-top-2 border-b-8 border-t-0 ${c("border-b-white", "border-b-[#242426]")}`
                                  : `-bottom-2 border-t-8 border-b-0 ${c("border-t-white", "border-t-[#242426]")}`
                                }`}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Reply */}
                  {!msg.isDeleted && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReplyingTo(msg);
                        setTouchedMessageId(null);
                        setActiveMessageMenu(null);
                        setActiveReactionMenu(null);
                        setActiveFullEmojiPicker(null);
                        inputRef.current?.focus();
                      }}
                      className={`w-8 h-8 flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95 flex-shrink-0 ${c(
                        "bg-[#E8F0ED] hover:bg-[#D1E0DA] text-gray-700",
                        "bg-zinc-800 hover:bg-zinc-700 text-gray-300"
                      )}`}
                      title="Reply"
                    >
                      <CornerUpLeft className="w-[16px] h-[16px]" />
                    </button>
                  )}

                  {/* More Menu */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const openDown = rect.top < 240;
                        setMenuPlacement(openDown ? "down" : "up");
                        setActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id);
                        setActiveReactionMenu(null);
                        setActiveFullEmojiPicker(null);
                      }}
                      className={`w-8 h-8 flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95 flex-shrink-0 ${activeMessageMenu === msg.id
                        ? c("bg-[#D1E0DA] text-gray-900 shadow-sm", "bg-zinc-700 text-white shadow-sm")
                        : c("bg-[#E8F0ED] hover:bg-[#D1E0DA] text-gray-700", "bg-zinc-800 hover:bg-zinc-700 text-gray-300")
                        }`}
                      title="More options"
                    >
                      <MoreVertical className="w-[16px] h-[16px]" />
                    </button>

                    {activeMessageMenu === msg.id && (
                      <>
                        <div
                          className="fixed inset-0 z-40 cursor-default"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMessageMenu(null);
                          }}
                        />
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className={`absolute ${menuPlacement === "down" ? "top-full mt-2" : "bottom-full mb-2"
                            } ${isMe ? "right-0" : "left-0"} ${menuPlacement === "down"
                              ? (isMe ? "origin-top-right" : "origin-top-left")
                              : (isMe ? "origin-bottom-right" : "origin-bottom-left")
                            } w-48 rounded-xl shadow-2xl border z-50 py-1.5 animate-in fade-in zoom-in-95 duration-100 ${c(
                              "bg-white border-gray-200 text-gray-900",
                              "bg-[#2A2726] border-zinc-700 text-gray-100"
                            )}`}
                        >
                          {/* Reply option */}
                          {!msg.isDeleted && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReplyingTo(msg);
                                setActiveMessageMenu(null);
                                inputRef.current?.focus();
                              }}
                              className={`w-full px-4 py-2 flex items-center gap-3 text-left transition-colors ${c(
                                "hover:bg-gray-50 text-gray-800",
                                "hover:bg-zinc-800 text-gray-200"
                              )}`}
                            >
                              <CornerUpLeft className="w-4 h-4 text-blue-500" />
                              <span className="text-[14px] font-medium">Reply</span>
                            </button>
                          )}

                          {!msg.isDeleted && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(msg.id, msgContent);
                              }}
                              className={`w-full px-4 py-2 flex items-center gap-3 text-left transition-colors ${c(
                                "hover:bg-gray-50 text-gray-800",
                                "hover:bg-zinc-800 text-gray-200"
                              )}`}
                            >
                              {copiedMessageId === msg.id ? (
                                <>
                                  <CheckCheck className="w-4 h-4 text-emerald-500" />
                                  <span className="text-[14px] font-medium text-emerald-500">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4 text-gray-500" />
                                  <span className="text-[14px] font-medium">Copy text</span>
                                </>
                              )}
                            </button>
                          )}

                          {isMe && !msg.isDeleted && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteForEveryone(msg.id);
                              }}
                              className={`w-full px-4 py-2 flex items-center gap-3 text-left transition-colors ${c(
                                "hover:bg-gray-50 text-red-600",
                                "hover:bg-zinc-800 text-red-400"
                              )}`}
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="text-[14px] font-medium">Unsend for everyone</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteForMe(msg.id);
                            }}
                            className={`w-full px-4 py-2 flex items-center gap-3 text-left transition-colors ${c(
                              "hover:bg-gray-50 text-red-600",
                              "hover:bg-zinc-800 text-red-400"
                            )}`}
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="text-[14px] font-medium">Remove for you</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );

              const isSticker =
                !msg.isDeleted &&
                (msg.type === "sticker" ||
                  (typeof msgContent === "string" &&
                    (msgContent.includes("notoemoji") ||
                      msgContent.includes("fonts.gstatic.com/s/e/notoemoji"))));

              const isMsgSelectedOnMobile = isMobile && selectedMobileMessage?.id === msg.id;

              return (
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  className={`chat-message-item flex ${isMe ? "justify-end" : "justify-start"} relative group items-center mb-1 transition-colors ${
                    isMsgSelectedOnMobile
                      ? "bg-[#005c4b]/20 dark:bg-[#005c4b]/30 -mx-3 px-3 py-1 rounded-none"
                      : ""
                  } ${debouncedSearchQuery.trim() ? "cursor-pointer hover:bg-white/5 p-1 rounded-xl transition-colors" : ""
                    }`}
                  onClick={() => {
                    if (debouncedSearchQuery.trim()) scrollToMessage(msg.id);
                  }}
                >
                  {/* Partner Avatar for incoming messages */}
                  {!isMe && (
                    <div className="w-8 flex-shrink-0 mr-2 flex flex-col justify-end pb-1 self-end">
                      {isLastInGroup ? (
                        <img
                          src={partnerAvatar}
                          alt={finalPartnerName}
                          className="w-8 h-8 rounded-full object-cover shadow-sm border border-white/10 bg-black"
                        />
                      ) : (
                        <div className="w-8 h-8" />
                      )}
                    </div>
                  )}

                  <div className="relative flex items-center max-w-[85%] sm:max-w-[75%] md:max-w-[65%] lg:max-w-[55%] xl:max-w-[520px]">
                    {/* Mobile Floating Quick Reaction Bar (Screenshot 2) */}
                    {isMsgSelectedOnMobile && !isMobileReactionSheetOpen && (
                      <MobileReactionPill
                        message={msg}
                        quickReactions={quickReactions}
                        sheetOpen={isMobileReactionSheetOpen}
                        onReact={(emoji) => {
                          handleReact(msg.id, emoji);
                          setSelectedMobileMessage(null);
                        }}
                        onOpenFullPicker={() => {
                          setIsMobileReactionSheetOpen(true);
                        }}
                        isMe={isMe}
                      />
                    )}

                    {isMe && actionButtons}

                    <div
                      onClick={(e) => {
                        if (isMobile) {
                          e.stopPropagation();
                          if (selectedMobileMessage?.id === msg.id) {
                            setSelectedMobileMessage(null);
                          } else {
                            setSelectedMobileMessage(msg);
                            setActiveReactionMenu(null);
                            setActiveMessageMenu(null);
                            setActiveFullEmojiPicker(null);
                          }
                        } else if (!debouncedSearchQuery.trim()) {
                          setTouchedMessageId(touchedMessageId === msg.id ? null : msg.id);
                        }
                      }}
                      className={cn(
                        "relative w-full transition-all",
                        isSticker
                          ? "bg-transparent border-none shadow-none px-0 py-0 flex flex-col items-end"
                          : cn(
                            "px-4 py-2.5 shadow-sm rounded-2xl",
                            isMe ? "rounded-br-sm" : "rounded-bl-sm",
                            isMe
                              ? c("bg-[#D3F34B] text-[#1C1C1C]", "bg-[#c3e33e] text-[#1C1C1C]")
                              : c("bg-white text-[#1C1C1C] border border-gray-100", "bg-[#242424] text-gray-100 border border-zinc-800")
                          ),
                        msg.isDeleted
                          ? c("bg-transparent border border-gray-300 text-gray-500", "bg-transparent border border-zinc-700 text-gray-400")
                          : ""
                      )}
                    >
                      {/* Reply quote banner */}
                      {(msg.replyTo || msg.replyToContent) && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            const targetId = msg.replyToId || (msg.replyTo as any)?.id;
                            if (targetId) {
                              scrollToMessage(targetId);
                            }
                          }}
                          className={`mb-1.5 p-2 rounded-lg text-[13px] border-l-4 cursor-pointer hover:opacity-85 transition-opacity ${isMe
                            ? "bg-black/10 border-[#1C1C1C]"
                            : c("bg-gray-100 border-blue-500", "bg-zinc-800 border-gray-400")
                            }`}
                          title="Click to view original message"
                        >
                          <p className={`font-bold mb-0.5 text-xs flex items-center gap-1 ${isMe ? "text-[#1C1C1C]" : "text-blue-500"}`}>
                            <CornerUpLeft className="w-3 h-3" />
                            {msg.replyTo?.sender === "me" || msg.replyToSender === myName ? "You" : finalPartnerName}
                          </p>
                          <p className="opacity-90 line-clamp-2">{msg.replyTo?.text || msg.replyToContent}</p>
                        </div>
                      )}

                      {/* Sticker / Image / Video / Audio / Text */}
                      {msg.isDeleted ? (
                        <p className={`text-[14px] leading-relaxed italic flex items-center gap-1.5 py-0.5 select-none ${
                          isMe ? "text-black/60" : "text-gray-400"
                        }`}>
                          <Ban className="w-3.5 h-3.5 opacity-70 shrink-0" />
                          <span>{isMe ? "You unsent a message" : "This message was unsent"}</span>
                        </p>
                      ) : isSticker ? (
                        <div className="relative py-1 flex items-center justify-center select-none">
                          <img
                            src={msgContent}
                            alt="Sticker"
                            className="w-32 h-32 sm:w-40 sm:h-40 object-contain drop-shadow-xl hover:scale-105 active:scale-95 transition-transform"
                            loading="lazy"
                          />
                        </div>
                      ) : msg.type === "image" && msgContent ? (
                        <div className="mb-1 rounded-xl overflow-hidden max-w-sm">
                          <img src={msgContent} alt="Uploaded" className="w-full h-auto max-h-72 object-cover" />
                        </div>
                      ) : msg.type === "video" && msgContent ? (
                        <div className="mb-1 rounded-xl overflow-hidden max-w-sm">
                          <video src={msgContent} controls className="w-full h-auto max-h-72" />
                        </div>
                      ) : (msg.type === "audio" && msgContent) || (msg.type !== "image" && msg.type !== "video" && msg.type !== "sticker" && typeof msgContent === "string" && msgContent.startsWith("data:audio/")) ? (
                        // Voice note player — custom styled, no raw browser widget
                        <ChatAudioMessage
                          src={msgContent}
                          isMe={isMe}
                          waveform={msg.waveform}
                        />
                      ) : (
                        <p className="text-[15px] leading-[1.4] whitespace-pre-wrap font-medium">
                          {debouncedSearchQuery.trim()
                            ? highlightMatch(msgContent, debouncedSearchQuery)
                            : msgContent}
                        </p>
                      )}

                      {/* Link Preview (never show on stickers or deleted messages) */}
                      {!isSticker && !msg.isDeleted && msg.linkPreview && (
                        <div
                          className={`mt-1.5 mb-1.5 rounded-xl border overflow-hidden cursor-pointer ${c(
                            "bg-gray-50 border-gray-200",
                            "bg-[#1E1E1E] border-zinc-700"
                          )}`}
                        >
                          <div className="p-2.5">
                            <h4 className={`text-[13px] font-semibold leading-snug ${c("text-gray-900", "text-gray-100")}`}>
                              {msg.linkPreview.title}
                            </h4>
                            <p className="text-[11px] font-semibold uppercase text-blue-500">{msg.linkPreview.url}</p>
                          </div>
                        </div>
                      )}

                      {/* Time & Read Status */}
                      {(() => {
                        const computedStatus = isMe && !msg.isDeleted ? getMessageStatus(msg) : null;
                        return (
                          <div
                            className={`flex items-center justify-end gap-1 mt-1 -mb-0.5 select-none ${isSticker
                              ? "bg-black/50 backdrop-blur-md px-2 py-0.5 rounded-full text-white/90 text-[10px] ml-auto w-fit shadow-sm"
                              : msg.isDeleted
                                ? "text-gray-400"
                                : isMe
                                  ? "text-emerald-950/60"
                                  : "text-gray-400"
                              }`}
                          >
                            <span className="text-[10px] font-semibold tracking-wide">{timeStr}</span>
                            {isMe && !msg.isDeleted && (
                              <span className="flex items-center">
                                {computedStatus === "seen" ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-blue-500" strokeWidth={2.5} />
                                ) : computedStatus === "delivered" ? (
                                  <CheckCheck className={`w-3.5 h-3.5 ${isSticker ? "text-emerald-400" : "text-emerald-950/50"}`} strokeWidth={2.5} />
                                ) : (
                                  <svg className={`w-3.5 h-3.5 ${isSticker ? "text-white/70" : "text-emerald-950/50"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                )}
                              </span>
                            )}
                          </div>
                        );
                      })()}

                      {/* Reactions Badge — Clicking opens Messenger-style details */}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingReactionsMsg(msg);
                            setReactionDetailFilter("all");
                          }}
                          className={`absolute -bottom-2.5 ${isMe ? "right-2" : "left-2"} flex items-center gap-1 px-1.5 py-0.5 rounded-full shadow-sm border cursor-pointer z-10 transition-transform hover:scale-105 active:scale-95 select-none ${c(
                            "bg-white border-gray-200 text-gray-800",
                            "bg-[#202c33] border-[#2a3942] text-white"
                          )}`}
                          title="View reactions"
                        >
                          <div className="flex items-center -space-x-0.5">
                            {Array.from(new Set(msg.reactions)).map((r, i) => (
                              <span key={i} className="text-[13px] leading-none">
                                {r}
                              </span>
                            ))}
                          </div>
                          {msg.reactions.length > 1 && (
                            <span className="text-[11px] font-bold opacity-80 ml-0.5">
                              {msg.reactions.length}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {!isMe && actionButtons}
                  </div>
                </div>
              );
            })
          )}
          {/* Typing Indicator — animated in/out with AnimatePresence */}
          <AnimatePresence>
            {otherIsTyping && (
              <motion.div
                key="typing-indicator"
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="flex justify-start items-end gap-2 mb-1 max-w-[85%] sm:max-w-[75%] md:max-w-[65%] lg:max-w-[55%] xl:max-w-[520px]"
              >
                {/* Partner avatar */}
                <div className="shrink-0 w-8 self-end">
                  <img
                    src={partnerAvatar}
                    alt={finalPartnerName}
                    className={`w-8 h-8 rounded-full object-cover border shadow-sm ${c("border-white bg-black", "border-zinc-800 bg-black")}`}
                  />
                </div>

                {/* Bubble */}
                <div
                  className={`px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm border flex items-center gap-1.5 ${c(
                    "bg-white border-gray-100/50 shadow-black/5",
                    "bg-[#242424] border-zinc-800 shadow-black/20"
                  )}`}
                >
                  {[0, 0.15, 0.3].map((delay, i) => (
                    <motion.div
                      key={i}
                      className={`w-[7px] h-[7px] rounded-full ${c("bg-gray-400", "bg-gray-500")}`}
                      animate={{ y: [0, -5, 0] }}
                      transition={{
                        duration: 0.9,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay,
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>

        {/* Floating Scroll to Bottom Button (Messenger style) */}
        {showScrollToBottom && (
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 w-10 h-10 rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 border backdrop-blur-md bg-white/95 dark:bg-zinc-800/95 text-gray-800 dark:text-gray-100 border-gray-200/80 dark:border-zinc-700/80 animate-in fade-in zoom-in-95 group"
            title="Scroll to bottom"
          >
            <ChevronDown className="w-5 h-5 group-hover:translate-y-0.5 transition-transform text-pink-500 dark:text-pink-400 stroke-[2.5]" />
          </button>
        )}
      </div>

      {/* Bottom Input Area */}
      <div
        className="px-3 sm:px-4 pt-2.5 bg-transparent mt-auto z-10 flex flex-col relative shrink-0"
        style={{ paddingBottom: isMobile ? ((showInputEmojiPicker || showMobileGallery) ? "0.5rem" : "max(1.5rem, env(safe-area-inset-bottom))") : "0.75rem" }}
      >
        {/* Replying banner */}
        {replyingTo && (
          <div
            className={`mb-2 px-4 py-2.5 rounded-2xl flex items-center justify-between shadow-sm border animate-in fade-in slide-in-from-bottom-2 ${c(
              "bg-white border-gray-200",
              "bg-[#242424] border-zinc-800"
            )}`}
          >
            <div
              onClick={() => {
                if (replyingTo.id) scrollToMessage(replyingTo.id);
              }}
              className="flex flex-col overflow-hidden border-l-4 border-blue-500 pl-3 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
              title="Click to view message"
            >
              <span className="text-xs font-bold text-blue-500 flex items-center gap-1">
                <CornerUpLeft className="w-3 h-3" />
                Replying to {replyingTo.senderRole === myId ? "Yourself" : finalPartnerName}
              </span>
              <span className="text-[13px] truncate font-medium text-gray-400">
                {getCleanMessagePreview(replyingTo, finalPartnerName).text}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setReplyingTo(null);
              }}
              className="p-1.5 rounded-full hover:bg-zinc-700 text-gray-400 transition-colors"
              title="Cancel reply"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <form onSubmit={handleSendForm} className="flex items-center gap-1 sm:gap-2 relative">
          {/* Left Action Buttons */}
          {!isRecordingAudio && (
            isMobile ? (
              /* MOBILE-ONLY (<768px): Matches real Messenger style */
              inputText.trim() && !showMobileLeftIcons ? (
                /* Mobile Typing Collapsed: [ > ] button */
                <button
                  type="button"
                  onClick={() => setShowMobileLeftIcons(true)}
                  className="w-7 h-7 flex items-center justify-center text-[#00d2ff] hover:bg-[#00d2ff]/10 active:scale-90 transition-all shrink-0 cursor-pointer"
                  title="Show actions"
                >
                  <ChevronRight className="w-6 h-6 stroke-[2.8]" />
                </button>
              ) : (
                /* Mobile Action Buttons: (+) [Camera] [Gallery] [Mic] */
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  {/* Plus button with Popup Menu */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowPlusMenu(!showPlusMenu)}
                      className={`w-7 h-7 rounded-full bg-[#00d2ff] text-slate-950 flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer shrink-0 ${
                        showPlusMenu ? "rotate-45" : ""
                      }`}
                      title="More actions"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                    </button>

                    {/* Popup Menu: Files, Location */}
                    {showPlusMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowPlusMenu(false)}
                        />
                        <div
                          className={`absolute bottom-full left-0 mb-3 w-48 rounded-2xl shadow-2xl border p-2 z-50 animate-in fade-in zoom-in-95 duration-150 ${c(
                            "bg-white border-gray-200 text-gray-800 shadow-xl",
                            "bg-[#242424] border-zinc-800 text-gray-100 shadow-2xl"
                          )}`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setShowPlusMenu(false);
                              galleryInputRef.current?.click();
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${c(
                              "hover:bg-gray-100",
                              "hover:bg-zinc-800"
                            )}`}
                          >
                            <Paperclip className="w-5 h-5 text-[#00d2ff]" />
                            <span>Files</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowPlusMenu(false);
                              handleSendLocation();
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${c(
                              "hover:bg-gray-100",
                              "hover:bg-zinc-800"
                            )}`}
                          >
                            <Navigation className="w-5 h-5 text-[#00d2ff]" />
                            <span>Location</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Camera button — opens full-screen live camera */}
                  <button
                    type="button"
                    onClick={() => {
                      if (showInputEmojiPicker) setShowInputEmojiPicker(false);
                      if (showMobileGallery) setShowMobileGallery(false);
                      setIsCameraModalOpen(true);
                    }}
                    className="w-7 h-7 flex items-center justify-center text-[#00d2ff] hover:bg-[#00d2ff]/10 active:scale-95 transition-all shrink-0 cursor-pointer"
                    title="Live Camera"
                  >
                    <Camera className="w-[22px] h-[22px] stroke-[2.2]" />
                  </button>

                  {/* Gallery button - Opens real device photo & video library */}
                  <button
                    type="button"
                    onClick={() => {
                      if (showInputEmojiPicker) setShowInputEmojiPicker(false);
                      setShowMobileGallery(false);
                      galleryInputRef.current?.click();
                    }}
                    className="w-7 h-7 flex items-center justify-center text-[#00d2ff] hover:bg-[#00d2ff]/10 active:scale-95 transition-all shrink-0 cursor-pointer rounded-full"
                    title="Open device gallery"
                  >
                    <MessengerGalleryIcon className="w-[22px] h-[22px]" />
                  </button>

                  {/* Mic button */}
                  <button
                    type="button"
                    onClick={startAudioRecording}
                    className="w-7 h-7 flex items-center justify-center text-[#00d2ff] hover:bg-[#00d2ff]/10 active:scale-95 transition-all shrink-0 cursor-pointer"
                    title="Record voice note"
                  >
                    <Mic className="w-[22px] h-[22px] stroke-[2.2]" />
                  </button>
                </div>
              )
            ) : (
              /* DESKTOP (≥768px): Untouched desktop layout */
              <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                {inputText.trim() ? (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowPlusMenu(!showPlusMenu)}
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all shadow-sm cursor-pointer ${showPlusMenu
                        ? "bg-[#6952d7] text-white rotate-45"
                        : c("bg-gray-100 text-[#6952d7] hover:bg-gray-200", "bg-zinc-800 text-[#9f8dff] hover:bg-zinc-700")
                        }`}
                      title="Open actions"
                    >
                      <Plus className="w-5 h-5 transition-transform duration-200" />
                    </button>

                    {showPlusMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowPlusMenu(false)}
                        />
                        <div
                          className={`absolute bottom-full left-0 mb-3 w-60 rounded-2xl shadow-2xl border p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 ${c(
                            "bg-white border-gray-200 text-gray-800 shadow-xl",
                            "bg-[#242424] border-zinc-800 text-gray-100 shadow-2xl"
                          )}`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setShowPlusMenu(false);
                              startAudioRecording();
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${c(
                              "hover:bg-gray-100",
                              "hover:bg-zinc-800"
                            )}`}
                          >
                            <Mic className="w-5 h-5 text-[#6952d7] dark:text-[#9f8dff]" />
                            <span>Send a voice clip</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowPlusMenu(false);
                              galleryInputRef.current?.click();
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${c(
                              "hover:bg-gray-100",
                              "hover:bg-zinc-800"
                            )}`}
                          >
                            <ImageIcon className="w-5 h-5 text-[#6952d7] dark:text-[#9f8dff]" />
                            <span>Attach a file up to 100 MB</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowPlusMenu(false);
                              setActiveDesktopPopup("stickers");
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${c(
                              "hover:bg-gray-100",
                              "hover:bg-zinc-800"
                            )}`}
                          >
                            <MessengerStickerIcon className="w-5 h-5 text-[#6952d7] dark:text-[#9f8dff]" />
                            <span>Choose a sticker</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowPlusMenu(false);
                              setActiveDesktopPopup("gifs");
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${c(
                              "hover:bg-gray-100",
                              "hover:bg-zinc-800"
                            )}`}
                          >
                            <MessengerGifIcon className="w-5 h-5 text-[#6952d7] dark:text-[#9f8dff]" />
                            <span>Choose a GIF</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <button
                      type="button"
                      onClick={startAudioRecording}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-[#6952d7] dark:text-[#9f8dff] hover:bg-[#6952d7]/10 dark:hover:bg-[#9f8dff]/10 active:scale-95 transition-all shrink-0 cursor-pointer"
                      title="Send a voice clip"
                    >
                      <Mic className="w-5 h-5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-[#6952d7] dark:text-[#9f8dff] hover:bg-[#6952d7]/10 dark:hover:bg-[#9f8dff]/10 active:scale-95 transition-all shrink-0 cursor-pointer"
                      title="Attach a file up to 100 MB"
                    >
                      <ImageIcon className="w-5 h-5" />
                    </button>

                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveDesktopPopup(activeDesktopPopup === "stickers" ? null : "stickers");
                          setShowInputEmojiPicker(false);
                        }}
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                          activeDesktopPopup === "stickers"
                            ? "text-[#6952d7] dark:text-[#9f8dff] bg-[#6952d7]/15 dark:bg-[#9f8dff]/20 scale-105"
                            : "text-[#6952d7] dark:text-[#9f8dff] hover:bg-[#6952d7]/10 dark:hover:bg-[#9f8dff]/10 active:scale-95"
                        }`}
                        title="Choose a sticker"
                      >
                        <MessengerStickerIcon className="w-5 h-5" />
                      </button>

                      {activeDesktopPopup === "stickers" && (
                        <DesktopStickerPicker
                          open={true}
                          onClose={() => setActiveDesktopPopup(null)}
                          onSelectSticker={(url) => {
                            handleSendMessage(url, "sticker");
                            setActiveDesktopPopup(null);
                          }}
                          darkMode={darkMode}
                        />
                      )}
                    </div>

                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveDesktopPopup(activeDesktopPopup === "gifs" ? null : "gifs");
                          setShowInputEmojiPicker(false);
                        }}
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                          activeDesktopPopup === "gifs"
                            ? "text-[#6952d7] dark:text-[#9f8dff] bg-[#6952d7]/15 dark:bg-[#9f8dff]/20 scale-105"
                            : "text-[#6952d7] dark:text-[#9f8dff] hover:bg-[#6952d7]/10 dark:hover:bg-[#9f8dff]/10 active:scale-95"
                        }`}
                        title="Choose a GIF"
                      >
                        <MessengerGifIcon className="w-5 h-5" />
                      </button>

                      {activeDesktopPopup === "gifs" && (
                        <DesktopGifPicker
                          open={true}
                          onClose={() => setActiveDesktopPopup(null)}
                          onSelectGif={(url) => {
                            handleSendMessage(url, "gif");
                            setActiveDesktopPopup(null);
                          }}
                          darkMode={darkMode}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {/* Central Message Input Pill OR Voice Recording Capsule */}
          <div
            className={`flex-1 rounded-full flex items-center pl-3 pr-1 py-1.5 sm:px-4 sm:py-2.5 shadow-sm border transition-colors relative min-w-0 ${c(
              "bg-white border-gray-200",
              "bg-[#242424] border-zinc-800"
            )}`}
          >
            {isRecordingAudio ? (
              <div className="flex-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs font-mono font-bold text-red-500">
                    {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, "0")}
                  </span>
                </div>

                {/* Real-time fluctuating dynamic waveform */}
                <div className="flex items-center gap-[2px] h-6 px-1 flex-1 justify-center max-w-[170px] mx-1">
                  {liveWaveform.map((amp, i) => (
                    <div
                      key={i}
                      className="w-[3px] bg-red-500 rounded-full transition-all duration-100"
                      style={{ height: `${Math.max(4, Math.min(22, amp))}px` }}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    cancelAudioRecording();
                  }}
                  className="p-1 rounded-full text-muted-foreground hover:text-destructive hover:bg-red-500/10 transition-colors shrink-0"
                  title="Cancel recording"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  ref={inputRef}
                  value={inputText}
                  onClick={() => {
                    if (isMobile && showInputEmojiPicker) {
                      setShowInputEmojiPicker(false);
                    }
                    if (isMobile && showMobileLeftIcons) {
                      setShowMobileLeftIcons(false);
                    }
                  }}
                  onFocus={() => {
                    if (isMobile && showInputEmojiPicker) {
                      setShowInputEmojiPicker(false);
                    }
                    if (isMobile && showMobileLeftIcons) {
                      setShowMobileLeftIcons(false);
                    }
                  }}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    if (isMobile && showMobileLeftIcons) {
                      setShowMobileLeftIcons(false);
                    }
                    if (e.target.value.trim()) {
                      notifyMyTyping();
                    } else {
                      stopMyTyping();
                    }
                  }}
                  onBlur={() => stopMyTyping()}
                  placeholder={isMobile ? "Message" : "Aa"}
                  className={`flex-1 bg-transparent outline-none font-medium min-w-0 text-[14px] sm:text-[15px] ${c(
                    "text-gray-900 placeholder-gray-400",
                    "text-gray-100 placeholder-gray-500"
                  )}`}
                />

                {/* Right Icon Inside Message Capsule */}
                <div className="relative shrink-0 ml-0.5 sm:ml-1.5">
                  {isMobile ? (
                    inputText.trim() ? (
                      /* Mobile Typing: Search Icon inside capsule (Image 2) */
                      <button
                        type="button"
                        onClick={() => {
                          inputRef.current?.blur();
                          if (showMobileGallery) setShowMobileGallery(false);
                          setMediaPickerInitialTab("emojis");
                          setShowInputEmojiPicker(true);
                        }}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[#00d2ff] hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
                        title="Search / Emojis"
                      >
                        <Search className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    ) : (
                      /* Mobile Empty: Smiley Icon inside capsule (Image 1) */
                      <button
                        type="button"
                        onClick={() => {
                          if (showInputEmojiPicker) {
                            setShowInputEmojiPicker(false);
                          } else {
                            inputRef.current?.blur();
                            if (showMobileGallery) setShowMobileGallery(false);
                            setMediaPickerInitialTab("emojis");
                            setShowInputEmojiPicker(true);
                          }
                        }}
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                          showInputEmojiPicker
                            ? "text-[#00d2ff] scale-110"
                            : "text-[#00d2ff] hover:scale-110 active:scale-90"
                        }`}
                        title="Choose an emoji"
                      >
                        <Smile className="w-4.5 h-4.5 stroke-[2.2]" />
                      </button>
                    )
                  ) : (
                    /* Desktop: Original Smile Button with Dedicated Desktop Emoji Picker Popup */
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveDesktopPopup(activeDesktopPopup === "emojis" ? null : "emojis");
                          setShowInputEmojiPicker(false);
                        }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                          activeDesktopPopup === "emojis"
                            ? "text-[#6952d7] dark:text-[#9f8dff] bg-[#6952d7]/15 dark:bg-[#9f8dff]/20 scale-105"
                            : "text-[#6952d7] dark:text-[#9f8dff] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95"
                        }`}
                        title="Choose an emoji"
                      >
                        <Smile className="w-5 h-5" />
                      </button>

                      {activeDesktopPopup === "emojis" && (
                        <DesktopEmojiPicker
                          open={true}
                          onClose={() => setActiveDesktopPopup(null)}
                          onSelectEmoji={handleInsertEmoji}
                          darkMode={darkMode}
                          fullEmojiCategories={fullEmojiCategories}
                          emojiTabIcons={emojiTabIcons}
                        />
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right Outside Button */}
          {isRecordingAudio ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                stopAndSendAudioRecording();
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#0084ff] hover:bg-[#0073e6] active:scale-95 text-white flex items-center justify-center shrink-0 shadow-md transition-all"
              title="Send voice note"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          ) : inputText.trim() ? (
            /* Send Button (when typing) */
            <button
              type="submit"
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
                isMobile
                  ? "text-[#00d2ff] hover:scale-110 active:scale-90"
                  : "bg-[#0084ff] hover:bg-[#0073e6] active:scale-95 text-white shadow-md"
              }`}
              title="Send message"
            >
              <Send className="w-5 h-5 ml-0.5 stroke-[2.2]" />
            </button>
          ) : isMobile ? (
            /* Mobile empty: Quick reaction emoji (😘) on right */
            <button
              type="button"
              onClick={() => handleSendMessage(quickReactionEmoji, "text")}
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 hover:scale-110 active:scale-90 transition-transform cursor-pointer select-none text-[22px] leading-none"
              title={`Send quick reaction (${quickReactionEmoji})`}
            >
              <span className="leading-none select-none">{quickReactionEmoji}</span>
            </button>
          ) : (
            /* Desktop empty: Quick reaction emoji */
            <button
              type="button"
              onClick={handleSendQuickLike}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 hover:scale-115 active:scale-90 transition-transform cursor-pointer select-none text-2xl leading-none"
              title={`Send quick reaction (${quickReactionEmoji})`}
            >
              <span className="leading-none select-none">{quickReactionEmoji}</span>
            </button>
          )}

          {/* Camera: photo-only, direct camera open on mobile */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={cameraInputRef}
            className="hidden"
            onChange={handleFileUpload}
          />
          {/* Gallery: native device photo and video input */}
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            ref={galleryInputRef}
            className="hidden"
            onChange={handleFileUpload}
          />
        </form>
      </div>

      {/* Mobile Slide-Up Keyboard Replacement Media Picker Panel (<768px) */}
      {!isDesktop && (
        <AnimatePresence>
          {showInputEmojiPicker && (
            <MessengerMediaPicker
              open={showInputEmojiPicker}
              onClose={() => setShowInputEmojiPicker(false)}
              initialTab={mediaPickerInitialTab}
              onSelectEmoji={handleInsertEmoji}
              onSelectSticker={(url) => {
                handleSendMessage(url, "sticker");
                setShowInputEmojiPicker(false);
              }}
              onSelectGif={(url) => {
                handleSendMessage(url, "gif");
                setShowInputEmojiPicker(false);
              }}
              onBackspace={handleBackspace}
              darkMode={darkMode}
              fullEmojiCategories={fullEmojiCategories}
              emojiTabIcons={emojiTabIcons}
            />
          )}
        </AnimatePresence>
      )}

      {/* Mobile Gallery Picker — Messenger-style bottom sheet (<768px) */}
      {!isDesktop && (
        <AnimatePresence>
          {showMobileGallery && (
            <MessengerGalleryPicker
              open={showMobileGallery}
              onClose={() => setShowMobileGallery(false)}
              onSelectImage={(url, opts) => {
                handleSendMessage(url, "image");
                setShowMobileGallery(false);
              }}
              onOpenNativePicker={() => {
                setShowMobileGallery(false);
                galleryInputRef.current?.click();
              }}
              onOpenCamera={() => {
                setShowMobileGallery(false);
                setIsCameraModalOpen(true);
              }}
              chatPhotos={chatPhotos}
              memoryPhotos={memoryPhotosList}
              darkMode={darkMode}
            />
          )}
        </AnimatePresence>
      )}
    </div>
    );
  };

  // ================= MAIN RENDER =================
  return (
    <>
      {(!isMounted || isMobile) ? (
        currentScreen === "main" ? (
          renderMobileMain()
        ) : (
          renderConversation()
        )
      ) : (
        /* Desktop / Tablet 3-Pane Layout */
        <div
          className={`h-[100dvh] w-full flex flex-row relative font-sans select-none overflow-hidden ${c(
            "bg-[#F6F5F0]",
            "bg-[#121212]"
          )}`}
        >
          {/* Left Nav Rail (72px fixed) */}
          <DesktopNavRail
            activeTab={activeTab}
            onSelectTab={(tab) => {
              setActiveTab(tab);
              if (tab === "chat") {
                setSelectedConversation("karu");
              }
            }}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenOwnProfile={() => setIsMyProfileOpen(true)}
            onGenerateSpark={handleGenerateSpark}
            isGeneratingSpark={isGeneratingSpark}
            myAvatar={myAvatar}
            myName={finalMyName}
            isDark={darkMode}
            onToggleTheme={toggleDarkMode}
          />

          {/* Middle Conversation List Panel (320px-360px) */}
          <ConversationListPanel
            partnerName={finalPartnerName}
            partnerAvatar={partnerAvatar}
            isOnline={!!partnerPresence?.online}
            isTyping={otherIsTyping}
            streak={streak}
            lastMessage={messages.length > 0 ? messages[messages.length - 1] : null}
            isActive={selectedConversation === "karu" && activeTab === "chat"}
            onSelectConversation={() => {
              setActiveTab("chat");
              setSelectedConversation("karu");
            }}
            activeTab={activeTab}
            onSelectTab={(tab) => {
              setActiveTab(tab);
              if (tab === "chat") {
                setSelectedConversation("karu");
              }
            }}
            onOpenAddMemory={() => setIsMemoryDialogOpen(true)}
            onDeleteMemory={(memory) => setMemoryToDelete(memory)}
            memoriesCount={memories?.length || 0}
            memories={memories || []}
          />

          {/* Right Active Panel (flex-1) */}
          <main className="flex-1 h-full min-w-0 flex flex-col relative overflow-hidden">
            {activeTab === "memories" ? (
              renderDesktopMemories()
            ) : activeTab === "home" ? (
              renderDesktopHome()
            ) : activeTab === "tools" ? (
              renderDesktopTools()
            ) : selectedConversation === "karu" ? (
              renderConversation()
            ) : (
              renderDesktopEmpty()
            )}
          </main>
        </div>
      )}

      {/* Custom Reaction Modal — Clicking backdrop dismisses immediately */}
      {showReactionCustomizer && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 animate-in fade-in backdrop-blur-sm cursor-pointer select-none"
          onClick={() => setShowReactionCustomizer(false)}
        >
          <div
            className={`w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden flex flex-col cursor-default ${c(
              "bg-white",
              "bg-[#1C1C1C]"
            )}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between p-4 border-b ${c("border-gray-100", "border-zinc-800")}`}>
              <div className="w-8"></div>
              <h3 className={`text-[17px] font-bold ${c("text-black", "text-white")}`}>Customize reactions</h3>
              <button
                type="button"
                onClick={() => setShowReactionCustomizer(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-gray-400 hover:bg-zinc-700 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 pb-2">
              <div className="flex justify-center gap-2 mb-4">
                {tempReactions.map((emoji, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedSlot(idx)}
                    className={`w-[44px] h-[44px] text-[26px] leading-none rounded-[14px] flex items-center justify-center transition-all ${selectedSlot === idx ? "bg-zinc-800 ring-2 ring-blue-500" : "opacity-40"
                      }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-6 gap-y-3 gap-x-1 mb-4 max-h-48 overflow-y-auto px-1 scrollbar-hide">
                {emojiPalette.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      const newArr = [...tempReactions];
                      newArr[selectedSlot] = emoji;
                      setTempReactions(newArr);
                      setSelectedSlot((prev) => (prev < 5 ? prev + 1 : prev));
                    }}
                    className="h-10 text-[28px] hover:scale-125 transition-transform flex items-center justify-center"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-4 pb-4 flex justify-end gap-3 items-center">
              <button
                onClick={() => setTempReactions([...defaultReactions])}
                className="text-[14px] font-semibold text-blue-500"
              >
                Reset
              </button>
              <button
                onClick={handleSaveReactions}
                className="px-5 py-2 font-semibold rounded-xl bg-blue-600 text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messenger-Style Reaction Details Modal — Tapping background dismisses */}
      {viewingReactionsMsg && (
        <div
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 animate-in fade-in backdrop-blur-sm cursor-pointer select-none"
          onClick={() => setViewingReactionsMsg(null)}
        >
          <div
            className={`w-full max-w-sm rounded-t-[28px] sm:rounded-[24px] shadow-2xl overflow-hidden flex flex-col cursor-default animate-in slide-in-from-bottom-4 duration-200 ${c(
              "bg-white text-gray-900",
              "bg-[#1C1C1C] text-gray-100 border border-zinc-800"
            )}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center justify-between p-4 border-b ${c("border-gray-100", "border-zinc-800")}`}>
              <h3 className="text-[17px] font-bold">Reactions</h3>
              <button
                type="button"
                onClick={() => setViewingReactionsMsg(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-gray-400 hover:bg-zinc-700 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Tabs (All / Specific Emojis) */}
            {(() => {
              const reactionsMap: Record<string, { emoji: string; name: string; avatar?: string }> =
                (viewingReactionsMsg as any).reactionsMap || {};

              // Format reactors list
              const reactors = Object.entries(reactionsMap).length > 0
                ? Object.entries(reactionsMap).map(([uid, r]) => ({
                  uid,
                  name: r.name || (uid === myId ? myName : finalPartnerName),
                  avatar: r.avatar || (uid === partnerId ? partnerAvatar : myAvatar),
                  emoji: r.emoji,
                }))
                : (viewingReactionsMsg.reactions || []).map((emoji, idx) => ({
                  uid: idx === 0 ? myId : partnerId,
                  name: idx === 0 ? myName : finalPartnerName,
                  avatar: idx === 0 ? myAvatar : partnerAvatar,
                  emoji,
                }));

              const uniqueEmojis = Array.from(new Set(reactors.map((r) => r.emoji)));
              const filteredReactors =
                reactionDetailFilter === "all"
                  ? reactors
                  : reactors.filter((r) => r.emoji === reactionDetailFilter);

              return (
                <>
                  {/* Filter tabs */}
                  <div className={`flex items-center gap-2 px-4 py-2 border-b overflow-x-auto scrollbar-hide ${c("border-gray-100", "border-zinc-800")}`}>
                    <button
                      type="button"
                      onClick={() => setReactionDetailFilter("all")}
                      className={`px-3 py-1 rounded-full text-[13px] font-bold transition-colors ${reactionDetailFilter === "all"
                        ? "bg-blue-600 text-white"
                        : c("bg-gray-100 text-gray-600 hover:bg-gray-200", "bg-zinc-800 text-gray-300 hover:bg-zinc-700")
                        }`}
                    >
                      All {reactors.length}
                    </button>
                    {uniqueEmojis.map((emoji) => {
                      const count = reactors.filter((r) => r.emoji === emoji).length;
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setReactionDetailFilter(emoji)}
                          className={`flex items-center gap-1 px-3 py-1 rounded-full text-[13px] font-bold transition-colors ${reactionDetailFilter === emoji
                            ? "bg-blue-600 text-white"
                            : c("bg-gray-100 text-gray-600 hover:bg-gray-200", "bg-zinc-800 text-gray-300 hover:bg-zinc-700")
                            }`}
                        >
                          <span>{emoji}</span>
                          <span>{count}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* List of Reactors */}
                  <div className="p-3 max-h-72 overflow-y-auto space-y-2">
                    {filteredReactors.map((reactor, i) => {
                      const isMeReactor = reactor.uid === myId;
                      return (
                        <div
                          key={i}
                          onClick={() => {
                            if (isMeReactor) {
                              handleReact(viewingReactionsMsg.id, reactor.emoji);
                              setViewingReactionsMsg(null);
                            }
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-2xl transition-colors ${isMeReactor ? "cursor-pointer hover:bg-red-500/10" : ""
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center font-bold text-sm">
                              {reactor.avatar ? (
                                <img src={reactor.avatar} alt={reactor.name} className="w-full h-full object-cover" />
                              ) : (
                                reactor.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-sm">
                                {reactor.name} {isMeReactor && <span className="text-xs text-blue-500 font-bold">(You)</span>}
                              </p>
                              {isMeReactor && (
                                <p className="text-[11px] text-gray-400 font-medium">Click to remove reaction</p>
                              )}
                            </div>
                          </div>
                          <span className="text-[26px] leading-none">{reactor.emoji}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Partner Profile Sheet */}
      <ProfileSheet
        open={isPartnerProfileSheetOpen}
        onClose={() => setIsPartnerProfileSheetOpen(false)}
        mode="partner"
        displayName={finalPartnerName}
        photoURL={partnerAvatar}
        isOnline={partnerPresence?.online || false}
        streak={streak}
        onAudioCall={() => handleStartCall("audio")}
        onVideoCall={() => handleStartCall("video")}
      />

      {/* My Profile Sheet / Dialog */}
      <Dialog open={isMyProfileOpen} onOpenChange={setIsMyProfileOpen}>
        <DialogContent
          className={`max-w-md w-[92vw] sm:w-full rounded-3xl p-6 border shadow-2xl ${c(
            "bg-white border-gray-100 text-gray-900",
            "bg-[#1E1E20] border-zinc-800 text-white"
          )}`}
        >
          <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-white/5">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <span>My Profile</span>
                <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-400 mt-0.5">
                Customize your name & avatar for DuoNexus
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex flex-col items-center gap-5 pt-2 pb-1">
            {/* Avatar with Camera Overlay */}
            <div className="relative group">
              <div className="w-28 h-28 rounded-full border-4 border-blue-500/30 shadow-2xl overflow-hidden bg-black flex items-center justify-center">
                <img
                  src={editMyPhotoURL || myAvatar}
                  alt={finalMyName}
                  className="w-full h-full object-cover"
                />
              </div>

              <button
                type="button"
                onClick={() => myPhotoInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all border-2 border-[#1E1E20]"
                title="Upload new photo"
              >
                <Camera className="w-4 h-4" />
              </button>

              <input
                ref={myPhotoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleMyPhotoUpload}
              />
            </div>

            {/* Quick Preset Avatars / Reset */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditMyPhotoURL(myId === "karu" ? "/avatars/karu.png" : "/avatars/nabin.png")}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${editMyPhotoURL === (myId === "karu" ? "/avatars/karu.png" : "/avatars/nabin.png")
                  ? "bg-blue-600 text-white shadow-sm"
                  : c("bg-gray-100 hover:bg-gray-200 text-gray-700", "bg-zinc-800 hover:bg-zinc-700 text-gray-300")
                  }`}
              >
                Smoke Anime Avatar
              </button>
              <button
                type="button"
                onClick={() => myPhotoInputRef.current?.click()}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${c(
                  "bg-gray-100 hover:bg-gray-200 text-gray-700",
                  "bg-zinc-800 hover:bg-zinc-700 text-gray-300"
                )}`}
              >
                Upload Photo...
              </button>
            </div>

            {/* Role & Status Pill */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Signed in as {myId === "nabin" ? "Nabin " : "Karu"}</span>
            </div>

            {/* Name Input Form */}
            <div className="w-full space-y-1.5">
              <Label htmlFor="my-display-name" className="text-xs font-semibold text-gray-400">
                Display Name
              </Label>
              <div className="relative">
                <Input
                  id="my-display-name"
                  value={editMyName}
                  onChange={(e) => setEditMyName(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={30}
                  className={`h-11 rounded-xl px-3.5 pr-10 font-medium ${c(
                    "bg-gray-50 border-gray-200 focus:border-blue-500 text-gray-900",
                    "bg-zinc-900/90 border-zinc-700 focus:border-blue-500 text-white"
                  )}`}
                />
                <Edit2 className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Save & Action Buttons */}
            <div className="w-full flex flex-col gap-2 pt-2">
              <Button
                type="button"
                onClick={handleSaveMyProfile}
                disabled={isSavingMyProfile || !editMyName.trim()}
                className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                {isSavingMyProfile ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </Button>

              <div className="flex items-center gap-2 w-full">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsMyProfileOpen(false)}
                  className={`flex-1 h-10 rounded-xl text-xs font-semibold ${c(
                    "border-gray-200 text-gray-600 hover:bg-gray-100",
                    "border-zinc-700 text-gray-300 hover:bg-zinc-800"
                  )}`}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleLogout}
                  className="h-10 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log out</span>
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* WebRTC Calling Overlays */}
      {incomingCallInfo && callState === "idle" && (
        <IncomingCall
          partnerName={finalPartnerName}
          partnerAvatar={partnerAvatar}
          callType={incomingCallInfo.type}
          onAccept={() => answerCall(incomingCallInfo.id)}
          onDecline={() => declineCall(incomingCallInfo.id)}
        />
      )}

      {callState !== "idle" && callState !== "ended" && callState !== "declined" && callState !== "missed" && (
        <CallScreen
          partnerName={finalPartnerName}
          partnerAvatar={partnerAvatar}
          callType={callType}
          callState={callState}
          localStream={localStream}
          remoteStream={remoteStream}
          onHangUp={endCall}
          onGenerateSpark={handleGenerateSpark}
          onSwitchCamera={switchCamera}
        />
      )}
      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent
          className={`max-w-md w-[92vw] sm:w-full rounded-3xl p-6 border shadow-2xl ${c(
            "bg-white border-gray-100 text-gray-900",
            "bg-[#1E1E20] border-zinc-800 text-white"
          )}`}
        >
          <DialogHeader className="pb-2 border-b border-white/5">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-primary" />
              <span>Settings</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400">
              Preferences and account settings for DuoNexus
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            {/* Theme Toggle */}
            <div className={`flex items-center justify-between p-3.5 rounded-2xl border ${c("bg-gray-50 border-gray-100", "bg-zinc-900/60 border-zinc-800")}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                  {darkMode ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                </div>
                <div>
                  <p className="text-sm font-semibold">Dark Mode</p>
                  <p className="text-xs text-muted-foreground">{darkMode ? "Dark AMOLED theme" : "Light theme"}</p>
                </div>
              </div>
              <Switch
                checked={darkMode}
                onCheckedChange={toggleDarkMode}
                className="data-[state=checked]:bg-purple-600"
              />
            </div>

            {/* Notifications Toggle */}
            <div className={`flex items-center justify-between p-3.5 rounded-2xl border ${c("bg-gray-50 border-gray-100", "bg-zinc-900/60 border-zinc-800")}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4 text-gray-400" />}
                </div>
                <div>
                  <p className="text-sm font-semibold">Push Notifications</p>
                  <p className="text-xs text-muted-foreground">{notificationsEnabled ? "Alerts enabled" : "Muted"}</p>
                </div>
              </div>
              <Switch
                checked={notificationsEnabled}
                onCheckedChange={handleToggleNotifications}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>

            {/* Message Sounds Toggle */}
            <div className={`flex items-center justify-between p-3.5 rounded-2xl border ${c("bg-gray-50 border-gray-100", "bg-zinc-900/60 border-zinc-800")}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  {soundEffectsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
                </div>
                <div>
                  <p className="text-sm font-semibold">Message Sounds</p>
                  <p className="text-xs text-muted-foreground">{soundEffectsEnabled ? "Sound active" : "Muted"}</p>
                </div>
              </div>
              <Switch
                checked={soundEffectsEnabled}
                onCheckedChange={(checked) => {
                  setSoundEffectsEnabled(checked);
                  try {
                    localStorage.setItem("duonexus_sound_effects", String(checked));
                  } catch {}
                  if (checked) sendAudioRef.current?.play().catch(() => {});
                }}
                className="data-[state=checked]:bg-primary"
              />
            </div>

            {/* HD Quality Default Toggle */}
            <div className={`flex items-center justify-between p-3.5 rounded-2xl border ${c("bg-gray-50 border-gray-100", "bg-zinc-900/60 border-zinc-800")}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center text-[#00d2ff]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">HD Media Default</p>
                  <p className="text-xs text-muted-foreground">{hdDefaultEnabled ? "Upload in 1080p+" : "Standard resolution"}</p>
                </div>
              </div>
              <Switch
                checked={hdDefaultEnabled}
                onCheckedChange={(checked) => {
                  setHdDefaultEnabled(checked);
                  try {
                    localStorage.setItem("duonexus_hd_default", String(checked));
                  } catch {}
                }}
                className="data-[state=checked]:bg-[#00d2ff]"
              />
            </div>

            {/* Profile & Account */}
            <div className={`p-3.5 rounded-2xl border space-y-3 ${c("bg-gray-50 border-gray-100", "bg-zinc-900/60 border-zinc-800")}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border border-primary/20 bg-black">
                    <AvatarImage src={myAvatar} className="rounded-full object-cover" />
                    <AvatarFallback>{finalMyName?.[0] || "U"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-bold">{finalMyName}</p>
                    <p className="text-xs text-muted-foreground capitalize">Role: {myId === "karu" ? "Karu" : "Nabin"}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setIsMyProfileOpen(true);
                  }}
                  className="h-8 text-xs font-semibold text-primary hover:bg-primary/10 rounded-xl"
                >
                  Edit Profile
                </Button>
              </div>
            </div>

            {/* Sign Out */}
            <Button
              onClick={handleSignOut}
              variant="destructive"
              className="w-full h-10 rounded-xl font-bold gap-2 mt-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Memory Dialog */}
      <Dialog open={isMemoryDialogOpen} onOpenChange={setIsMemoryDialogOpen}>
        <DialogContent className="w-[90vw] max-w-sm rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle>Add Memory</DialogTitle>
            <DialogDescription>Save a milestone or memory.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 my-2">
            <Input placeholder="Title (e.g. First Date)" value={memoryTitle} onChange={(e) => setMemoryTitle(e.target.value)} />
            <Input type="date" value={memoryDate} onChange={(e) => setMemoryDate(e.target.value)} />
            <Select value={memoryType} onValueChange={(v: any) => setMemoryType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="anniversary">Anniversary</SelectItem>
                <SelectItem value="milestone">Milestone</SelectItem>
                <SelectItem value="favorite">Favorite</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveMemory} disabled={isSavingMemory} className="w-full">
              {isSavingMemory ? "Saving..." : "Save Memory"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Memory Confirmation Dialog */}
      <Dialog open={!!memoryToDelete} onOpenChange={(open) => { if (!open) setMemoryToDelete(null); }}>
        <DialogContent className={`w-[90vw] max-w-sm rounded-3xl p-6 border shadow-2xl ${c("bg-white text-gray-900 border-gray-100", "bg-[#18181A] text-white border-zinc-800")}`}>
          <DialogHeader className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-2">
              <Trash2 className="w-6 h-6" />
            </div>
            <DialogTitle className="text-lg font-bold font-headline">Delete Milestone?</DialogTitle>
            <DialogDescription className={`text-xs mt-1.5 text-center ${c("text-gray-500", "text-gray-400")}`}>
              Are you sure you want to delete <span className="font-semibold text-foreground">"{memoryToDelete?.title}"</span>? This milestone will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row gap-2 mt-4 sm:justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMemoryToDelete(null)}
              disabled={isDeletingMemory}
              className="flex-1 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDeleteMemory}
              disabled={isDeletingMemory}
              className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold gap-1.5"
            >
              {isDeletingMemory ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wallpaper Dialog */}
      <WallpaperDialog
        open={isWallpaperModalOpen}
        onOpenChange={setIsWallpaperModalOpen}
        currentConfig={wallpaperConfig}
        onSaveConfig={handleSaveWallpaper}
        isDark={darkMode}
      />

      {/* Quick Reaction Customizer Modal (from 3-dots menu) */}
      <Dialog open={isQuickEmojiModalOpen} onOpenChange={(open) => {
        if (!open) setTempQuickEmoji(quickReactionEmoji); // discard if closed without saving
        setIsQuickEmojiModalOpen(open);
      }}>
        <DialogContent className={`max-w-sm sm:max-w-md rounded-[28px] p-5 sm:p-6 border shadow-2xl ${c("bg-white text-gray-900 border-gray-100", "bg-[#1C1C1E] text-white border-zinc-800")}`}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <span>Customize Quick Reaction</span>
              <span className="text-2xl leading-none">{tempQuickEmoji}</span>
            </DialogTitle>
            <DialogDescription className={`text-xs ${c("text-gray-500", "text-gray-400")}`}>
              Pick the emoji that appears next to the text field for instant 1-tap reaction!
            </DialogDescription>
          </DialogHeader>

          {/* Selected emoji live preview (temp until Done) */}
          <div className="flex flex-col items-center justify-center py-3">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-4xl shadow-sm animate-pulse">
              {tempQuickEmoji}
            </div>
            <span className="text-[11px] font-semibold text-muted-foreground mt-2 uppercase tracking-wider">Selected Reaction</span>
          </div>

          {/* Curated Love & Expressive Emojis Grid */}
          <div className="space-y-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider block ${c("text-gray-400", "text-gray-500")}`}>
              Popular Reactions
            </span>
            <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1 scrollbar-hide">
              {[
                "😘", "❤️", "🥰", "😍", "💋", "💖",
                "💕", "🔥", "✨", "🤗", "🥺", "🌹",
                "💐", "👍", "🥳", "💓", "💘", "💌",
                "🌸", "💍", "🕊️", "😻", "💑", "👩‍❤️‍👨",
                "😂", "💯", "🙏", "🙈", "💃", "👑",
              ].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setTempQuickEmoji(emoji)}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center text-2xl transition-all hover:scale-125 active:scale-95 ${tempQuickEmoji === emoji
                    ? "bg-rose-500/20 ring-2 ring-rose-500 shadow-sm"
                    : "hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="mt-3 flex sm:justify-between items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTempQuickEmoji("😘")}
              className="text-xs rounded-full h-8 px-3"
            >
              Reset to Kiss 😘
            </Button>
            <Button
              type="button"
              onClick={() => {
                handleSetQuickReactionEmoji(tempQuickEmoji);
              }}
              className="rounded-full bg-[#6952d7] hover:bg-[#5841cb] text-white h-8 px-4 text-xs font-semibold"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Love Streak Modal */}
      <StreakModal
        open={isStreakModalOpen}
        onOpenChange={setIsStreakModalOpen}
        streak={streak}
        longestStreak={longestStreak}
        chattedToday={chattedToday}
        partnerName={finalPartnerName}
        onUpdateStreak={handleUpdateStreak}
        onClaimReward={async (surprise) => {
          const senderDisplay = myName || (myId === "karu" ? "Karu" : "Nabin");
          const voucherMsg = `🎁 ${senderDisplay} claimed our Day ${surprise.days} Streak Reward!\n\n${surprise.rewardTitle}\n"${surprise.rewardDescription}"\n\n🎟️ Official Voucher: ${surprise.rewardVoucher} 💕`;
          await handleSendMessage(voucherMsg, "text");
          toast({
            title: "Reward Claimed & Sent! 🥳",
            description: `Sent "${surprise.title}" voucher card to your chat with ${finalPartnerName}!`,
          });
        }}
        onStartChat={() => {
          setActiveTab("chat");
          setSelectedConversation("karu");
          if (isMobile) {
            setCurrentScreen("chat");
          }
        }}
      />

      {/* Live Camera Viewfinder Modal */}
      <CameraModal
        open={isCameraModalOpen}
        onOpenChange={setIsCameraModalOpen}
        onCapture={async (dataUrl, type, opts) => {
          await handleSendMessage(dataUrl, type === "video" ? "video" : "image");
          if (opts?.isHD) {
            toast({
              title: "Sent in High Definition ✨",
              description: `${type === "video" ? "HD Video (1080p)" : "HD Photo (1080p+)"} sent to your conversation.`,
            });
          }
        }}
      />

      {/* Mobile-Only WhatsApp Reactions Bottom Sheet with Customizer */}
      {isMobile && (
        <MobileReactionSheet
          open={isMobileReactionSheetOpen}
          onClose={() => {
            setIsMobileReactionSheetOpen(false);
            setSelectedMobileMessage(null);
          }}
          quickReactions={quickReactions}
          onUpdateQuickReactions={(updated) => {
            setQuickReactions(updated);
            try {
              localStorage.setItem("customReactions", JSON.stringify(updated));
            } catch { }
          }}
          onReact={(emoji) => {
            if (selectedMobileMessage) {
              handleReact(selectedMobileMessage.id, emoji);
              setSelectedMobileMessage(null);
            }
          }}
          fullEmojiCategories={fullEmojiCategories}
        />
      )}

      {/* Mobile-Only WhatsApp Message Info Modal with real Sent & Seen timestamps */}
      {isMobile && (
        <MessageInfoModal
          open={!!selectedInfoMessage}
          onClose={() => setSelectedInfoMessage(null)}
          message={selectedInfoMessage}
          isMe={
            selectedInfoMessage
              ? selectedInfoMessage.senderRole === myId || selectedInfoMessage.sender === "me"
              : false
          }
          status={selectedInfoMessage ? getMessageStatus(selectedInfoMessage) : "sent"}
          partnerLastSeenAt={partnerLastSeenAt}
          partnerPresence={partnerPresence}
          partnerName={finalPartnerName}
          myName={finalMyName}
        />
      )}

      {/* Mobile-Only WhatsApp style Delete Message Confirmation Modal */}
      {isMobile && (
        <MobileDeleteMessageModal
          open={!!mobileDeleteMessage}
          message={mobileDeleteMessage}
          myId={myId}
          onClose={() => {
            setMobileDeleteMessage(null);
            setSelectedMobileMessage(null);
          }}
          onDeleteForEveryone={(id) => {
            handleDeleteForEveryone(id);
            toast({ title: "Deleted", description: "Message unsent for everyone." });
            setSelectedMobileMessage(null);
            setMobileDeleteMessage(null);
          }}
          onDeleteForMe={(id) => {
            handleDeleteForMe(id);
            toast({ title: "Deleted", description: "Message removed from this device." });
            setSelectedMobileMessage(null);
            setMobileDeleteMessage(null);
          }}
          isDark={darkMode}
        />
      )}
    </>
  );
}
