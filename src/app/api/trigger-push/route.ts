import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminMessaging } from "@/lib/firebase-admin";
import { verifyServerAuth } from "@/lib/server-auth";
import { getClientIp, checkRateLimit, recordFailedAttempt } from "@/lib/auth-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);

  // 1. Rate limiting for notification triggers
  const rateLimit = checkRateLimit(`push_${clientIp}`);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: "Push notification rate limit reached. Please slow down." },
      { status: 429 }
    );
  }

  // 2. Authenticate requester via Firebase ID Token
  const authUser = await verifyServerAuth(req);
  if (!authUser) {
    recordFailedAttempt(`push_${clientIp}`);
    return NextResponse.json(
      { success: false, error: "Unauthorized. Valid authentication required." },
      { status: 401 }
    );
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const {
      type,
      callId,
      callType,
      text,
      image,
    } = payload;

    if (!type || typeof type !== "string") {
      return NextResponse.json({ success: false, message: "Missing or invalid notification type" }, { status: 400 });
    }

    // Authoritative sender & recipient (client cannot forge sender or recipient)
    const senderId = authUser.uid;
    const senderName = authUser.name;
    const recipientId = authUser.partnerId;

    // 3. Intelligent suppression for ordinary messages:
    // If recipient is currently online and active in chat with sender, do NOT send message push
    if (type === "message") {
      try {
        const presenceDoc = await adminDb.collection("presence").doc(recipientId).get();
        if (presenceDoc.exists) {
          const presence = presenceDoc.data();
          const lastSeenDate = presence?.lastSeen?.toDate?.() || (presence?.lastSeen ? new Date(presence.lastSeen) : null);
          const isRecentlySeen = lastSeenDate ? (Date.now() - lastSeenDate.getTime()) < 45_000 : false;
          const isInChat = Boolean(presence?.inChat || presence?.activeConversation === senderId);

          if (presence?.online && isInChat && isRecentlySeen) {
            return NextResponse.json({
              success: true,
              suppressed: true,
              message: "Notification suppressed: recipient is actively viewing the conversation.",
            });
          }
        }
      } catch (presenceErr) {
        console.warn("[trigger-push] Failed to check presence suppression:", presenceErr);
      }
    }

    // 4. Check recipient notification preferences if set
    const userDocRef = adminDb.collection("users").doc(recipientId);
    const userDoc = await userDocRef.get();
    const userData = userDoc.exists ? userDoc.data() : null;

    if (userData?.notificationSettings) {
      const settings = userData.notificationSettings;
      if (type === "message" && settings.messages === false) {
        return NextResponse.json({ success: true, suppressed: true, message: "Recipient has message notifications disabled." });
      }
      if ((type === "incoming_call" || type === "missed_call") && settings.calls === false) {
        return NextResponse.json({ success: true, suppressed: true, message: "Recipient has call notifications disabled." });
      }
    }

    // 5. Retrieve recipient's registered device tokens (support both devices map and fcmTokens array)
    const tokenSet = new Set<string>();

    if (Array.isArray(userData?.fcmTokens)) {
      userData.fcmTokens.forEach((t: any) => {
        if (typeof t === "string" && t.length > 0) tokenSet.add(t);
      });
    }

    if (userData?.devices && typeof userData.devices === "object") {
      Object.values(userData.devices).forEach((device: any) => {
        if (device?.token && typeof device.token === "string") {
          tokenSet.add(device.token);
        }
      });
    }

    const tokens = Array.from(tokenSet);

    if (tokens.length === 0) {
      return NextResponse.json({ success: true, delivered: false, message: "No active push tokens registered for recipient." });
    }

    const isIncomingCall = type === "incoming_call";
    const isMissedCall = type === "missed_call";
    const isCallCancelledOrEnded = type === "call_cancelled" || type === "call_ended";
    const isVideo = callType === "video";

    const stringifiedData: Record<string, string> = {
      type,
      recipientId,
      senderName,
    };

    if (callId) stringifiedData.callId = String(callId);
    if (callType) stringifiedData.callType = String(callType);

    if (isIncomingCall) {
      stringifiedData.url = `/chat?callId=${encodeURIComponent(String(callId || ""))}`;
    } else {
      stringifiedData.url = "/chat";
    }

    // 6. Silent cancellation/ended notice to dismiss ringing notifications across recipient devices
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

    let title = `${senderName} ❤️`;
    let body = typeof text === "string" && text.trim() ? text.trim() : "Sent you a message 💕";

    if (isIncomingCall) {
      title = isVideo ? "📹 Incoming Video Call" : "📞 Incoming Voice Call";
      body = `${senderName} is calling you...`;
    } else if (isMissedCall) {
      title = isVideo ? "📹 Missed Video Call" : "📞 Missed Voice Call";
      body = `Missed call from ${senderName}`;
    }

    const response = await adminMessaging.sendEachForMulticast({
      tokens,
      notification: {
        title,
        body,
        imageUrl: typeof image === "string" && image.startsWith("https://") ? image : undefined,
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
          tag: isIncomingCall ? `call-${callId}` : isMissedCall ? `missed-call-${callId}` : "duonexus-msg",
        },
        fcmOptions: {
          link: stringifiedData.url,
        },
      },
      android: {
        priority: (isIncomingCall || isMissedCall) ? "high" : "normal",
      },
    });

    // 7. Clean up expired or unregistered FCM tokens automatically
    if (response.failureCount > 0) {
      const invalidTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
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
        const remainingTokens = tokens.filter((t) => !invalidTokens.includes(t));
        const updates: Record<string, any> = { fcmTokens: remainingTokens };

        // Also clean up from devices map if present
        if (userData?.devices && typeof userData.devices === "object") {
          const updatedDevices = { ...userData.devices };
          for (const [devId, dev] of Object.entries(updatedDevices)) {
            if (dev && typeof dev === "object" && invalidTokens.includes((dev as any).token)) {
              delete updatedDevices[devId];
            }
          }
          updates.devices = updatedDevices;
        }

        await userDocRef.set(updates, { merge: true }).catch((cleanErr) => {
          console.warn("[trigger-push] Failed to clean up invalid tokens:", cleanErr);
        });
      }
    }

    return NextResponse.json({
      success: true,
      delivered: response.successCount > 0,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (error: any) {
    console.error("[trigger-push] Notification error:", error);
    return NextResponse.json({ success: false, error: "Failed to dispatch notification" }, { status: 500 });
  }
}
