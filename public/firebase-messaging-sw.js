/* eslint-disable no-undef */
// DuoNexus Production Service Worker & FCM Handler

const CACHE_NAME = "duonexus-cache-v2";
const PRECACHE_ASSETS = [
  "/manifest.json",
  "/badge-72.png",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.png",
];

// ── Cache & Lifecycle ────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Cache-first for static icons & manifest, network-first for pages & APIs
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests, API routes, Firebase backend requests, and WebRTC signaling
  if (
    event.request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("cloudinary.com")
  ) {
    return;
  }

  // Precached static icons
  if (PRECACHE_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});

// ── Notification Handling ───────────────────────────────────────────────────
function handleNotificationPayload(payload) {
  const data = payload.data || {};
  const notification = payload.notification || {};
  const origin = self.location.origin;

  // 1. Silent cancellation / call ended: dismiss active ringing notifications
  if (data.type === "call_ended" || data.type === "call_cancelled") {
    const callTag = data.callId ? `call-${data.callId}` : null;
    return self.registration.getNotifications().then((notifications) => {
      notifications.forEach((n) => {
        if (!callTag || n.tag === callTag || n.tag.startsWith("call-")) {
          n.close();
        }
      });
    });
  }

  // 2. Missed call notification
  if (data.type === "missed_call") {
    return self.registration.getNotifications().then((notifications) => {
      const callTag = data.callId ? `call-${data.callId}` : null;
      notifications.forEach((n) => {
        if (callTag && n.tag === callTag) {
          n.close();
        }
      });

      const isVideo = data.callType === "video";
      const title = isVideo ? "📹 Missed Video Call" : "📞 Missed Voice Call";
      const body = data.senderName ? `Missed call from ${data.senderName}` : "Missed call";

      return self.registration.showNotification(title, {
        body,
        icon: notification.icon || data.icon || `${origin}/icon-192.png`,
        badge: `${origin}/badge-72.png`,
        tag: `missed-call-${data.callId || Date.now()}`,
        renotify: true,
        vibrate: [200, 100, 200],
        data: {
          ...data,
          url: `${origin}/chat`,
        },
      });
    });
  }

  // 3. Incoming call & chat message notification
  const isCall = data.type === "incoming_call";
  const isVideo = data.callType === "video";
  const title =
    notification.title ||
    data.title ||
    (isCall
      ? isVideo
        ? "📹 Incoming Video Call"
        : "📞 Incoming Voice Call"
      : "DuoNexus ❤️");

  const body =
    notification.body ||
    data.body ||
    (isCall
      ? `${data.senderName || "Partner"} is calling you...`
      : "You have a new message 💕");

  const options = {
    body,
    icon: notification.icon || data.icon || `${origin}/icon-192.png`,
    badge: `${origin}/badge-72.png`,
    image: notification.image || data.image || null,
    tag: isCall ? `call-${data.callId || "active"}` : data.tag || "duonexus-msg",
    renotify: true,
    requireInteraction: isCall,
    vibrate: isCall ? [500, 250, 500, 250, 500, 250, 500] : [200, 100, 200],
    data: {
      ...data,
      url: data.url || (isCall ? `${origin}/chat?callId=${encodeURIComponent(data.callId || "")}` : `${origin}/chat`),
    },
    actions: isCall
      ? [
          { action: "accept", title: "✅ Accept" },
          { action: "decline", title: "❌ Decline" },
        ]
      : [],
  };

  return self.registration.showNotification(title, options);
}

// Firebase Cloud Messaging compat script loading
try {
  importScripts("https://www.gstatic.com/firebasejs/11.9.1/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/11.9.1/firebase-messaging-compat.js");

  const firebaseConfig = {
    apiKey: "AIzaSyDfmozB3o0fS2INonOtliAzO4okLWE9Rsk",
    authDomain: "our-sweet-conversation.firebaseapp.com",
    projectId: "our-sweet-conversation",
    storageBucket: "our-sweet-conversation.firebasestorage.app",
    messagingSenderId: "561504998058",
    appId: "1:561504998058:web:6f1819edd37adacdeaf6d3",
  };

  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    return handleNotificationPayload(payload);
  });
} catch (e) {
  console.log("[SW] Firebase messaging compat load skipped, using push listener:", e);
}

// Fallback standard web push event
self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }
  event.waitUntil(handleNotificationPayload(payload));
});

// ── Notification Click & Call Routing ───────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const origin = self.location.origin;
  const callId = data.callId;

  const isCall = data.type === "incoming_call" || Boolean(callId);
  const isAccept = event.action === "accept";
  const isDecline = event.action === "decline";

  let targetUrl = data.url || `${origin}/chat`;

  if (isAccept && callId) {
    targetUrl = `${origin}/chat?answer=${encodeURIComponent(callId)}`;
  } else if (isDecline && callId) {
    targetUrl = `${origin}/chat?decline=${encodeURIComponent(callId)}`;
  } else if (isCall && callId) {
    targetUrl = `${origin}/chat?callId=${encodeURIComponent(callId)}`;
  }

  let messageType = "NOTIFICATION_CLICK";
  if (isAccept) {
    messageType = "ACCEPT_CALL";
  } else if (isDecline) {
    messageType = "DECLINE_CALL";
  } else if (isCall) {
    messageType = "OPEN_INCOMING_CALL";
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If chat is already open, focus it and dispatch message without reloading
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && client.url.includes("/chat") && "focus" in client) {
          client.postMessage({
            type: messageType,
            callId,
            callType: data.callType,
            data,
          });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
