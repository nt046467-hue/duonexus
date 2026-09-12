import { NextRequest, NextResponse } from "next/server";
import { verifyServerAuth } from "@/lib/server-auth";
import { adminMessaging } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authUser = await verifyServerAuth(req);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Authentication token required." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { tokens, title, body: contentBody, data, image } = body;

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json({ success: false, message: "No tokens provided" }, { status: 400 });
    }

    const safeTokens = tokens.filter((t): t is string => typeof t === "string" && t.length > 0).slice(0, 50);
    if (safeTokens.length === 0) {
      return NextResponse.json({ success: false, message: "Invalid tokens" }, { status: 400 });
    }

    const stringifiedData: Record<string, string> = {};
    if (data && typeof data === "object") {
      Object.entries(data).forEach(([k, v]) => {
        stringifiedData[k] = typeof v === "string" ? v : JSON.stringify(v);
      });
    }

    const isCall = stringifiedData.type === "incoming_call";

    const response = await adminMessaging.sendEachForMulticast({
      tokens: safeTokens,
      notification: {
        title: title || `${authUser.name} ❤️`,
        body: contentBody || "You have a new message",
        imageUrl: typeof image === "string" && image.startsWith("https://") ? image : undefined,
      },
      data: stringifiedData,
      webpush: {
        headers: {
          Urgency: isCall ? "high" : "normal",
        },
        notification: {
          requireInteraction: isCall,
          badge: "/badge-72.png",
          icon: "/icon-192.png",
        },
        fcmOptions: {
          link: stringifiedData.url || "/chat",
        },
      },
      android: {
        priority: isCall ? "high" : "normal",
      },
    });

    return NextResponse.json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (error: any) {
    console.error("[send-push] Push error:", error);
    return NextResponse.json({ success: false, error: "Failed to send push" }, { status: 500 });
  }
}
