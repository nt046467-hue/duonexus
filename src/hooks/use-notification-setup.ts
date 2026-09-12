"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { doc, setDoc, serverTimestamp, arrayUnion, Firestore } from "firebase/firestore";
import { getDeviceToken } from "@/firebase/messaging";

interface UseNotificationSetupOptions {
  userId?: string | null;
  db?: Firestore | null;
  onTokenSaved?: (token: string) => void;
}

export function useNotificationSetup({ userId, db, onTokenSaved }: UseNotificationSetupOptions = {}) {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [token, setToken] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const registeredTokenRef = useRef<string | null>(null);

  // Sync initial permission state
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Helper to get or create a stable device ID
  const getDeviceId = (): string => {
    if (typeof window === "undefined") return "server_device";
    try {
      const KEY = "duonexus_device_id_v1";
      let id = localStorage.getItem(KEY);
      if (!id) {
        id = typeof crypto !== "undefined" && crypto.randomUUID 
          ? crypto.randomUUID() 
          : `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem(KEY, id);
      }
      return id;
    } catch {
      return "fallback_device_id";
    }
  };

  // Save token to Firestore with device-aware metadata
  const saveTokenToFirestore = useCallback(
    async (fcmToken: string, targetUserId: string, targetDb: Firestore) => {
      if (!fcmToken || !targetUserId || !targetDb) return;
      if (registeredTokenRef.current === fcmToken) return;

      try {
        const userRef = doc(targetDb, "users", targetUserId);
        const deviceId = getDeviceId();
        const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
        const isMobile = typeof window !== "undefined" && /Mobi|Android|iPhone|iPad/i.test(userAgent);

        await setDoc(
          userRef,
          {
            fcmTokens: arrayUnion(fcmToken),
            [`devices.${deviceId}`]: {
              token: fcmToken,
              platform: isMobile ? "mobile" : "desktop",
              userAgent: userAgent.substring(0, 200),
              updatedAt: serverTimestamp(),
            },
            lastActive: serverTimestamp(),
          },
          { merge: true }
        );
        registeredTokenRef.current = fcmToken;
        onTokenSaved?.(fcmToken);
        console.log("[FCM] Device token registered successfully for user:", targetUserId, "device:", deviceId);
      } catch (err) {
        console.error("[FCM] Failed to store FCM token in Firestore:", err);
      }
    },
    [onTokenSaved]
  );

  // Register token flow
  const registerToken = useCallback(
    async (targetUserId?: string | null, targetDb?: Firestore | null) => {
      if (typeof window === "undefined" || !("Notification" in window)) {
        return null;
      }
      if (Notification.permission !== "granted") {
        return null;
      }

      const uid = targetUserId || userId;
      const firestore = targetDb || db;

      setIsRegistering(true);
      try {
        const swReg = await navigator.serviceWorker.ready;
        const deviceToken = await getDeviceToken(swReg);
        if (deviceToken) {
          setToken(deviceToken);
          if (uid && firestore) {
            await saveTokenToFirestore(deviceToken, uid, firestore);
          }
        }
        return deviceToken;
      } catch (err) {
        console.error("[FCM] Registration failed:", err);
        return null;
      } finally {
        setIsRegistering(false);
      }
    },
    [userId, db, saveTokenToFirestore]
  );

  // Request notification permission and automatically register token
  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "denied" as NotificationPermission;
    }

    try {
      const res = await Notification.requestPermission();
      setPermission(res);
      if (res === "granted") {
        await registerToken();
      }
      return res;
    } catch (err) {
      console.error("[Notifications] Request permission failed:", err);
      return "denied" as NotificationPermission;
    }
  }, [registerToken]);

  // If permission is already granted and user is logged in, register automatically on mount
  useEffect(() => {
    if (permission === "granted" && userId && db && !registeredTokenRef.current) {
      registerToken(userId, db);
    }
  }, [permission, userId, db, registerToken]);

  return {
    permission,
    isGranted: permission === "granted",
    token,
    isRegistering,
    requestPermission,
    registerToken,
  };
}
