import { NextRequest, NextResponse } from "next/server";
import { adminMessaging } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tokens, title, body: contentBody, data, image } = body;

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json({ success: false, message: "No tokens provided" }, { status: 400 });
    }

    // Clean data payload ensuring all values are strings
    const stringifiedData: Record<string, string> = {};
    if (data && typeof data === "object") {
      Object.entries(data).forEach(([k, v]) => {
        stringifiedData[k] = typeof v === "string" ? v : JSON.stringify(v);
      });
    }

    const isCall = stringifiedData.type === "incoming_call";

    const response = await adminMessaging.sendEachForMulticast({
      tokens,
      notification: {
        title: title || "DuoNexus ❤️",
        body: contentBody || "You have a new notification",
        imageUrl: image,
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
    console.error("[send-push] Failed to send push message:", error);
    return NextResponse.json({ success: false, error: error?.message || "Unknown error" }, { status: 500 });
  }
}
