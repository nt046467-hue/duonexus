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

export async function GET(req: NextRequest) {
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(clientIp);

  if (!rateLimit.allowed) {
    const retryAfterSec = Math.max(1, Math.ceil(rateLimit.remainingMs / 1000));
    return NextResponse.json(
      {
        isLocked: true,
        retryAfterMs: rateLimit.remainingMs,
        lockedUntil: rateLimit.lockedUntil,
      },
      {
        status: 200,
        headers: {
          "Retry-After": retryAfterSec.toString(),
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }

  return NextResponse.json(
    { isLocked: false },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);

  // 1. Rate-limiting check
  const rateLimit = checkRateLimit(clientIp);
  if (!rateLimit.allowed) {
    const retryAfterSec = Math.max(1, Math.ceil(rateLimit.remainingMs / 1000));
    return NextResponse.json(
      {
        valid: false,
        error: "Too many attempts",
        message: "Please wait a moment before trying again.",
        isLocked: true,
        retryAfterMs: rateLimit.remainingMs,
        lockedUntil: rateLimit.lockedUntil,
      },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfterSec.toString(),
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const pin = typeof body?.pin === "string" ? body.pin.trim() : "";

    if (!pin || pin.length < 4 || pin.length > 8) {
      return NextResponse.json(
        {
          valid: false,
          error: "Invalid PIN format",
          message: "Please enter a valid 4-digit PIN.",
          isLocked: false,
        },
        { status: 400 }
      );
    }

    const nabinHash = process.env.NABIN_PIN_HASH || process.env.NABIN_PIN;
    const karuHash = process.env.KARU_PIN_HASH || process.env.KARU_PIN;

    if (!nabinHash && !karuHash) {
      console.error("[verify-pin] Auth configuration error: No PIN hashes found in environment.");
      return NextResponse.json(
        {
          valid: false,
          error: "Service unavailable",
          message: "Authentication service temporarily unavailable. Please try again later.",
          isLocked: false,
        },
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
        const retryAfterSec = Math.max(1, Math.ceil(lockStatus.remainingMs / 1000));
        return NextResponse.json(
          {
            valid: false,
            error: "Too many attempts",
            message: "Please wait a moment before trying again.",
            isLocked: true,
            retryAfterMs: lockStatus.remainingMs,
            lockedUntil: lockStatus.lockedUntil,
          },
          {
            status: 429,
            headers: {
              "Retry-After": retryAfterSec.toString(),
              "Cache-Control": "no-store, max-age=0",
            },
          }
        );
      }
      return NextResponse.json(
        {
          valid: false,
          error: "Incorrect PIN",
          message: "That PIN doesn't match. Please try again.",
          isLocked: false,
        },
        { status: 401 }
      );
    }

    // PIN matched — reset failed attempt counter
    clearRateLimit(clientIp);

    // Mint Firebase custom token with role claim
    const customToken = await adminAuth.createCustomToken(identity, {
      role: identity,
    });

    return NextResponse.json(
      {
        valid: true,
        identity,
        customToken,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (err) {
    console.error("[verify-pin] Internal authentication error:", err);
    return NextResponse.json(
      {
        valid: false,
        error: "Authentication error",
        message: "Something went wrong. Please try again.",
        isLocked: false,
      },
      { status: 500 }
    );
  }
}
