import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import {
  checkRateLimit,
  recordFailedAttempt,
  clearRateLimit,
  getClientIp,
  verifyPinHash,
} from "@/lib/auth-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);

  // 1. Rate-limiting check
  const rateLimit = checkRateLimit(clientIp);
  if (!rateLimit.allowed) {
    const minutesRemaining = Math.max(1, Math.ceil(rateLimit.remainingMs / 60000));
    return NextResponse.json(
      {
        valid: false,
        error: `Too many failed attempts. Locked out for ${minutesRemaining} minute${minutesRemaining > 1 ? "s" : ""}.`,
      },
      { status: 429 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const pin = typeof body?.pin === "string" ? body.pin.trim() : "";

    if (!pin || pin.length < 4 || pin.length > 8) {
      return NextResponse.json({ valid: false, error: "Invalid PIN format" }, { status: 400 });
    }

    const nabinHash = process.env.NABIN_PIN_HASH || process.env.NABIN_PIN;
    const karuHash = process.env.KARU_PIN_HASH || process.env.KARU_PIN;

    if (!nabinHash && !karuHash) {
      console.error("[verify-pin] No PIN environment variables configured (NABIN_PIN_HASH/NABIN_PIN or KARU_PIN_HASH/KARU_PIN).");
      return NextResponse.json(
        { valid: false, error: "Authentication service unavailable. Please configure PIN variables." },
        { status: 503 }
      );
    }

    let identity: "nabin" | "karu" | null = null;
    if (nabinHash && verifyPinHash(pin, nabinHash)) {
      identity = "nabin";
    } else if (karuHash && verifyPinHash(pin, karuHash)) {
      identity = "karu";
    }

    if (!identity) {
      const lockStatus = recordFailedAttempt(clientIp);
      if (lockStatus.locked) {
        return NextResponse.json(
          {
            valid: false,
            error: "Too many failed attempts. Temporary lockout activated for 5 minutes.",
          },
          { status: 429 }
        );
      }
      return NextResponse.json({ valid: false, error: "Incorrect PIN" }, { status: 401 });
    }

    // PIN matched — reset failed attempt counter
    clearRateLimit(clientIp);

    // Mint Firebase custom token with role claim
    const customToken = await adminAuth.createCustomToken(identity, {
      role: identity,
    });

    return NextResponse.json({
      valid: true,
      identity,
      customToken,
    });
  } catch (err) {
    console.error("[verify-pin] Internal authentication error:", err);
    return NextResponse.json(
      { valid: false, error: "Authentication service encountered an unexpected error" },
      { status: 500 }
    );
  }
}
