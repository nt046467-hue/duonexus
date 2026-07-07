
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
      // Fallback: if env vars aren't set yet, check legacy shared PIN hash
      const legacyHash = process.env.SHARED_PIN_HASH;
      if (legacyHash && pinHash === legacyHash) {
        return NextResponse.json({ valid: true, identity: null });
      }

      if (process.env.NODE_ENV !== "production") {
        // Local dev fallbacks (Nabin = '1234', Karu = '5678')
        console.warn("[verify-pin] PIN hashes not configured in env. Using local dev fallbacks: Nabin='1234', Karu='5678'");
        nabinHash = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"; // 1234
        karuHash = "6b033d56d1163454b8a24559c5d012db922b936d5ad861a7a030018f6f6cc5d4"; // 5678
      } else {
        console.error("[verify-pin] PIN hashes not configured in environment variables.");
        return NextResponse.json({ valid: false, error: "not_configured" }, { status: 500 });
      }
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
