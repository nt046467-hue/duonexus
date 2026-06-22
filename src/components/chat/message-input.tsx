
"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Smile, Mic, X, Camera, RefreshCw, Reply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { mimeToExt } from "@/lib/mime";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

interface ReplyingTo {
  id: string;
  senderName: string;
  content: string;
  type: "text" | "image" | "audio" | "video";
}

interface MessageInputProps {
  onSendMessage: (
    content: string,
    type: "text" | "image" | "audio" | "video",
    waveform?: number[]
  ) => void;
  onTyping: (isTyping: boolean) => void;
  replyingTo?: ReplyingTo | null;
  onCancelReply?: () => void;
}

const EMOJIS = [
  "❤️", "😘", "😍", "🥰", "🌹", "✨", "🔥", "😭", "😂", "🥺",
  "🌸", "🍕", "💖", "🍓", "🦋", "🥂",
];

/** Capture ~40 amplitude samples from an AnalyserNode over a recording */
function createWaveformSampler(stream: MediaStream): {
  stop: () => number[];
} {
  const audioCtx = new AudioContext();
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
      audioCtx.close();
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
  const [videoDuration, setVideoDuration] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const videoChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioTimerRef = useRef<NodeJS.Timeout | null>(null);
  const waveformSamplerRef = useRef<{ stop: () => number[] } | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Focus textarea when reply is set
  useEffect(() => {
    if (replyingTo) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [replyingTo]);

  const handleSend = () => {
    const trimmed = message.trim();
    if (trimmed) {
      onSendMessage(trimmed, "text");
      setMessage("");
      onTyping(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    onTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => onTyping(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- UPLOAD HELPER ---

  const sendViaStorage = async (
    blob: Blob,
    type: "image" | "audio" | "video",
    waveform?: number[]
  ) => {
    setIsUploading(true);
    setUploadProgress(0);

    let processedBlob = blob;
    if (type === "image") {
      processedBlob = await resizeAndCompressImage(blob);
    }

    try {
      const url = await uploadToCloudinary(processedBlob, type, (pct) => setUploadProgress(pct));
      onSendMessage(url, type, waveform);
    } catch (err) {
      console.warn("Cloudinary upload failed, attempting fallback to local base64:", err);

      // Firestore has a 1MB limit. 800KB is a safe ceiling for base64 size (since base64 is ~33% larger than binary).
      if (processedBlob.size > 800 * 1024) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: `Firebase Storage is not configured, and this file is too large (${(processedBlob.size / 1024 / 1024).toFixed(2)}MB) to send via fallback. Max size is 800KB.`,
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

  // --- CAMERA LOGIC ---

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: true,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setVideoDuration(0);
    setIsRecordingVideo(false);
  };

  const toggleCamera = () => {
    stopCamera();
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  useEffect(() => {
    if (isCameraOpen) startCamera();
    else stopCamera();
  }, [isCameraOpen, facingMode]);

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

  const startVideoRecording = () => {
    if (!videoRef.current?.srcObject) return;
    const stream = videoRef.current.srcObject as MediaStream;
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
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
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecordingVideo(false);
  };

  const handleSendCaptured = async () => {
    if (!capturedMedia) return;
    setIsCameraOpen(false);
    const { blob } = capturedMedia;
    setCapturedMedia(null);
    await sendViaStorage(blob, cameraMode === "photo" ? "image" : "video");
  };

  // --- FILE UPLOAD ---

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    await sendViaStorage(
      file,
      file.type.startsWith("video/") ? "video" : "image"
    );
  };

  // --- AUDIO RECORDING ---

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Start waveform sampler
      waveformSamplerRef.current = createWaveformSampler(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        const waveform = waveformSamplerRef.current?.stop() ?? [];
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        stream.getTracks().forEach((t) => t.stop());
        await sendViaStorage(audioBlob, "audio", waveform);
      };

      mediaRecorder.start();
      setIsRecordingAudio(true);
      setRecordingSeconds(0);
      audioTimerRef.current = setInterval(
        () => setRecordingSeconds((p) => p + 1),
        1000
      );
      onTyping(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
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
    waveformSamplerRef.current?.stop();
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    if (audioTimerRef.current) clearInterval(audioTimerRef.current);
    setIsRecordingAudio(false);
    onTyping(false);
  };

  const formatSeconds = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-2 w-full">
      <input
        type="file"
        accept="image/*,video/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      {/* Upload progress bar */}
      {isUploading && uploadProgress !== null && (
        <div className="mx-1 space-y-1 animate-in slide-in-from-bottom-2">
          <div className="flex justify-between items-center px-1">
            <span className="text-[9px] font-headline uppercase tracking-widest text-primary">
              Sending...
            </span>
            <span className="text-[9px] text-muted-foreground">
              {uploadProgress}%
            </span>
          </div>
          <Progress value={uploadProgress} className="h-1 rounded-full" />
        </div>
      )}

      {/* Reply preview strip */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-3 py-2 bg-primary/8 border-l-2 border-primary rounded-xl animate-in slide-in-from-bottom-2">
          <Reply className="w-3.5 h-3.5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-headline uppercase tracking-widest text-primary">
              {replyingTo.senderName}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {replyingTo.type === "text"
                ? replyingTo.content.slice(0, 60)
                : replyingTo.type === "image"
                ? "📷 Photo"
                : replyingTo.type === "video"
                ? "🎥 Video"
                : "🎵 Voice note"}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            className="text-muted-foreground hover:text-primary transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Audio recording bar */}
      {isRecordingAudio && (
        <div className="flex items-center gap-3 px-4 py-3 bg-primary/10 rounded-2xl mb-1 animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 flex-1">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" />
            <span className="text-[10px] font-headline uppercase text-primary tracking-widest">
              {formatSeconds(recordingSeconds)}
            </span>
            {/* Mini live waveform bars */}
            <div className="flex items-center gap-0.5 flex-1">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-primary/40 rounded-full w-1"
                  style={{
                    height: `${8 + Math.sin(Date.now() / 200 + i) * 6}px`,
                    animation: `pulse ${0.6 + i * 0.05}s ease-in-out infinite alternate`,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={cancelAudioRecording}
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button
              size="icon"
              className="h-8 w-8 rounded-full bg-primary"
              onClick={stopAudioRecording}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-1.5 sm:gap-2">
        {!isRecordingAudio && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-primary/60 hover:text-primary h-10 w-10 shrink-0"
              >
                <Smile className="h-6 w-6" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[85vw] max-w-64 p-3 grid grid-cols-4 gap-2 border-primary/10 bg-card/95 backdrop-blur-xl rounded-2xl"
              side="top"
              align="start"
              sideOffset={10}
            >
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setMessage((prev) => prev + emoji)}
                  className="text-2xl hover:bg-primary/10 rounded-xl p-2 transition-all active:scale-90"
                >
                  {emoji}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )}

        <div
          className={cn(
            "flex-1 relative bg-muted/30 rounded-2xl border border-primary/5 focus-within:border-primary/20 transition-all",
            isRecordingAudio && "hidden"
          )}
        >
          <Textarea
            ref={textareaRef}
            placeholder="Type your love..."
            className="min-h-[44px] max-h-[120px] bg-transparent border-none focus-visible:ring-0 resize-none py-3 px-4 text-sm"
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            rows={1}
          />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!isRecordingAudio && (
            <>
              {message.trim() ? (
                <Button
                  size="icon"
                  className="h-10 w-10 rounded-full bg-primary shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                  onClick={handleSend}
                >
                  <Send className="h-5 w-5" />
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-primary/60 hover:text-primary h-10 w-10 rounded-full"
                    onClick={startAudioRecording}
                    disabled={isUploading}
                  >
                    <Mic className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-primary/60 hover:text-primary h-10 w-10 rounded-full"
                    onClick={() => setIsCameraOpen(true)}
                    disabled={isUploading}
                  >
                    <Camera className="h-6 w-6" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Camera Dialog */}
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
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 rounded-full"
              onClick={() => {
                setCapturedMedia(null);
                setIsCameraOpen(false);
              }}
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
                    <Camera className="w-6 h-6" />
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
                  className="flex-1 rounded-2xl bg-primary shadow-lg shadow-primary/40"
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
