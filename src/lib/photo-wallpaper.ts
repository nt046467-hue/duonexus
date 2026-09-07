/**
 * @fileOverview Client-side photographic wallpaper processing utility.
 * 
 * Transforms uploaded photos into 9:16 portrait wallpapers optimized for chat:
 * - Smart 9:16 portrait aspect ratio framing.
 * - Gentle conversation-calm gradient overlay ensuring chat bubbles remain crisp and readable.
 * - Photographic color grade styles: cinematic, golden_hour, dreamy_soft, film_noir, clean_studio.
 */

import { WallpaperStyle } from "@/ai/flows/wallpaper-generator";

export async function processPhotographicWallpaper(
  sourceDataUrl: string,
  style: WallpaperStyle = "cinematic"
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        // Create 9:16 target canvas (e.g. 1080 x 1920)
        const targetWidth = 1080;
        const targetHeight = 1920;
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(sourceDataUrl);
          return;
        }

        // 1. Calculate cover dimensions to maintain 9:16 ratio without distortion
        const srcRatio = img.width / img.height;
        const targetRatio = targetWidth / targetHeight;
        let renderWidth = targetWidth;
        let renderHeight = targetHeight;
        let offsetX = 0;
        let offsetY = 0;

        if (srcRatio > targetRatio) {
          // Source is wider: fit height, crop width evenly
          renderHeight = targetHeight;
          renderWidth = img.width * (targetHeight / img.height);
          offsetX = (targetWidth - renderWidth) / 2;
        } else {
          // Source is taller: fit width, position towards upper-center (face/subject focus)
          renderWidth = targetWidth;
          renderHeight = img.height * (targetWidth / img.width);
          // Keep subject slightly above center
          offsetY = Math.max(targetHeight - renderHeight, (targetHeight - renderHeight) * 0.35);
        }

        // Draw primary image
        ctx.drawImage(img, offsetX, offsetY, renderWidth, renderHeight);

        // 2. Apply Photographic Grade by Style
        ctx.save();
        switch (style) {
          case "golden_hour": {
            // Warm amber and peach glow
            const goldenGrad = ctx.createLinearGradient(0, 0, targetWidth, targetHeight);
            goldenGrad.addColorStop(0, "rgba(255, 179, 71, 0.18)");
            goldenGrad.addColorStop(0.5, "rgba(255, 140, 105, 0.12)");
            goldenGrad.addColorStop(1, "rgba(180, 80, 50, 0.22)");
            ctx.fillStyle = goldenGrad;
            ctx.globalCompositeOperation = "color";
            ctx.fillRect(0, 0, targetWidth, targetHeight);

            // Warm highlights
            ctx.globalCompositeOperation = "soft-light";
            ctx.fillStyle = "rgba(255, 215, 130, 0.25)";
            ctx.fillRect(0, 0, targetWidth, targetHeight);
            break;
          }
          case "dreamy_soft": {
            // Soft romantic daylight & pastel glow
            const dreamyGrad = ctx.createLinearGradient(0, 0, 0, targetHeight);
            dreamyGrad.addColorStop(0, "rgba(255, 220, 230, 0.15)");
            dreamyGrad.addColorStop(0.5, "rgba(240, 210, 255, 0.12)");
            dreamyGrad.addColorStop(1, "rgba(220, 225, 250, 0.18)");
            ctx.fillStyle = dreamyGrad;
            ctx.globalCompositeOperation = "screen";
            ctx.fillRect(0, 0, targetWidth, targetHeight);
            break;
          }
          case "film_noir": {
            // High-tonal monochrome with rich blacks
            const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
              const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
              // Subtle film S-curve contrast
              const contrastLum = lum < 128
                ? (Math.pow(lum / 128, 1.2) * 128)
                : (255 - Math.pow((255 - lum) / 127, 1.1) * 127);
              data[i] = contrastLum;
              data[i + 1] = contrastLum;
              data[i + 2] = contrastLum;
            }
            ctx.putImageData(imgData, 0, 0);

            // Subtle warm silver tone
            ctx.globalCompositeOperation = "color";
            ctx.fillStyle = "rgba(240, 230, 220, 0.1)";
            ctx.fillRect(0, 0, targetWidth, targetHeight);
            break;
          }
          case "clean_studio": {
            // Modern balanced neutral studio contrast
            ctx.globalCompositeOperation = "soft-light";
            ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
            ctx.fillRect(0, 0, targetWidth, targetHeight);
            break;
          }
          case "cinematic":
          default: {
            // 35mm film mood: subtle teal in shadows, warm highlights
            const cineGrad = ctx.createLinearGradient(0, 0, targetWidth, targetHeight);
            cineGrad.addColorStop(0, "rgba(240, 180, 120, 0.14)");
            cineGrad.addColorStop(0.5, "rgba(100, 120, 140, 0.08)");
            cineGrad.addColorStop(1, "rgba(20, 30, 45, 0.25)");
            ctx.fillStyle = cineGrad;
            ctx.globalCompositeOperation = "soft-light";
            ctx.fillRect(0, 0, targetWidth, targetHeight);
            break;
          }
        }
        ctx.restore();

        // 3. Conversation Readability Layer
        // Keeps the central conversation area visually calm & slightly subdued so message bubbles pop
        ctx.save();
        const chatMask = ctx.createLinearGradient(0, 0, 0, targetHeight);
        chatMask.addColorStop(0, "rgba(10, 10, 16, 0.35)"); // top header fade
        chatMask.addColorStop(0.18, "rgba(10, 10, 16, 0.15)");
        chatMask.addColorStop(0.5, "rgba(10, 10, 16, 0.22)"); // conversation area calm
        chatMask.addColorStop(0.85, "rgba(10, 10, 16, 0.35)");
        chatMask.addColorStop(1, "rgba(10, 10, 16, 0.6)"); // bottom input bar fade
        ctx.fillStyle = chatMask;
        ctx.globalCompositeOperation = "source-over";
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        // Subtle peripheral vignette
        const radialVignette = ctx.createRadialGradient(
          targetWidth / 2,
          targetHeight / 2,
          targetWidth * 0.3,
          targetWidth / 2,
          targetHeight / 2,
          targetWidth * 0.95
        );
        radialVignette.addColorStop(0, "rgba(0, 0, 0, 0)");
        radialVignette.addColorStop(1, "rgba(0, 0, 0, 0.35)");
        ctx.fillStyle = radialVignette;
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.restore();

        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch (e) {
        console.error("Canvas processing error:", e);
        resolve(sourceDataUrl);
      }
    };
    img.onerror = () => {
      resolve(sourceDataUrl);
    };
    img.src = sourceDataUrl;
  });
}
