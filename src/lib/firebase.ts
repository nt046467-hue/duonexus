// This file is deprecated. Please use imports from '@/firebase' instead.
// Redirecting exports to the central firebase module to avoid duplicate initialization.

import { initializeFirebase } from '@/firebase';

const { firebaseApp, auth, firestore } = initializeFirebase();

export { firebaseApp as app, auth, firestore as database };