"use client";

import { getMessaging, getToken as getFCMToken, isSupported, Messaging } from "firebase/messaging";
import { initializeFirebase } from "./index";

let messagingPromise: Promise<Messaging | null> | null = null;

export async function getClientMessaging(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;

  if (!messagingPromise) {
    messagingPromise = isSupported().then((supported) => {
      if (!supported) {
        console.warn("[FCM] Firebase Messaging is not supported in this browser environment.");
        return null;
      }
      const { firebaseApp } = initializeFirebase();
      return getMessaging(firebaseApp);
    }).catch((err) => {
      console.warn("[FCM] Failed to initialize Firebase Messaging:", err);
      return null;
    });
  }

  return messagingPromise;
}

export async function getDeviceToken(swRegistration?: ServiceWorkerRegistration): Promise<string | null> {
  try {
    const messaging = await getClientMessaging();
    if (!messaging) return null;

    const vapidKey = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;
    if (!vapidKey) {
      console.warn("[FCM] NEXT_PUBLIC_FCM_VAPID_KEY is not set in environment variables. FCM token registration will be skipped.");
      return null;
    }

    const reg = swRegistration || (await navigator.serviceWorker?.ready);
    if (!reg) {
      console.warn("[FCM] ServiceWorkerRegistration not available for FCM token.");
      return null;
    }

    const token = await getFCMToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: reg,
    });

    return token || null;
  } catch (err) {
    console.error("[FCM] Error acquiring FCM device token:", err);
    return null;
  }
}
