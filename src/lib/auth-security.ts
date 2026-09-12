import { createHash, scryptSync, timingSafeEqual } from "crypto";

/**
 * In-memory sliding window rate limiter for authentication attempts.
 * Max 5 failed attempts per 5 minutes per IP address.
 */
interface RateLimitRecord {
  failedAttempts: number;
  lockedUntil: number;
  firstAttemptAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes lockout
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000; // 5 minute window

// Clean up stale rate limit entries every 10 minutes to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimitStore.entries()) {
      if (now > record.lockedUntil && now - record.firstAttemptAt > ATTEMPT_WINDOW_MS) {
        rateLimitStore.delete(ip);
      }
    }
  }, 10 * 60 * 1000).unref?.();
}

/**
 * Checks if an IP is currently rate-limited.
 * Returns { allowed: boolean, remainingMs: number }
 */
export function checkRateLimit(clientIp: string): { allowed: boolean; remainingMs: number } {
  const now = Date.now();
  const record = rateLimitStore.get(clientIp);

  if (!record) {
    return { allowed: true, remainingMs: 0 };
  }

  if (record.lockedUntil > now) {
    return { allowed: false, remainingMs: record.lockedUntil - now };
  }

  // If window expired, reset record
  if (now - record.firstAttemptAt > ATTEMPT_WINDOW_MS) {
    rateLimitStore.delete(clientIp);
    return { allowed: true, remainingMs: 0 };
  }

  return { allowed: true, remainingMs: 0 };
}

/**
 * Record a failed authentication attempt.
 */
export function recordFailedAttempt(clientIp: string): { locked: boolean; remainingMs: number } {
  const now = Date.now();
  let record = rateLimitStore.get(clientIp);

  if (!record || now - record.firstAttemptAt > ATTEMPT_WINDOW_MS) {
    record = {
      failedAttempts: 1,
      lockedUntil: 0,
      firstAttemptAt: now,
    };
  } else {
    record.failedAttempts += 1;
  }

  if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    rateLimitStore.set(clientIp, record);
    return { locked: true, remainingMs: LOCKOUT_DURATION_MS };
  }

  rateLimitStore.set(clientIp, record);
  return { locked: false, remainingMs: 0 };
}

/**
 * Clear failed attempts on successful authentication.
 */
export function clearRateLimit(clientIp: string): void {
  rateLimitStore.delete(clientIp);
}

/**
 * Extract client IP from NextRequest headers safely.
 */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();
  return "127.0.0.1";
}

/**
 * Constant-time safe string comparison to prevent timing attacks.
 */
export function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Verifies a candidate PIN against a stored hash securely.
 * Supports:
 * 1. scrypt: "scrypt$<salt>$<derivedKeyHex>"
 * 2. SHA-256: 64-char hex string
 */
export function verifyPinHash(candidatePin: string, storedHash?: string): boolean {
  if (!storedHash || typeof storedHash !== "string") return false;
  const pin = candidatePin.trim();

  // scrypt format: scrypt$<salt>$<hash>
  if (storedHash.startsWith("scrypt$")) {
    const parts = storedHash.split("$");
    if (parts.length === 3) {
      const salt = parts[1];
      const target = parts[2];
      try {
        const derived = scryptSync(pin, salt, 32).toString("hex");
        return safeCompare(derived, target);
      } catch {
        return false;
      }
    }
  }

  // SHA-256 format: 64-char hex string
  const sha256Candidate = createHash("sha256").update(pin).digest("hex");
  return safeCompare(sha256Candidate, storedHash.trim().toLowerCase());
}
