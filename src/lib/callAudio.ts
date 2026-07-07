/**
 * callAudio.ts — Synthesized call audio using Web Audio API only.
 * Zero asset files, works cross-platform, no internet required.
 *
 * Sounds modelled after Messenger / FaceTime patterns:
 *   - ringTone: melodic arpeggio loop (incoming)
 *   - dialTone: steady outgoing call beep pattern
 *   - connectedChime: rising 3-note chime (call answered)
 *   - endedBeep: descending 2-note beep (call ended / declined)
 */

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    return new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch {
    return null;
  }
}

/** Play a single tone burst */
function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  gainPeak: number = 0.18,
  type: OscillatorType = "sine"
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.03);
  gain.gain.setValueAtTime(gainPeak, startTime + duration - 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

// ─────────────────────────────────────────────────────────────────────────────
// INCOMING RING — Messenger-style melodic arpeggio (4 notes, loops every 3s)
// ─────────────────────────────────────────────────────────────────────────────
let ringCtx: AudioContext | null = null;
let ringInterval: ReturnType<typeof setInterval> | null = null;

function playRingOnce() {
  if (!ringCtx) return;
  const ctx = ringCtx;
  const t = ctx.currentTime;
  // Messenger-like ascending arpeggio: C5-E5-G5-C6
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    playTone(ctx, freq, t + i * 0.13, 0.18, 0.2);
  });
  // Second hit 0.7s later (double ring feel like Messenger)
  notes.forEach((freq, i) => {
    playTone(ctx, freq, t + 0.7 + i * 0.13, 0.18, 0.2);
  });
}

export function startRingtone() {
  stopRingtone();
  ringCtx = getCtx();
  if (!ringCtx) return;

  // Autoplay policy: resume on first gesture already happened for this call
  if (ringCtx.state === "suspended") ringCtx.resume();

  playRingOnce();
  ringInterval = setInterval(playRingOnce, 3000);
}

export function stopRingtone() {
  if (ringInterval) clearInterval(ringInterval);
  ringInterval = null;
  if (ringCtx) {
    ringCtx.close().catch(() => {});
    ringCtx = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTGOING DIAL — repeating low double-beep (like Messenger/FB outgoing)
// ─────────────────────────────────────────────────────────────────────────────
let dialCtx: AudioContext | null = null;
let dialInterval: ReturnType<typeof setInterval> | null = null;

function playDialOnce() {
  if (!dialCtx) return;
  const ctx = dialCtx;
  const t = ctx.currentTime;
  playTone(ctx, 440, t, 0.3, 0.12);
  playTone(ctx, 440, t + 0.4, 0.3, 0.12);
}

export function startDialTone() {
  stopDialTone();
  dialCtx = getCtx();
  if (!dialCtx) return;
  if (dialCtx.state === "suspended") dialCtx.resume();
  playDialOnce();
  dialInterval = setInterval(playDialOnce, 2200);
}

export function stopDialTone() {
  if (dialInterval) clearInterval(dialInterval);
  dialInterval = null;
  if (dialCtx) {
    dialCtx.close().catch(() => {});
    dialCtx = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTED CHIME — 3-note rising chime (played once when call is answered)
// ─────────────────────────────────────────────────────────────────────────────
export function playConnectedChime() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  const t = ctx.currentTime;
  // G4 → B4 → D5 (warm major triad)
  playTone(ctx, 392, t, 0.22, 0.18);
  playTone(ctx, 493.88, t + 0.17, 0.22, 0.18);
  playTone(ctx, 587.33, t + 0.34, 0.35, 0.22);
  // Auto-close after chime
  setTimeout(() => ctx.close().catch(() => {}), 1200);
}

// ─────────────────────────────────────────────────────────────────────────────
// ENDED BEEP — single soft low-frequency tone (Telegram-style gentle end)
// ─────────────────────────────────────────────────────────────────────────────
export function playEndedBeep() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  const t = ctx.currentTime;
  // Very soft A3 (220Hz) — gentle fade, gain 0.06 (barely audible, not jarring)
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 220;
  gain.gain.setValueAtTime(0.06, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.72);
  setTimeout(() => ctx.close().catch(() => {}), 1000);
}
