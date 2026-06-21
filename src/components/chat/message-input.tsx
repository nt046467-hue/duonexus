
"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Smile, Mic, X, Camera, Video, RefreshCw, StopCircle, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  onSendMessage: (content: string, type: "text" | "image" | "audio" | "video") => void;
  onTyping: (isTyping: boolean) => void;
}

const EMOJIS = ["❤️", "😘", "😍", "🥰", "🌹", "✨", "🔥", "😭", "😂", "🥺", "🌸", "🍕", "💖", "🍓", "🦋", "🥂"];

export function MessageInput({ onSendMessage, onTyping }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<"photo" | "video">("photo");
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [capturedMedia, setCapturedMedia] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [videoDuration, setVideoDuration] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const videoChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

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
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- CAMERA LOGIC ---

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: true
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setVideoDuration(0);
    setIsRecordingVideo(false);
  };

  const toggleCamera = () => {
    stopCamera();
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  };

  useEffect(() => {
    if (isCameraOpen) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [isCameraOpen, facingMode]);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(videoRef.current, 0, 0);
    setCapturedMedia(canvas.toDataURL("image/jpeg", 0.85));
  };

  const startVideoRecording = () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    const stream = videoRef.current.srcObject as MediaStream;
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mediaRecorderRef.current = recorder;
    videoChunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) videoChunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(videoChunksRef.current, { type: 'video/webm' });
      const reader = new FileReader();
      reader.onloadend = () => setCapturedMedia(reader.result as string);
      reader.readAsDataURL(blob);
    };

    recorder.start();
    setIsRecordingVideo(true);
    setVideoDuration(0);
    timerRef.current = setInterval(() => {
      setVideoDuration(prev => prev + 1);
    }, 1000);
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecordingVideo(false);
  };

  const handleSendCaptured = () => {
    if (capturedMedia) {
      onSendMessage(capturedMedia, cameraMode === "photo" ? "image" : "video");
      setIsCameraOpen(false);
      setCapturedMedia(null);
    }
  };

  // --- AUDIO RECORDING ---

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => onSendMessage(reader.result as string, "audio");
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecordingAudio(true);
      onTyping(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingAudio(false);
    onTyping(false);
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <input 
        type="file" 
        accept="image/*,video/*" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onloadend = () => onSendMessage(reader.result as string, file.type.startsWith('video/') ? "video" : "image");
            reader.readAsDataURL(file);
          }
        }} 
      />
      
      {isRecordingAudio && (
        <div className="flex items-center gap-3 px-4 py-3 bg-primary/10 rounded-2xl mb-1 animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 flex-1">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-headline uppercase text-primary tracking-widest">Recording Voice...</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setIsRecordingAudio(false)}>
              <X className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button size="icon" className="h-8 w-8 rounded-full bg-primary" onClick={stopAudioRecording}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-1.5 sm:gap-2">
        {!isRecordingAudio && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="text-primary/60 hover:text-primary h-10 w-10 shrink-0">
                <Smile className="h-6 w-6" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[85vw] max-w-64 p-3 grid grid-cols-4 gap-2 border-primary/10 bg-card/95 backdrop-blur-xl rounded-2xl" side="top" align="start" sideOffset={10}>
              {EMOJIS.map((emoji) => (
                <button key={emoji} onClick={() => setMessage(prev => prev + emoji)} className="text-2xl hover:bg-primary/10 rounded-xl p-2 transition-all active:scale-90">
                  {emoji}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )}
        
        <div className={cn("flex-1 relative bg-muted/30 rounded-2xl border border-primary/5 focus-within:border-primary/20 transition-all", isRecordingAudio && "hidden")}>
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
                <Button size="icon" className="h-10 w-10 rounded-full bg-primary shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all" onClick={handleSend}>
                  <Send className="h-5 w-5" />
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="text-primary/60 hover:text-primary h-10 w-10 rounded-full" onClick={startAudioRecording}>
                    <Mic className="h-6 w-6" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-primary/60 hover:text-primary h-10 w-10 rounded-full" onClick={() => setIsCameraOpen(true)}>
                    <Camera className="h-6 w-6" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
        <DialogContent className="max-w-md w-[95vw] p-0 overflow-hidden bg-black rounded-[2.5rem] border-none">
          <DialogHeader className="p-4 absolute top-0 left-0 right-0 z-10 flex flex-row items-center justify-between bg-gradient-to-b from-black/50 to-transparent">
            <DialogTitle className="text-white font-headline text-sm uppercase tracking-widest">
              {capturedMedia ? "Preview" : (cameraMode === "photo" ? "Capture Photo" : "Record Video")}
            </DialogTitle>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full" onClick={() => setIsCameraOpen(false)}>
              <X className="w-5 h-5" />
            </Button>
          </DialogHeader>

          <div className="relative aspect-[3/4] bg-black flex items-center justify-center overflow-hidden">
            {!capturedMedia ? (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                {isRecordingVideo && (
                  <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-headline animate-pulse">
                    {Math.floor(videoDuration / 60)}:{(videoDuration % 60).toString().padStart(2, '0')}
                  </div>
                )}
              </>
            ) : (
              cameraMode === "photo" ? (
                <img src={capturedMedia} className="w-full h-full object-cover" />
              ) : (
                <video src={capturedMedia} autoPlay loop playsInline className="w-full h-full object-cover" />
              )
            )}
          </div>

          <DialogFooter className="p-6 bg-black flex flex-col gap-4">
            {!capturedMedia ? (
              <div className="flex flex-col items-center gap-6 w-full">
                <div className="flex items-center justify-center gap-8">
                  <button 
                    onClick={() => setCameraMode("photo")}
                    className={cn("text-xs font-headline uppercase tracking-widest transition-all", cameraMode === "photo" ? "text-white font-bold" : "text-white/40")}
                  >
                    Photo
                  </button>
                  <button 
                    onClick={() => setCameraMode("video")}
                    className={cn("text-xs font-headline uppercase tracking-widest transition-all", cameraMode === "video" ? "text-white font-bold" : "text-white/40")}
                  >
                    Video
                  </button>
                </div>

                <div className="flex items-center justify-between w-full px-8">
                  <Button variant="ghost" size="icon" className="text-white/60 hover:text-white" onClick={() => fileInputRef.current?.click()}>
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
                        onClick={isRecordingVideo ? stopVideoRecording : startVideoRecording}
                        className={cn(
                          "w-16 h-16 rounded-full border-4 border-white flex items-center justify-center transition-all active:scale-90",
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

                  <Button variant="ghost" size="icon" className="text-white/60 hover:text-white" onClick={toggleCamera}>
                    <RefreshCw className="w-6 h-6" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-4 w-full">
                <Button variant="outline" className="flex-1 rounded-2xl bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={() => setCapturedMedia(null)}>
                  Retake
                </Button>
                <Button className="flex-1 rounded-2xl bg-primary shadow-lg shadow-primary/40" onClick={handleSendCaptured}>
                  Send Moment
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
