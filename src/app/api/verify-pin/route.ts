
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json();
    if (!pin || typeof pin !== "string") {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    const pinHash = sha256(pin.trim());

    // Each person has their own PIN hash stored in env vars.
    // NABIN_PIN_HASH and KARU_PIN_HASH are SHA-256 hashes of each person's PIN.
    // Set these in .env.local and in your Vercel project environment variables.
    const nabinHash = process.env.NABIN_PIN_HASH;
    const karuHash = process.env.KARU_PIN_HASH;

    console.log("[verify-pin] debug logs:", {
      hasNabinHash: !!nabinHash,
      hasKaruHash: !!karuHash,
      receivedPinHash: pinHash
    });

    if (!nabinHash || !karuHash) {
      // Fallback: if env vars aren't set yet, check legacy shared PIN hash
      const legacyHash = process.env.SHARED_PIN_HASH;
      if (legacyHash && pinHash === legacyHash) {
        return NextResponse.json({ valid: true, identity: null });
      }
      console.error("[verify-pin] PIN hashes not configured in environment variables.");
      return NextResponse.json({ valid: false, error: "not_configured" }, { status: 500 });
    }

    if (pinHash === nabinHash) {
      return NextResponse.json({ valid: true, identity: "nabin" });
    }
    if (pinHash === karuHash) {
      return NextResponse.json({ valid: true, identity: "karu" });
    }

    return NextResponse.json({ valid: false });
  } catch (e) {
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
