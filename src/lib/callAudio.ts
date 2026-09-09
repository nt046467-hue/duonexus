/**
 * callAudio.ts — DuoNexus Calling Audio Engine
 *
 * Production Zero-Sound-Effects Policy:
 * - Only the incoming ringtone is allowed during the ringing phase.
 * - Zero artificial sounds, dial tones, connected chimes, or ended beeps.
 * - Stops immediately when accepted, declined, timed out, or cancelled.
 */

let ringAudio: HTMLAudioElement | null = null;

/**
 * Start the incoming call ringtone.
 * Uses the authentic /sounds/ringtone.mp3 asset with seamless looping.
 */
export function startRingtone(): void {
  stopRingtone();

  if (typeof window === "undefined") return;

  try {
    const audio = new Audio("/sounds/ringtone.mp3");
    audio.loop = true;
    audio.preload = "auto";
    ringAudio = audio;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        // Autoplay may be restricted until user interacts with the document
        console.warn("[callAudio] Autoplay blocked ringtone until user interaction:", err);
      });
    }
  } catch (err) {
    console.warn("[callAudio] Failed to initialize ringtone audio:", err);
    ringAudio = null;
  }
}

/**
 * Stop and release the incoming call ringtone.
 * Strictly idempotent — safe to call multiple times.
 */
export function stopRingtone(): void {
  if (ringAudio) {
    try {
      ringAudio.pause();
      ringAudio.currentTime = 0;
      ringAudio.src = "";
    } catch {
      // Ignored: cleanup failure is non-fatal
    }
    ringAudio = null;
  }
}

/**
 * Legacy stubs for safe backward compatibility if invoked during transitions.
 * Guaranteed to produce zero sound.
 */
export function startDialTone(): void {}
export function stopDialTone(): void {}
export function playConnectedChime(): void {}
export function playEndedBeep(): void {}

