
'use client';

import React, { useMemo, useEffect } from 'react';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize Firebase only once on the client
  const { firebaseApp, firestore, auth } = useMemo(() => initializeFirebase(), []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        console.log('Service Worker registered:', reg.scope);
      }).catch(err => {
        console.log('Service Worker registration failed:', err);
      });
    }
  }, []);

  return (
    <FirebaseProvider firebaseApp={firebaseApp} firestore={firestore} auth={auth}>
      <FirebaseErrorListener />
      {children}
    </FirebaseProvider>
  );
}
