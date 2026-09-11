/**
 * callAudio.ts — DuoNexus Calling Audio Engine
 *
 * Production Lifecycle-Driven Audio Architecture:
 * - Incoming Ringtone: Authentically plays /sounds/ringtone.mp3 tied directly to callId.
 * - Outgoing Tone: Synthesizes standard VoIP ringback tone (440Hz + 480Hz pulses) using Web Audio API for caller.
 * - Zero Artificial Sounds: No dial beeps, connected chimes, or ended sounds during active calls.
 * - Autoplay Guard: Automatically unlocks on first touch/click if browser blocks autoplay.
 * - Strictly Idempotent: Safe to invoke repeatedly or out of order.
 */

// Track active audio sessions tied to call IDs
let activeRingtoneCallId: string | null = null;
let ringAudio: HTMLAudioElement | null = null;
let autoplayUnlockListener: (() => void) | null = null;

// Outgoing ringback oscillator context
let activeOutgoingCallId: string | null = null;
let outgoingAudioContext: AudioContext | null = null;
let outgoingTimer: ReturnType<typeof setInterval> | null = null;
let outgoingNodes: { osc1: OscillatorNode; osc2: OscillatorNode; gain: GainNode } | null = null;

/**
 * Start incoming call ringtone tied to a specific callId.
 */
export function startRingtone(callId: string = "default"): void {
  if (typeof window === "undefined") return;

  // If already playing for this exact call, avoid recreating
  if (activeRingtoneCallId === callId && ringAudio && !ringAudio.paused) {
    return;
  }

  // Stop any previous ringtone or outgoing sound
  stopRingtone();
  stopOutgoingTone();

  activeRingtoneCallId = callId;

  try {
    const audio = new Audio("/sounds/ringtone.mp3");
    audio.loop = true;
    audio.preload = "auto";
    ringAudio = audio;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        if (process.env.NODE_ENV === "development") {
          console.warn("[callAudio] Autoplay blocked ringtone until user interaction:", err.name);
        }

        // Register one-time document unlock handler
        if (!autoplayUnlockListener) {
          autoplayUnlockListener = () => {
            if (activeRingtoneCallId === callId && ringAudio) {
              ringAudio.play().catch(() => {});
            }
            removeAutoplayUnlockListener();
          };
          window.addEventListener("pointerdown", autoplayUnlockListener, { once: true });
          window.addEventListener("keydown", autoplayUnlockListener, { once: true });
          window.addEventListener("touchstart", autoplayUnlockListener, { once: true });
        }
      });
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[callAudio] Failed to initialize ringtone audio:", err);
    }
    ringAudio = null;
    activeRingtoneCallId = null;
  }
}

function removeAutoplayUnlockListener(): void {
  if (autoplayUnlockListener && typeof window !== "undefined") {
    window.removeEventListener("pointerdown", autoplayUnlockListener);
    window.removeEventListener("keydown", autoplayUnlockListener);
    window.removeEventListener("touchstart", autoplayUnlockListener);
    autoplayUnlockListener = null;
  }
}

/**
 * Stop incoming ringtone. If callId is provided, only stops if matching.
 */
export function stopRingtone(callId?: string): void {
  if (callId && activeRingtoneCallId && activeRingtoneCallId !== callId) {
    return;
  }

  removeAutoplayUnlockListener();

  if (ringAudio) {
    try {
      ringAudio.pause();
      ringAudio.currentTime = 0;
      ringAudio.src = "";
    } catch {
      // Non-fatal cleanup
    }
    ringAudio = null;
  }

  activeRingtoneCallId = null;
}

/**
 * Start synthesized outgoing ringback tone for caller (440Hz + 480Hz, 1.5s on, 3.5s off).
 */
export function startOutgoingTone(callId: string = "default"): void {
  if (typeof window === "undefined") return;

  if (activeOutgoingCallId === callId && outgoingAudioContext) {
    return;
  }

  stopOutgoingTone();
  stopRingtone();

  activeOutgoingCallId = callId;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    outgoingAudioContext = ctx;

    const playTonePulse = () => {
      if (!outgoingAudioContext || outgoingAudioContext.state === "closed" || activeOutgoingCallId !== callId) {
        return;
      }

      if (outgoingAudioContext.state === "suspended") {
        outgoingAudioContext.resume().catch(() => {});
      }

      try {
        const now = outgoingAudioContext.currentTime;
        const gain = outgoingAudioContext.createGain();
        gain.gain.setValueAtTime(0, now);
        // Smooth attack and decay to prevent clicks
        gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
        gain.gain.setValueAtTime(0.12, now + 1.45);
        gain.gain.linearRampToValueAtTime(0, now + 1.5);
        gain.connect(outgoingAudioContext.destination);

        const osc1 = outgoingAudioContext.createOscillator();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(440, now);
        osc1.connect(gain);

        const osc2 = outgoingAudioContext.createOscillator();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(480, now);
        osc2.connect(gain);

        osc1.start(now);
        osc2.start(now);

        osc1.stop(now + 1.55);
        osc2.stop(now + 1.55);

        outgoingNodes = { osc1, osc2, gain };
      } catch {
        // AudioContext might have been closed concurrently
      }
    };

    // Play first pulse immediately
    playTonePulse();

    // Standard telephony cadence: 1.5s tone, 3.5s pause (5s period)
    outgoingTimer = setInterval(() => {
      playTonePulse();
    }, 5000);
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[callAudio] Failed to initialize outgoing tone:", err);
    }
    stopOutgoingTone();
  }
}

/**
 * Stop outgoing ringback tone. If callId is provided, only stops if matching.
 */
export function stopOutgoingTone(callId?: string): void {
  if (callId && activeOutgoingCallId && activeOutgoingCallId !== callId) {
    return;
  }

  if (outgoingTimer) {
    clearInterval(outgoingTimer);
    outgoingTimer = null;
  }

  if (outgoingNodes) {
    try {
      outgoingNodes.osc1.stop();
      outgoingNodes.osc2.stop();
      outgoingNodes.gain.disconnect();
    } catch {
      // Ignored: already stopped
    }
    outgoingNodes = null;
  }

  if (outgoingAudioContext) {
    try {
      if (outgoingAudioContext.state !== "closed") {
        outgoingAudioContext.close().catch(() => {});
      }
    } catch {
      // Non-fatal
    }
    outgoingAudioContext = null;
  }

  activeOutgoingCallId = null;
}

/**
 * Silences all calling audio unconditionally.
 * Safe to call at any time.
 */
export function stopAllCallSounds(): void {
  stopRingtone();
  stopOutgoingTone();
}

/**
 * Backward compatibility stubs
 */
export function startDialTone(callId?: string): void {
  startOutgoingTone(callId);
}

export function stopDialTone(callId?: string): void {
  stopOutgoingTone(callId);
}

export function playConnectedChime(): void {}
export function playEndedBeep(): void {}
