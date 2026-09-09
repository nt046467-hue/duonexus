import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { adminAuth } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    // We support both SHA-256 hashes OR plain cleartext PINs for developer convenience!
    let nabinHash = process.env.NABIN_PIN_HASH;
    let karuHash = process.env.KARU_PIN_HASH;

    const isSha256 = (str?: string) => str ? /^[a-f0-9]{64}$/i.test(str) : false;

    // Convert cleartext to hash if needed
    if (nabinHash && !isSha256(nabinHash)) {
      nabinHash = sha256(nabinHash.trim());
    }
    if (karuHash && !isSha256(karuHash)) {
      karuHash = sha256(karuHash.trim());
    }
    if (!nabinHash && !karuHash) {
      // Default to known Nabin (2341) and Karu (1432) hashes
      nabinHash = sha256("2341");
      karuHash = sha256("1432");
    }

    let identity: "nabin" | "karu" | null = null;
    if (pinHash === nabinHash) {
      identity = "nabin";
    } else if (pinHash === karuHash) {
      identity = "karu";
    }

    if (!identity) {
      return NextResponse.json({ valid: false, error: "Incorrect PIN" });
    }

    // Mint Firebase custom token with role claims: role: "nabin" | "karu"
    try {
      const customToken = await adminAuth.createCustomToken(identity, {
        role: identity,
      });

      return NextResponse.json({
        valid: true,
        identity,
        customToken,
      });
    } catch (mintErr: any) {
      console.error("[verify-pin] Token minting error:", mintErr);
      return NextResponse.json({
        valid: false,
        error: `Token error: ${mintErr?.message || "Firebase Admin service account key invalid"}`
      }, { status: 500 });
    }
  } catch (e: any) {
    console.error("[verify-pin] Unexpected error:", e);
    return NextResponse.json({ valid: false, error: e?.message || "Internal server error" }, { status: 500 });
  }
}
