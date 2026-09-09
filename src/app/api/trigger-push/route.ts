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

    const isIncomingCall = type === "incoming_call";
    const isMissedCall = type === "missed_call";
    const isCallCancelledOrEnded = type === "call_cancelled" || type === "call_ended";
    const isVideo = callType === "video";

    const stringifiedData: Record<string, string> = {
      type,
      recipientId: String(recipientId),
      senderName: String(senderName || ""),
    };

    if (callId) stringifiedData.callId = String(callId);
    if (callType) stringifiedData.callType = String(callType);

    if (isIncomingCall) {
      stringifiedData.url = `/chat?callId=${callId}`;
    } else {
      stringifiedData.url = "/chat";
    }

    // If it's a silent cancellation/ended notice to close notifications
    if (isCallCancelledOrEnded) {
      const response = await adminMessaging.sendEachForMulticast({
        tokens,
        data: stringifiedData,
        webpush: {
          headers: { Urgency: "high" },
        },
        android: { priority: "high" },
      });
      return NextResponse.json({
        success: true,
        delivered: response.successCount > 0,
        successCount: response.successCount,
        failureCount: response.failureCount,
      });
    }

    let title = `${senderName || "DuoNexus"} ❤️`;
    let body = text || "Sent you a message 💕";

    if (isIncomingCall) {
      title = isVideo ? "📹 Incoming Video Call" : "📞 Incoming Voice Call";
      body = `${senderName || "Partner"} is calling you...`;
    } else if (isMissedCall) {
      title = isVideo ? "📹 Missed Video Call" : "📞 Missed Voice Call";
      body = senderName ? `Missed call from ${senderName}` : "Missed call";
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
          Urgency: (isIncomingCall || isMissedCall) ? "high" : "normal",
        },
        notification: {
          requireInteraction: isIncomingCall,
          badge: "/badge-72.png",
          icon: "/icon-192.png",
          tag: isIncomingCall ? `call-${callId}` : isMissedCall ? `missed-call-${callId}` : undefined,
        },
        fcmOptions: {
          link: stringifiedData.url,
        },
      },
      android: {
        priority: (isIncomingCall || isMissedCall) ? "high" : "normal",
      },
    });

    console.log(`[trigger-push] Sent push (${type}) to ${recipientId}: ${response.successCount} success, ${response.failureCount} failed.`);

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
