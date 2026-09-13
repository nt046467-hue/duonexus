/* eslint-disable no-undef */
// DuoNexus Service Worker & Firebase Cloud Messaging Worker

function handleIncomingCallNotification(payload) {
  const data = payload.data || {};
  const notification = payload.notification || {};
  const origin = self.location.origin;

  // 1. Silent cancellation/ended event: Dismiss any active ringing notification
  if (data.type === "call_ended" || data.type === "call_cancelled") {
    const callTag = data.callId ? ('call-' + data.callId) : null;
    return self.registration.getNotifications().then(function(notifications) {
      notifications.forEach(function(n) {
        if (!callTag || n.tag === callTag || n.tag.startsWith('call-')) {
          n.close();
        }
      });
    });
  }

  // 2. Missed call notification
  if (data.type === "missed_call") {
    // Clean up ringing notification first
    return self.registration.getNotifications().then(function(notifications) {
      const callTag = data.callId ? ('call-' + data.callId) : null;
      notifications.forEach(function(n) {
        if (callTag && n.tag === callTag) {
          n.close();
        }
      });

      const isVideo = data.callType === "video";
      const title = isVideo ? "📹 Missed Video Call" : "📞 Missed Voice Call";
      const body = data.senderName ? ("Missed call from " + data.senderName) : "Missed call";

      return self.registration.showNotification(title, {
        body: body,
        icon: notification.icon || data.icon || (origin + '/icon-192.png'),
        badge: origin + '/badge-72.png',
        tag: 'missed-call-' + (data.callId || Date.now()),
        renotify: true,
        vibrate: [200, 100, 200],
        data: {
          ...data,
          url: origin + '/chat'
        }
      });
    });
  }

  // 3. Incoming call notification
  const isCall = data.type === "incoming_call";
  const isVideo = data.callType === "video";
  const title = notification.title || data.title || (isCall ? (isVideo ? "📹 Incoming Video Call" : "📞 Incoming Voice Call") : "DuoNexus ❤️");
  const options = {
    body: notification.body || data.body || (isCall ? ((data.senderName || "Partner") + " is calling you...") : "You have a new message!"),
    icon: notification.icon || data.icon || (origin + '/icon-192.png'),
    badge: origin + '/badge-72.png',
    image: notification.image || data.image || null,
    tag: isCall ? ('call-' + (data.callId || 'active')) : (data.tag || 'duonexus-msg'),
    renotify: true,
    requireInteraction: isCall,
    vibrate: isCall ? [500, 250, 500, 250, 500, 250, 500] : [200, 100, 200],
    data: {
      ...data,
      url: data.url || (isCall ? (origin + '/chat?callId=' + (data.callId || '')) : (origin + '/chat'))
    },
    actions: isCall ? [
      { action: "accept", title: "✅ Accept" },
      { action: "decline", title: "❌ Decline" }
    ] : []
  };

  return self.registration.showNotification(title, options);
}

try {
  importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-messaging-compat.js');

  const firebaseConfig = {
    apiKey: "AIzaSyDfmozB3o0fS2INonOtliAzO4okLWE9Rsk",
    authDomain: "our-sweet-conversation.firebaseapp.com",
    projectId: "our-sweet-conversation",
    storageBucket: "our-sweet-conversation.firebasestorage.app",
    messagingSenderId: "561504998058",
    appId: "1:561504998058:web:6f1819edd37adacdeaf6d3"
  };

  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(function(payload) {
    return handleIncomingCallNotification(payload);
  });
} catch (e) {
  console.log('[SW] Firebase messaging script load skipped or failed:', e);
}

// Standard push listener fallback
self.addEventListener('push', function(event) {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }
  event.waitUntil(handleIncomingCallNotification(payload));
});

// Notification click & action handlers
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const data = event.notification.data || {};
  const origin = self.location.origin;
  const callId = data.callId; 

  const isCall = data.type === "incoming_call" || Boolean(callId);
  const isAccept = event.action === "accept";
  const isDecline = event.action === "decline";

  let targetUrl = data.url || (origin + '/chat');

  if (isAccept && callId) {
    targetUrl = `${origin}/chat?answer=${encodeURIComponent(callId)}`;
  } else if (isDecline && callId) {
    targetUrl = `${origin}/chat?decline=${encodeURIComponent(callId)}`;
  } else if (isCall && callId) {
    targetUrl = `${origin}/chat?callId=${encodeURIComponent(callId)}`;
  }

  // Determine event type for active chat tab
  let messageType = "NOTIFICATION_CLICK";
  if (isAccept) {
    messageType = "ACCEPT_CALL";
  } else if (isDecline) {
    messageType = "DECLINE_CALL";
  } else if (isCall) {
    messageType = "OPEN_INCOMING_CALL";
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url && client.url.includes('/chat') && 'focus' in client) {
          client.postMessage({
            type: messageType,
            callId: callId,
            callType: data.callType,
            data: data
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
