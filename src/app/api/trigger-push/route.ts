import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminMessaging } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const {
      type,
      recipientId,
      senderName,
      callId,
      callType,
      text,
      image,
    } = payload;

    if (!recipientId || !type) {
      return NextResponse.json({ success: false, message: "Missing recipientId or type" }, { status: 400 });
    }

    // Retrieve recipient's registered device tokens
    const userDocRef = adminDb.collection("users").doc(recipientId);
    const userDoc = await userDocRef.get();

    let tokens: string[] = [];
    if (userDoc.exists) {
      const data = userDoc.data();
      if (Array.isArray(data?.fcmTokens)) {
        tokens = data.fcmTokens.filter((t: any) => typeof t === "string" && t.length > 0);
      }
    }

    if (tokens.length === 0) {
      console.log(`[trigger-push] No active FCM tokens found for recipient: ${recipientId}`);
      return NextResponse.json({ success: true, delivered: false, message: "No tokens registered for recipient" });
    }

    const isCall = type === "incoming_call";
    const title = isCall
      ? `📞 Incoming ${callType === "video" ? "Video" : "Audio"} Call`
      : `${senderName || "DuoNexus"} ❤️`;

    const body = isCall
      ? `${senderName || "Partner"} is calling you...`
      : (text || "Sent you a message 💕");

    const stringifiedData: Record<string, string> = {
      type,
      recipientId: String(recipientId),
      senderName: String(senderName || ""),
    };

    if (callId) stringifiedData.callId = String(callId);
    if (callType) stringifiedData.callType = String(callType);
    if (isCall) {
      stringifiedData.url = `/chat?callId=${callId}`;
    } else {
      stringifiedData.url = "/chat";
    }

    const response = await adminMessaging.sendEachForMulticast({
      tokens,
      notification: {
        title,
        body,
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
          link: stringifiedData.url,
        },
      },
      android: {
        priority: isCall ? "high" : "normal",
      },
    });

    console.log(`[trigger-push] Sent push to ${recipientId}: ${response.successCount} success, ${response.failureCount} failed.`);

    // Clean up expired or invalid tokens if any failures occurred
    if (response.failureCount > 0) {
      const invalidTokens: string[] = [];
      response.responses.forEach((resp: any, idx: number) => {
        if (!resp.success && resp.error) {
          const code = resp.error.code;
          if (
            code === "messaging/invalid-registration-token" ||
            code === "messaging/registration-token-not-registered"
          ) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        const remaining = tokens.filter((t) => !invalidTokens.includes(t));
        await userDocRef.set({ fcmTokens: remaining }, { merge: true }).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      delivered: response.successCount > 0,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (error: any) {
    console.error("[trigger-push] Failed to process push notification:", error);
    return NextResponse.json({ success: false, error: error?.message || "Internal server error" }, { status: 500 });
  }
}
