"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Smile,
  Mic,
  X,
  Camera,
  RefreshCw,
  Reply,
  Plus,
  Image as ImageIcon,
  Paperclip,
  MapPin,
  Trash2,
  ThumbsUp,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { GifPicker } from "@/components/chat/gif-picker";

interface ReplyingTo {
  id: string;
  senderName: string;
  content: string;
  type: "text" | "image" | "audio" | "video" | "gif" | "sticker";
}

interface MessageInputProps {
  onSendMessage: (
    content: string,
    type: "text" | "image" | "audio" | "video" | "gif" | "sticker",
    waveform?: number[]
  ) => void;
  onTyping: (isTyping: boolean) => void;
  replyingTo?: ReplyingTo | null;
  onCancelReply?: () => void;
}

/** Capture ~40 amplitude samples from an AnalyserNode over a recording */
function createWaveformSampler(stream: MediaStream): {
  stop: () => number[];
} {
  const audioCtx = new (window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext)();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);

  const samples: number[] = [];
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  const interval = setInterval(() => {
    analyser.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
    samples.push(avg / 255); // normalize 0–1
  }, 100);

  return {
    stop: () => {
      clearInterval(interval);
      try {
        audioCtx.close();
      } catch {
        // ignore
      }
      // Downsample to exactly 40 bars
      if (samples.length === 0) return new Array(40).fill(0.1);
      const out: number[] = [];
      for (let i = 0; i < 40; i++) {
        const idx = Math.floor((i / 40) * samples.length);
        out.push(samples[idx] ?? 0.1);
      }
      return out;
    },
  };
}

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to convert blob to base64"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const resizeAndCompressImage = (blob: Blob): Promise<Blob> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1000;
        const MAX_HEIGHT = 1000;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (compressedBlob) => {
            if (compressedBlob) {
              resolve(compressedBlob);
            } else {
              resolve(blob);
            }
          },
          "image/jpeg",
          0.7
        );
      };
      img.onerror = () => resolve(blob);
    };
    reader.onerror = () => resolve(blob);
    reader.readAsDataURL(blob);
  });
};

export function MessageInput({
  onSendMessage,
  onTyping,
  replyingTo,
  onCancelReply,
}: MessageInputProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<"photo" | "video">("photo");
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [capturedMedia, setCapturedMedia] = useState<{
    blob: Blob;
    previewUrl: string;
  } | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveAudioBars, setLiveAudioBars] = useState<number[]>(
    new Array(24).fill(6)
  );

  // Plus menu popover state
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  // Mobile icons collapse state (collapses on small mobile screens when typing to give room)
  const [showLeftIconsOnMobile, setShowLeftIconsOnMobile] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileDocInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const videoChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioTimerRef = useRef<NodeJS.Timeout | null>(null);
  const waveformSamplerRef = useRef<{ stop: () => number[] } | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const audioRecordingStreamRef = useRef<MediaStream | null>(null);
  const liveAudioCtxRef = useRef<AudioContext | null>(null);
  const liveAnimFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (composerRef.current) {
      composerRef.current.focus();
    }
  }, []);

  // Mobile keyboard handler: use visualViewport to keep input visible
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      document.documentElement.style.setProperty("--vvh", `${vv.height}px`);
      if (vv.height < window.innerHeight * 0.8) {
        requestAnimationFrame(() => {
          composerRef.current?.scrollIntoView({
            block: "end",
            behavior: "smooth",
          });
        });
      }
    };

    document.documentElement.style.setProperty("--vvh", `${vv.height}px`);
    vv.addEventListener("resize", handleResize);
    return () => {
      vv.removeEventListener("resize", handleResize);
      document.documentElement.style.removeProperty("--vvh");
    };
  }, []);

  // Focus textarea when reply is set
  useEffect(() => {
    if (replyingTo) {
      setTimeout(() => composerRef.current?.focus(), 50);
    }
  }, [replyingTo]);

  const handleSend = () => {
    const trimmed = message.trim();
    if (trimmed) {
      onSendMessage(trimmed, "text");
      setMessage("");
      if (composerRef.current) {
        composerRef.current.innerText = "";
      }
      onTyping(false);
      setShowLeftIconsOnMobile(false);
      setTimeout(() => composerRef.current?.focus(), 50);
    }
  };

  const handleQuickReaction = () => {
    onSendMessage("👍", "text");
  };

  const handleInput = async (e: React.FormEvent<HTMLDivElement>) => {
    const el = composerRef.current;
    if (!el) return;

    const imgNode = el.querySelector("img");
    if (imgNode) {
      const src = imgNode.src;
      imgNode.remove();
      setMessage(el.innerText);
      if (src) {
        handleKeyboardMedia(src);
      }
      return;
    }

    const currentText = el.innerText;
    setMessage(currentText);
    onTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => onTyping(false), 2000);
  };

  const handleKeyboardMedia = async (src: string) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const mimeType = blob.type || "image/png";
      let finalType: "gif" | "sticker" | "image" = "image";

      if (mimeType === "image/gif") {
        finalType = "gif";
      } else {
        const checkIsSticker = async (imageBlob: Blob): Promise<boolean> => {
          if (imageBlob.size > 1024 * 1024) return false;
          if (
            mimeType !== "image/png" &&
            mimeType !== "image/webp" &&
            mimeType !== "image/gif"
          ) {
            return false;
          }

          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
              const img = new Image();
              img.src = event.target?.result as string;
              img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = Math.min(img.width, 100);
                canvas.height = Math.min(img.height, 100);
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                  resolve(false);
                  return;
                }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                try {
                  const imgData = ctx.getImageData(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                  ).data;
                  for (let i = 3; i < imgData.length; i += 4) {
                    if (imgData[i] < 255) {
                      resolve(true);
                      return;
                    }
                  }
                } catch {
                  // cross-origin error
                }
                resolve(false);
              };
              img.onerror = () => resolve(false);
            };
            reader.onerror = () => resolve(false);
            reader.readAsDataURL(imageBlob);
          });
        };

        const isSticker = await checkIsSticker(blob);
        finalType = isSticker ? "sticker" : "image";
      }

      await sendViaStorage(blob, finalType);
    } catch (err) {
      console.error("Keyboard media process error:", err);
      toast({
        variant: "destructive",
        title: "Process failed",
        description: "Failed to process keyboard media.",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const insertTextAtCursor = (text: string) => {
    const el = composerRef.current;
    if (!el) return;
    el.focus();

    try {
      const sel = window.getSelection();
      let inside = false;
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        inside = el.contains(range.commonAncestorContainer);
      }

      if (!inside) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }

      document.execCommand("insertText", false, text);
    } catch {
      el.innerText += text;
    }
    setMessage(el.innerText);
    onTyping(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    let hasImage = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        hasImage = true;
        break;
      }
    }

    if (hasImage) {
      return;
    }

    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  // --- UPLOAD HELPER ---
  const sendViaStorage = async (
    blob: Blob,
    type: "image" | "audio" | "video" | "sticker" | "gif",
    waveform?: number[]
  ) => {
    setIsUploading(true);
    setUploadProgress(0);

    let processedBlob = blob;
    if (type === "image") {
      processedBlob = await resizeAndCompressImage(blob);
    }

    try {
      const uploadType =
        type === "sticker" || type === "gif" ? "image" : type;
      const url = await uploadToCloudinary(processedBlob, uploadType, (pct) =>
        setUploadProgress(pct)
      );
      onSendMessage(url, type, waveform);
    } catch (err) {
      console.warn(
        "Cloudinary upload failed, attempting fallback to local base64:",
        err
      );

      if (processedBlob.size > 800 * 1024) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: `Cloudinary storage unavailable, and file is too large (${(
            processedBlob.size /
            1024 /
            1024
          ).toFixed(2)}MB). Max fallback size is 800KB.`,
        });
        return;
      }

      try {
        const base64Url = await blobToBase64(processedBlob);
        onSendMessage(base64Url, type, waveform);
      } catch (fallbackErr) {
        console.error("Base64 fallback failed:", fallbackErr);
        toast({
          variant: "destructive",
          title: "Sending failed",
          description: "Could not send the media file.",
        });
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  // --- LOCATION SHARING ---
  const handleShareLocation = () => {
    setIsPlusMenuOpen(false);
    if (!navigator.geolocation) {
      toast({
        variant: "destructive",
        title: "Not supported",
        description: "Geolocation is not supported by your browser.",
      });
      return;
    }

    toast({
      title: "Locating...",
      description: "Fetching your current location...",
    });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        onSendMessage(`📍 My Location: ${mapUrl}`, "text");
        toast({
          title: "Location sent",
          description: "Shared your live location pin.",
        });
      },
      (err) => {
        console.error("Location error:", err);
        toast({
          variant: "destructive",
          title: "Location failed",
          description:
            err.message ||
            "Please allow location permission in your browser to share location.",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // --- CAMERA MODAL ---
  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    if (audioRecordingStreamRef.current) {
      audioRecordingStreamRef.current.getTracks().forEach((t) => t.stop());
      audioRecordingStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setVideoDuration(0);
    setIsRecordingVideo(false);
  };

  const toggleCamera = async () => {
    if (isSwitchingCamera) return;
    const nextFacing = facingMode === "user" ? "environment" : "user";
    setIsSwitchingCamera(true);
    if (videoRef.current) videoRef.current.style.opacity = "0";
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacing },
      });
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      cameraStreamRef.current = newStream;
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        newStream.getVideoTracks()[0].onended = () => stopCamera();
        setTimeout(() => {
          if (videoRef.current) videoRef.current.style.opacity = "1";
        }, 50);
      }
      setFacingMode(nextFacing);
    } catch (err) {
      console.error("Camera flip error:", err);
      if (videoRef.current) videoRef.current.style.opacity = "1";
    } finally {
      setIsSwitchingCamera(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        stream.getVideoTracks()[0].onended = () => stopCamera();
      }
    } catch (err) {
      console.error("Camera access error:", err);
    }
  };

  useEffect(() => {
    if (isCameraOpen) startCamera();
    else stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCameraOpen]);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(videoRef.current, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const previewUrl = URL.createObjectURL(blob);
        setCapturedMedia({ blob, previewUrl });
      },
      "image/jpeg",
      0.85
    );
  };

  const startVideoRecording = async () => {
    if (!cameraStreamRef.current) return;
    const videoTracks = cameraStreamRef.current.getVideoTracks();
    if (videoTracks.length === 0) return;

    let recordTracks: MediaStreamTrack[] = [...videoTracks];
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      audioRecordingStreamRef.current = audioStream;
      recordTracks = [...videoTracks, ...audioStream.getAudioTracks()];
    } catch {
      // Continue without audio if denied
    }

    const recordStream = new MediaStream(recordTracks);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";
    const recorder = new MediaRecorder(recordStream, { mimeType });
    mediaRecorderRef.current = recorder;
    videoChunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) videoChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(videoChunksRef.current, { type: "video/webm" });
      const previewUrl = URL.createObjectURL(blob);
      setCapturedMedia({ blob, previewUrl });
    };

    recorder.start();
    setIsRecordingVideo(true);
    setVideoDuration(0);
    timerRef.current = setInterval(() => setVideoDuration((p) => p + 1), 1000);
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (audioRecordingStreamRef.current) {
      audioRecordingStreamRef.current.getTracks().forEach((t) => t.stop());
      audioRecordingStreamRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecordingVideo(false);
  };

  const handleSendCaptured = async () => {
    if (!capturedMedia) return;
    const { blob } = capturedMedia;
    const type = cameraMode === "photo" ? "image" : "video";
    stopCamera();
    setIsCameraOpen(false);
    setCapturedMedia(null);
    await sendViaStorage(blob, type);
  };

  const cancelCamera = () => {
    if (isRecordingVideo) {
      stopVideoRecording();
    }
    setCapturedMedia(null);
    setIsCameraOpen(false);
  };

  // --- FILE UPLOAD ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    stopCamera();
    setIsCameraOpen(false);
    setCapturedMedia(null);

    await sendViaStorage(
      file,
      file.type.startsWith("video/") ? "video" : "image"
    );
  };

  // Generic document / attachment file handler for Files option in + menu
  const handleDocFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setIsPlusMenuOpen(false);

    if (file.type.startsWith("video/")) {
      await sendViaStorage(file, "video");
    } else if (file.type.startsWith("audio/")) {
      await sendViaStorage(file, "audio");
    } else {
      await sendViaStorage(file, "image");
    }
  };

  // --- REAL VOICE AUDIO RECORDING ---
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      audioRecordingStreamRef.current = stream;

      // Real Web Audio Analyser for live animated waveform visualizer
      const audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
      liveAudioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLiveBars = () => {
        analyser.getByteFrequencyData(dataArray);
        const bars: number[] = [];
        const step = Math.max(1, Math.floor(bufferLength / 24));
        for (let i = 0; i < 24; i++) {
          const val = dataArray[i * step] || 0;
          const height = Math.max(4, Math.min(28, Math.round((val / 255) * 28)));
          bars.push(height);
        }
        setLiveAudioBars(bars);
        liveAnimFrameRef.current = requestAnimationFrame(updateLiveBars);
      };
      liveAnimFrameRef.current = requestAnimationFrame(updateLiveBars);

      // Waveform sampler for final message bubble
      waveformSamplerRef.current = createWaveformSampler(stream);

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (liveAnimFrameRef.current) {
          cancelAnimationFrame(liveAnimFrameRef.current);
        }
        if (
          liveAudioCtxRef.current &&
          liveAudioCtxRef.current.state !== "closed"
        ) {
          try {
            liveAudioCtxRef.current.close();
          } catch {
            // ignore
          }
        }
        const waveform = waveformSamplerRef.current?.stop() ?? [];
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeType || "audio/webm",
        });
        stream.getTracks().forEach((t) => t.stop());
        audioRecordingStreamRef.current = null;

        if (audioChunksRef.current.length > 0) {
          await sendViaStorage(audioBlob, "audio", waveform);
        }
      };

      mediaRecorder.start(100);
      setIsRecordingAudio(true);
      setRecordingSeconds(0);
      if (audioTimerRef.current) clearInterval(audioTimerRef.current);
      audioTimerRef.current = setInterval(
        () => setRecordingSeconds((p) => p + 1),
        1000
      );
      onTyping(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      toast({
        variant: "destructive",
        title: "Microphone blocked",
        description:
          "Please enable microphone permissions in your browser to record voice notes.",
      });
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (audioTimerRef.current) clearInterval(audioTimerRef.current);
    setIsRecordingAudio(false);
    onTyping(false);
  };

  const cancelAudioRecording = () => {
    if (liveAnimFrameRef.current) {
      cancelAnimationFrame(liveAnimFrameRef.current);
    }
    if (
      liveAudioCtxRef.current &&
      liveAudioCtxRef.current.state !== "closed"
    ) {
      try {
        liveAudioCtxRef.current.close();
      } catch {
        // ignore
      }
    }
    waveformSamplerRef.current?.stop();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    if (audioRecordingStreamRef.current) {
      audioRecordingStreamRef.current.getTracks().forEach((t) => t.stop());
      audioRecordingStreamRef.current = null;
    }
    if (audioTimerRef.current) clearInterval(audioTimerRef.current);
    audioChunksRef.current = [];
    setIsRecordingAudio(false);
    setRecordingSeconds(0);
    onTyping(false);
  };

  const formatSeconds = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const hasTypedText = message.trim().length > 0;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {/* Hidden file input for Photo/Gallery picker */}
      <input
        type="file"
        accept="image/*,video/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      {/* Hidden file input for Files (+) menu */}
      <input
        type="file"
        accept="*/*"
        className="hidden"
        ref={fileDocInputRef}
        onChange={handleDocFileChange}
      />

      {/* Upload progress bar */}
      {isUploading && uploadProgress !== null && (
        <div className="mx-2 space-y-1 animate-in slide-in-from-bottom-2">
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-semibold text-cyan-500 uppercase tracking-wider">
              Sending media...
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {uploadProgress}%
            </span>
          </div>
          <Progress value={uploadProgress} className="h-1 rounded-full bg-cyan-500/20" />
        </div>
      )}

      {/* Reply preview strip */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border-l-2 border-primary rounded-xl animate-in slide-in-from-bottom-2 mx-1">
          <Reply className="w-3.5 h-3.5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-primary truncate">
              Replying to {replyingTo.senderName}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {replyingTo.type === "text"
                ? replyingTo.content.slice(0, 60)
                : replyingTo.type === "image"
                ? "📷 Photo"
                : replyingTo.type === "video"
                ? "🎥 Video"
                : replyingTo.type === "gif"
                ? "🎞️ GIF"
                : replyingTo.type === "sticker"
                ? "💝 Sticker"
                : "🎵 Voice note"}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            className="text-muted-foreground hover:text-primary transition-colors shrink-0 p-1"
            title="Cancel reply"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* REAL VOICE RECORDING BAR (Full Feature Real Messenger Audio) */}
      {isRecordingAudio ? (
        <div className="flex items-center gap-2 sm:gap-3 px-3.5 py-2.5 bg-gradient-to-r from-red-500/10 via-cyan-500/10 to-primary/10 border border-red-500/20 rounded-full shadow-inner animate-in fade-in zoom-in-95 duration-200">
          {/* Delete / Trash Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full text-red-500 hover:text-red-600 hover:bg-red-500/10 active:scale-95 transition-all shrink-0"
            onClick={cancelAudioRecording}
            title="Cancel recording"
          >
            <Trash2 className="w-5 h-5" />
          </Button>

          {/* Pulsing recording dot & Live Timer */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
            <span className="text-xs font-mono font-bold text-red-500">
              {formatSeconds(recordingSeconds)}
            </span>
          </div>

          {/* Real-time Dynamic Waveform visualizer */}
          <div className="flex items-center justify-center gap-0.5 sm:gap-1 flex-1 h-8 overflow-hidden px-1">
            {liveAudioBars.map((height, i) => (
              <div
                key={i}
                className="w-1 sm:w-1.5 rounded-full bg-gradient-to-t from-cyan-500 to-blue-500 transition-all duration-75"
                style={{
                  height: `${height}px`,
                  opacity: Math.max(0.35, height / 28),
                }}
              />
            ))}
          </div>

          {/* Send Audio Button */}
          <Button
            size="icon"
            className="h-9 w-9 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white shadow-md hover:scale-105 active:scale-95 transition-all shrink-0"
            onClick={stopAudioRecording}
            title="Send voice note"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        /* MESSENGER STYLE BOTTOM INPUT BAR */
        <div className="flex items-center gap-1 sm:gap-1.5 w-full">
          {/* LEFT SIDE ICONS: [+] [Camera] [Gallery] [Mic] */}
          {/* On mobile: if user is typing, condense to expander button unless expanded */}
          {hasTypedText && !showLeftIconsOnMobile ? (
            <div className="flex items-center sm:hidden shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowLeftIconsOnMobile(true)}
                className="h-9 w-9 rounded-full text-cyan-500 hover:bg-cyan-500/10 active:scale-95 transition-all"
                title="Show actions"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          ) : null}

          <div
            className={cn(
              "items-center gap-0.5 sm:gap-1 shrink-0",
              hasTypedText && !showLeftIconsOnMobile ? "hidden sm:flex" : "flex"
            )}
          >
            {/* 1. PLUS (+) BUTTON with Files & Location popover (NO Play Games!) */}
            <Popover open={isPlusMenuOpen} onOpenChange={setIsPlusMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="h-9 w-9 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-all shrink-0"
                  title="More actions"
                >
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-52 p-1.5 border border-zinc-700/50 bg-zinc-900/95 backdrop-blur-xl text-white rounded-2xl shadow-2xl animate-in zoom-in-95 duration-150"
                side="top"
                align="start"
                sideOffset={12}
              >
                <div className="flex flex-col gap-1">
                  {/* Option 1: Files */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlusMenuOpen(false);
                      fileDocInputRef.current?.click();
                    }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-white/10 active:bg-white/15 transition-all text-left group"
                  >
                    <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                      <Paperclip className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">Files</span>
                      <span className="text-[11px] text-zinc-400">
                        Share documents & media
                      </span>
                    </div>
                  </button>

                  {/* Option 2: Location */}
                  <button
                    type="button"
                    onClick={handleShareLocation}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-white/10 active:bg-white/15 transition-all text-left group"
                  >
                    <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">Location</span>
                      <span className="text-[11px] text-zinc-400">
                        Share current pin
                      </span>
                    </div>
                  </button>
                </div>
              </PopoverContent>
            </Popover>

            {/* 2. CAMERA BUTTON */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-cyan-500 hover:text-cyan-600 hover:bg-cyan-500/10 active:scale-95 transition-all"
              onClick={() => setIsCameraOpen(true)}
              disabled={isUploading}
              title="Camera"
            >
              <Camera className="w-5 h-5" />
            </Button>

            {/* 3. GALLERY / PHOTOS BUTTON */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-cyan-500 hover:text-cyan-600 hover:bg-cyan-500/10 active:scale-95 transition-all"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title="Gallery & Photos"
            >
              <ImageIcon className="w-5 h-5" />
            </Button>

            {/* 4. MICROPHONE BUTTON (Real Voice Note) */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-cyan-500 hover:text-cyan-600 hover:bg-cyan-500/10 active:scale-95 transition-all"
              onClick={startAudioRecording}
              disabled={isUploading}
              title="Record voice note"
            >
              <Mic className="w-5 h-5" />
            </Button>
          </div>

          {/* CENTER: MESSENGER INPUT PILL (Aa / Message) WITH EMOJI ICON ON RIGHT */}
          <div className="flex-1 min-w-0 relative flex items-center bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 focus-within:bg-zinc-100 dark:focus-within:bg-zinc-800 focus-within:ring-2 focus-within:ring-cyan-500/30 rounded-full border border-black/5 dark:border-white/10 transition-all pl-4 pr-1.5 py-1">
            {!message && (
              <div className="absolute left-4 text-muted-foreground/60 pointer-events-none select-none text-[15px]">
                Aa
              </div>
            )}
            <div
              ref={composerRef}
              contentEditable
              role="textbox"
              aria-multiline="true"
              className="min-h-[36px] max-h-[120px] flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none py-2 text-[15px] leading-relaxed touch-manipulation overflow-y-auto text-foreground"
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onFocus={() => {
                setTimeout(() => {
                  composerRef.current?.scrollIntoView({
                    block: "end",
                    behavior: "smooth",
                  });
                }, 300);
              }}
              enterKeyHint="send"
              style={{ fontSize: "15px" }}
            />

            {/* EMOJI ICON INSIDE RIGHT EDGE OF INPUT PILL */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="h-8 w-8 rounded-full text-cyan-500 hover:bg-cyan-500/15 flex items-center justify-center transition-all shrink-0"
                  title="Emoji, Stickers, GIFs"
                >
                  <Smile className="w-5 h-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[92vw] max-w-80 p-3 border border-border/40 bg-card/98 backdrop-blur-2xl rounded-2xl shadow-2xl"
                side="top"
                align="end"
                sideOffset={12}
              >
                <GifPicker
                  onEmojiSelect={(emoji) => insertTextAtCursor(emoji)}
                  onGifSelect={(gifUrl) => {
                    onSendMessage(gifUrl, "gif");
                  }}
                  onStickerSelect={(stickerUrl) => {
                    onSendMessage(stickerUrl, "sticker");
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* RIGHT SIDE: SEND BUTTON (When typing) OR QUICK REACTION (When empty) */}
          <div className="shrink-0 flex items-center">
            {hasTypedText ? (
              <Button
                size="icon"
                className="h-9 w-9 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white shadow-md hover:scale-105 active:scale-95 transition-all"
                onClick={handleSend}
                title="Send message"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </Button>
            ) : (
              <button
                type="button"
                className="h-9 w-9 rounded-full text-cyan-500 hover:bg-cyan-500/10 flex items-center justify-center active:scale-90 transition-all"
                onClick={handleQuickReaction}
                title="Send thumbs up 👍"
              >
                <ThumbsUp className="w-5 h-5 fill-cyan-500 text-cyan-500" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Camera Dialog (Photo & Video capture) */}
      <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
        <DialogContent className="max-w-md w-[95vw] p-0 overflow-hidden bg-black rounded-[2.5rem] border-none">
          <DialogHeader className="p-4 absolute top-0 left-0 right-0 z-10 flex flex-row items-center justify-between bg-gradient-to-b from-black/50 to-transparent">
            <DialogTitle className="text-white font-headline text-sm uppercase tracking-widest">
              {capturedMedia
                ? "Preview"
                : cameraMode === "photo"
                ? "Capture Photo"
                : "Record Video"}
            </DialogTitle>
            <DialogDescription className="sr-only">Capture photo or record video</DialogDescription>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 rounded-full"
              onClick={cancelCamera}
            >
              <X className="w-5 h-5" />
            </Button>
          </DialogHeader>

          <div className="relative aspect-[3/4] bg-black flex items-center justify-center overflow-hidden">
            {!capturedMedia ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{
                    transform: facingMode === "user" ? "scaleX(-1)" : "none",
                    transition: "opacity 0.15s ease",
                  }}
                />
                {isRecordingVideo && (
                  <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-headline animate-pulse">
                    {Math.floor(videoDuration / 60)}:
                    {(videoDuration % 60).toString().padStart(2, "0")}
                  </div>
                )}
              </>
            ) : cameraMode === "photo" ? (
              <img
                src={capturedMedia.previewUrl}
                alt="Captured photo"
                className="w-full h-full object-cover"
              />
            ) : (
              <video
                src={capturedMedia.previewUrl}
                autoPlay
                loop
                playsInline
                className="w-full h-full object-cover"
              />
            )}
          </div>

          <DialogFooter className="p-6 bg-black flex flex-col gap-4">
            {!capturedMedia ? (
              <div className="flex flex-col items-center gap-6 w-full">
                <div className="flex items-center justify-center gap-8">
                  <button
                    onClick={() => setCameraMode("photo")}
                    className={cn(
                      "text-xs font-headline uppercase tracking-widest transition-all",
                      cameraMode === "photo"
                        ? "text-white font-bold"
                        : "text-white/40"
                    )}
                  >
                    Photo
                  </button>
                  <button
                    onClick={() => setCameraMode("video")}
                    className={cn(
                      "text-xs font-headline uppercase tracking-widest transition-all",
                      cameraMode === "video"
                        ? "text-white font-bold"
                        : "text-white/40"
                    )}
                  >
                    Video
                  </button>
                </div>

                <div className="flex items-center justify-between w-full px-8">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white/60 hover:text-white"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="w-6 h-6" />
                  </Button>

                  <div className="relative flex items-center justify-center">
                    {cameraMode === "photo" ? (
                      <button
                        onClick={capturePhoto}
                        className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center transition-all active:scale-90"
                      >
                        <div className="w-12 h-12 bg-white rounded-full" />
                      </button>
                    ) : (
                      <button
                        onClick={
                          isRecordingVideo
                            ? stopVideoRecording
                            : startVideoRecording
                        }
                        className={cn(
                          "w-16 h-16 rounded-full border-4 flex items-center justify-center transition-all active:scale-90",
                          isRecordingVideo ? "border-red-600" : "border-white"
                        )}
                      >
                        {isRecordingVideo ? (
                          <div className="w-6 h-6 bg-red-600 rounded-sm" />
                        ) : (
                          <div className="w-12 h-12 bg-red-600 rounded-full" />
                        )}
                      </button>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white/60 hover:text-white"
                    onClick={toggleCamera}
                  >
                    <RefreshCw className="w-6 h-6" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-4 w-full">
                <Button
                  variant="outline"
                  className="flex-1 rounded-2xl bg-white/10 border-white/20 text-white hover:bg-white/20"
                  onClick={() => setCapturedMedia(null)}
                >
                  Retake
                </Button>
                <Button
                  className="flex-1 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-500/40"
                  onClick={handleSendCaptured}
                  disabled={isUploading}
                >
                  {isUploading ? `${uploadProgress}%` : "Send Moment"}
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
