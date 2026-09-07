"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Camera,
  Video,
  RefreshCw,
  X,
  Check,
  RotateCcw,
  AlertCircle,
  FolderOpen,
  Square,
  Play,
  Pause,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CameraModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (dataUrl: string, type: "image" | "video", options?: { isHD?: boolean }) => void;
}

export function CameraModal({ open, onOpenChange, onCapture }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileFallbackInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [isHD, setIsHD] = useState<boolean>(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isBackCamera, setIsBackCamera] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [cameraBadge, setCameraBadge] = useState<string | null>(null);
  const badgeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedVideo, setCapturedVideo] = useState<string | null>(null);
  const [hasFlash, setHasFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Video recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const showCameraBadge = useCallback((text: string) => {
    if (badgeTimeoutRef.current) clearTimeout(badgeTimeoutRef.current);
    setCameraBadge(text);
    badgeTimeoutRef.current = setTimeout(() => {
      setCameraBadge(null);
    }, 2400);
  }, []);

  // Stop camera stream tracks helper
  const stopStream = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Start camera stream (with audio if video mode)
  const startCamera = useCallback(
    async (
      targetDeviceId: string | null,
      cameraFacing: "user" | "environment",
      cameraMode: "photo" | "video",
      highDef: boolean = isHD
    ) => {
      setIsLoading(true);
      setError(null);
      stopStream();

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera is not supported on this browser.");
        }

        const videoConstraints: MediaTrackConstraints = highDef
          ? {
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720 },
            }
          : {
              width: { ideal: 1280 },
              height: { ideal: 720 },
            };

        if (targetDeviceId) {
          videoConstraints.deviceId = { exact: targetDeviceId };
        } else {
          videoConstraints.facingMode = { ideal: cameraFacing };
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: cameraMode === "video", // audio enabled for video recording
          });
        } catch (mediaErr: any) {
          // If exact deviceId or facing constraint fails, fallback to ideal facing
          if (targetDeviceId) {
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: {
                  facingMode: { ideal: cameraFacing },
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                },
                audio: cameraMode === "video",
              });
            } catch (fbErr: any) {
              if (cameraMode === "video") {
                stream = await navigator.mediaDevices.getUserMedia({
                  video: {
                    facingMode: { ideal: cameraFacing },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                  },
                  audio: false,
                });
              } else {
                throw fbErr;
              }
            }
          } else if (cameraMode === "video") {
            // Audio permission might have failed, fallback to video only
            stream = await navigator.mediaDevices.getUserMedia({
              video: videoConstraints,
              audio: false,
            });
          } else {
            throw mediaErr;
          }
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        // Query available video devices
        if (navigator.mediaDevices?.enumerateDevices) {
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const vInputs = devices.filter((d) => d.kind === "videoinput");
            setVideoDevices(vInputs);
          } catch (e) {}
        }

        // Inspect track to determine if active camera is rear/back
        const track = stream.getVideoTracks()[0];
        if (track) {
          const settings = track.getSettings?.() || {};
          const label = (track.label || "").toLowerCase();
          const facing = settings.facingMode;
          const isBack =
            facing === "environment" ||
            cameraFacing === "environment" ||
            label.includes("back") ||
            label.includes("rear") ||
            label.includes("environment");

          setIsBackCamera(isBack);
        }
      } catch (err: any) {
        console.warn("Camera init failed:", err);
        setError(
          err?.message ||
            "Could not access camera. Please allow camera/mic permissions or upload from files."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [stopStream]
  );

  // Handle open / close lifecycle
  useEffect(() => {
    if (open) {
      setCapturedImage(null);
      setCapturedVideo(null);
      setIsRecording(false);
      setRecordSeconds(0);
      startCamera(selectedDeviceId, facingMode, mode);
    } else {
      stopStream();
      setCapturedImage(null);
      setCapturedVideo(null);
      setIsRecording(false);
      setRecordSeconds(0);
      setError(null);
      setCameraBadge(null);
    }
    return () => {
      stopStream();
      if (badgeTimeoutRef.current) clearTimeout(badgeTimeoutRef.current);
    };
  }, [open, selectedDeviceId, facingMode, mode, startCamera, stopStream]);

  // Flip camera (real device switching or facingMode toggle)
  const toggleFacingMode = async () => {
    if (isRecording || isLoading) return;

    if (videoDevices.length > 1) {
      // Find current device index
      const currentTrack = streamRef.current?.getVideoTracks()[0];
      const activeDeviceId = currentTrack?.getSettings?.()?.deviceId || selectedDeviceId;
      const currentIdx = videoDevices.findIndex((d) => d.deviceId === activeDeviceId);
      const nextIdx = (currentIdx + 1) % videoDevices.length;
      const nextDevice = videoDevices[nextIdx];
      const label = (nextDevice.label || "").toLowerCase();
      const isNextBack =
        label.includes("back") ||
        label.includes("rear") ||
        label.includes("environment") ||
        !isBackCamera;

      setSelectedDeviceId(nextDevice.deviceId);
      const nextFacing = isNextBack ? "environment" : "user";
      setFacingMode(nextFacing);

      showCameraBadge(
        isNextBack
          ? "Switched to Back Camera 📷"
          : `Switched Camera: ${nextDevice.label || "Front Camera"} 🤳`
      );

      await startCamera(nextDevice.deviceId, nextFacing, mode);
    } else {
      // Single camera available (e.g. desktop/laptop webcam)
      const nextFacing = facingMode === "user" ? "environment" : "user";
      setFacingMode(nextFacing);

      if (videoDevices.length === 1) {
        const singleDeviceName = videoDevices[0]?.label || "Webcam";
        showCameraBadge(`Only 1 camera found (${singleDeviceName})`);
      } else {
        showCameraBadge(
          nextFacing === "environment"
            ? "Back Camera Active 📷"
            : "Front Camera Active 🤳"
        );
      }

      await startCamera(null, nextFacing, mode);
    }
  };

  // Switch between Photo and Video mode
  const handleSwitchMode = (newMode: "photo" | "video") => {
    if (isRecording || capturedImage || capturedVideo) return;
    setMode(newMode);
    startCamera(selectedDeviceId, facingMode, newMode);
  };

  // Capture snapshot to canvas
  const handleSnapPhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    setHasFlash(true);
    setTimeout(() => setHasFlash(false), 200);

    const nativeWidth = video.videoWidth || 1280;
    const nativeHeight = video.videoHeight || 720;

    const canvas = document.createElement("canvas");
    if (isHD) {
      canvas.width = nativeWidth;
      canvas.height = nativeHeight;
    } else {
      const maxDim = 1080;
      const currentMax = Math.max(nativeWidth, nativeHeight);
      const scale = currentMax > maxDim ? maxDim / currentMax : 1;
      canvas.width = Math.round(nativeWidth * scale);
      canvas.height = Math.round(nativeHeight * scale);
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = isHD ? "high" : "medium";

    // Only mirror front selfie camera; keep rear/back camera real
    if (!isBackCamera && facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", isHD ? 0.96 : 0.82);
    setCapturedImage(dataUrl);
    stopStream();
  };

  // Start Video Recording
  const startRecording = () => {
    if (!streamRef.current || isRecording) return;

    recordedChunksRef.current = [];
    setRecordSeconds(0);

    let mimeType = "video/webm;codecs=vp8,opus";
    if (typeof MediaRecorder !== "undefined") {
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "video/mp4";
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = "";
          }
        }
      }
    }

    try {
      const recorder = new MediaRecorder(
        streamRef.current,
        mimeType
          ? {
              mimeType,
              videoBitsPerSecond: isHD ? 4_500_000 : 1_200_000,
            }
          : undefined
      );

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const recordedBlob = new Blob(recordedChunksRef.current, {
          type: mimeType || "video/webm",
        });

        const reader = new FileReader();
        reader.onloadend = () => {
          setCapturedVideo(reader.result as string);
          stopStream();
        };
        reader.readAsDataURL(recordedBlob);
      };

      recorder.start(250); // Collect data chunks every 250ms
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      // Start elapsed timer (max 60s)
      timerIntervalRef.current = setInterval(() => {
        setRecordSeconds((prev) => {
          if (prev >= 59) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error("Failed to start MediaRecorder:", err);
      setError("Failed to record video on this browser.");
    }
  };

  // Stop Video Recording
  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    setIsRecording(false);
  };

  // Retake photo or video
  const handleRetake = () => {
    setCapturedImage(null);
    setCapturedVideo(null);
    setRecordSeconds(0);
    setIsRecording(false);
    startCamera(selectedDeviceId, facingMode, mode, isHD);
  };

  // Send photo or video
  const handleSend = () => {
    if (capturedImage) {
      onCapture(capturedImage, "image", { isHD });
      onOpenChange(false);
    } else if (capturedVideo) {
      onCapture(capturedVideo, "video", { isHD });
      onOpenChange(false);
    }
  };

  // Fallback file input change
  const handleFileFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVid = file.type.startsWith("video/");
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onCapture(dataUrl, isVid ? "video" : "image", { isHD });
      onOpenChange(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isRecording) stopRecording();
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isRecording, stopRecording, onOpenChange]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Live Camera"
      className="fixed inset-0 z-[9999] bg-black md:bg-black/85 md:backdrop-blur-md flex items-center justify-center select-none overflow-hidden touch-none animate-in fade-in duration-150"
    >
      <div className="relative w-full h-[100dvh] md:max-w-[430px] md:h-[92vh] md:rounded-[36px] bg-black text-white overflow-hidden flex flex-col justify-between md:shadow-2xl md:border md:border-white/15 animate-in zoom-in-95 duration-200">
        <input
          ref={fileFallbackInputRef}
          type="file"
          accept={mode === "video" ? "video/*" : "image/*,video/*"}
          className="hidden"
          onChange={handleFileFallback}
        />

        {/* Viewfinder Header */}
        <div
          className="absolute top-0 inset-x-0 z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/85 via-black/40 to-transparent"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        >
          {/* Left spacer for perfect center symmetry */}
          <div className="w-10 h-10" />

          {/* Center Title / Recording Indicator / HD Toggle */}
          <div className="flex items-center gap-2">
            {!capturedImage && !capturedVideo && !error && (
              <button
                type="button"
                onClick={() => {
                  const nextHD = !isHD;
                  setIsHD(nextHD);
                  showCameraBadge(nextHD ? "HD Quality ON (1080p) ✨" : "Standard Quality (SD) ⚡");
                  if (!isRecording) {
                    startCamera(selectedDeviceId, facingMode, mode, nextHD);
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all backdrop-blur-md border shadow-md active:scale-95 cursor-pointer",
                  isHD
                    ? "bg-[#00d2ff]/25 text-[#00d2ff] border-[#00d2ff]/70 shadow-[#00d2ff]/20"
                    : "bg-black/40 text-white/80 border-white/25 hover:text-white"
                )}
                title={isHD ? "HD Quality is Active" : "Click to enable HD Quality"}
              >
                <span
                  className={cn(
                    "text-[9px] font-black tracking-wider px-1 py-[0.5px] rounded",
                    isHD ? "bg-[#00d2ff] text-zinc-950 font-black" : "border border-white/40 text-white/90"
                  )}
                >
                  HD
                </span>
                <span className="text-[11px] font-bold">{isHD ? "ON" : "OFF"}</span>
              </button>
            )}

            {isRecording && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/90 backdrop-blur-md text-white font-mono text-xs font-bold shadow-lg shadow-red-600/40 animate-in fade-in">
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                <span>REC {formatTimer(recordSeconds)}</span>
              </div>
            )}
          </div>

          {/* Top Right: Close Cross Button (X) */}
          <button
            type="button"
            onClick={() => {
              if (isRecording) stopRecording();
              onOpenChange(false);
            }}
            className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 active:scale-95 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all shadow-md cursor-pointer"
            title="Close camera"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Main Full-Screen Viewfinder Area */}
        <div className="relative flex-1 w-full h-full bg-zinc-950 flex items-center justify-center overflow-hidden">
          {/* Flash animation */}
          {hasFlash && (
            <div className="absolute inset-0 bg-white z-40 transition-opacity duration-200 pointer-events-none opacity-90" />
          )}

          {/* Status Badge Indicator */}
          {cameraBadge && (
            <div className="absolute top-20 inset-x-0 z-40 flex justify-center pointer-events-none animate-in fade-in duration-200">
              <div className="px-4 py-1.5 rounded-full bg-black/85 backdrop-blur-md text-white text-xs font-semibold border border-white/20 shadow-xl flex items-center gap-1.5">
                <span>{cameraBadge}</span>
              </div>
            </div>
          )}

          {capturedImage ? (
            /* Full-Screen Preview of captured photo */
            <img
              src={capturedImage}
              alt="Captured Photo"
              className="w-full h-full object-cover animate-in fade-in zoom-in-95 duration-200"
            />
          ) : capturedVideo ? (
            /* Full-Screen Preview of captured video */
            <video
              src={capturedVideo}
              controls
              autoPlay
              loop
              playsInline
              className="w-full h-full object-cover animate-in fade-in zoom-in-95 duration-200 bg-black"
            />
          ) : error ? (
            /* Error & Fallback state */
            <div className="p-6 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mb-1">
                <AlertCircle className="w-8 h-8" />
              </div>
              <p className="text-sm font-semibold text-white/90 max-w-[280px]">{error}</p>
              <Button
                type="button"
                onClick={() => fileFallbackInputRef.current?.click()}
                className="bg-primary text-primary-foreground font-semibold rounded-2xl gap-2 mt-2 h-11 px-5"
              >
                <FolderOpen className="w-4 h-4" />
                Upload from Device
              </Button>
            </div>
          ) : (
            /* Live Camera Stream with Edge-to-Edge Fill */
            <>
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className={`w-full h-full object-cover transition-transform ${
                  !isBackCamera && facingMode === "user" ? "-scale-x-100" : ""
                }`}
              />

              {/* Viewfinder Target Framing Guides */}
              <div className="absolute inset-10 pointer-events-none border border-white/15 rounded-3xl flex flex-col justify-between p-4">
                <div className="flex justify-between">
                  <div
                    className={cn(
                      "w-6 h-6 border-t-2 border-l-2 rounded-tl-xl transition-colors",
                      mode === "video" ? "border-red-400/80" : "border-white/80"
                    )}
                  />
                  <div
                    className={cn(
                      "w-6 h-6 border-t-2 border-r-2 rounded-tr-xl transition-colors",
                      mode === "video" ? "border-red-400/80" : "border-white/80"
                    )}
                  />
                </div>
                <div className="flex justify-between">
                  <div
                    className={cn(
                      "w-6 h-6 border-b-2 border-l-2 rounded-bl-xl transition-colors",
                      mode === "video" ? "border-red-400/80" : "border-white/80"
                    )}
                  />
                  <div
                    className={cn(
                      "w-6 h-6 border-b-2 border-r-2 rounded-br-xl transition-colors",
                      mode === "video" ? "border-red-400/80" : "border-white/80"
                    )}
                  />
                </div>
              </div>

              {isLoading && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-8 h-8 animate-spin text-[#00d2ff]" />
                  <p className="text-xs text-white/90 font-semibold tracking-wide">Starting camera...</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Shutter / Action Controls Floating Footer */}
        <div
          className="absolute bottom-0 inset-x-0 p-4 pb-8 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col items-center gap-4 z-30"
          style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
        >
          {/* Mode Selector Tabs (Photo vs Video) */}
          {!capturedImage && !capturedVideo && !error && !isRecording && (
            <div className="flex items-center gap-1 bg-black/50 backdrop-blur-md p-1 rounded-full border border-white/20 select-none shadow-lg">
              <button
                type="button"
                onClick={() => handleSwitchMode("photo")}
                className={cn(
                  "flex items-center gap-1.5 px-5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer",
                  mode === "photo"
                    ? "bg-white text-black shadow-md"
                    : "text-white/70 hover:text-white"
                )}
              >
                <Camera className="w-3.5 h-3.5" />
                PHOTO
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode("video")}
                className={cn(
                  "flex items-center gap-1.5 px-5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer",
                  mode === "video"
                    ? "bg-red-500 text-white shadow-md shadow-red-500/40"
                    : "text-white/70 hover:text-white"
                )}
              >
                <Video className="w-3.5 h-3.5" />
                VIDEO
              </button>
            </div>
          )}

          {capturedImage || capturedVideo ? (
            <div className="flex items-center justify-between w-full max-w-sm px-2 gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleRetake}
                className="flex-1 rounded-2xl bg-black/40 hover:bg-black/60 text-white border-white/25 h-12 text-sm gap-2 font-semibold backdrop-blur-md cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                Retake
              </Button>
              <Button
                type="button"
                onClick={handleSend}
                className={cn(
                  "flex-1 rounded-2xl text-white font-bold h-12 text-sm gap-2 shadow-xl active:scale-95 transition-all cursor-pointer",
                  capturedVideo
                    ? "bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-red-500/30"
                    : "bg-gradient-to-r from-[#00d2ff] to-blue-600 hover:from-[#00d2ff] hover:to-blue-700 text-slate-950 font-black shadow-[#00d2ff]/30"
                )}
              >
                <Check className="w-4 h-4 stroke-[3]" />
                {capturedVideo ? "Send Video 🎥" : "Send Photo 💕"}
              </Button>
            </div>
          ) : !error ? (
            <div className="flex items-center justify-between w-full max-w-sm px-6">
              {/* Left: Device Gallery Fallback */}
              <button
                type="button"
                disabled={isRecording}
                onClick={() => fileFallbackInputRef.current?.click()}
                className={cn(
                  "w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 active:scale-90 border border-white/20 flex items-center justify-center text-white/90 transition-all backdrop-blur-md shadow-md cursor-pointer",
                  isRecording && "opacity-30 cursor-not-allowed"
                )}
                title={mode === "video" ? "Upload video file" : "Upload photo file"}
              >
                <FolderOpen className="w-5 h-5" />
              </button>

              {/* Center: Real Flagship Camera Shutter Button */}
              {mode === "photo" ? (
                <button
                  type="button"
                  onClick={handleSnapPhoto}
                  className="w-20 h-20 rounded-full border-[4px] border-white p-1 flex items-center justify-center shadow-2xl active:scale-90 transition-all cursor-pointer group shrink-0"
                  title="Take photo"
                >
                  <div className="w-full h-full rounded-full bg-white group-hover:scale-95 active:scale-85 transition-transform shadow-md" />
                </button>
              ) : (
                /* Video Record Button */
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={cn(
                    "w-20 h-20 rounded-full border-[4px] border-white p-1 flex items-center justify-center shadow-2xl transition-all cursor-pointer shrink-0",
                    isRecording ? "scale-105 border-red-500 ring-4 ring-red-500/30" : "active:scale-90"
                  )}
                  title={isRecording ? "Stop recording" : "Record video"}
                >
                  {isRecording ? (
                    <div className="w-8 h-8 rounded-xl bg-red-600 shadow-md animate-pulse" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-red-600 hover:bg-red-500 active:scale-85 transition-all shadow-md" />
                  )}
                </button>
              )}

              {/* Right: Quick Flip Camera Button for Thumb (Replaces Sparkle) */}
              <button
                type="button"
                onClick={toggleFacingMode}
                disabled={isRecording}
                className={cn(
                  "w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 active:scale-90 border border-white/20 flex items-center justify-center text-white/90 transition-all backdrop-blur-md shadow-md cursor-pointer",
                  isRecording && "opacity-30 cursor-not-allowed"
                )}
                title={isBackCamera ? "Switch to Front Camera" : "Switch to Back Camera"}
              >
                <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
