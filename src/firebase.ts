import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Firebase configuration from firebase-applet-config.json
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA7gULYFYAZpggECZA6g0dgTYrkhwaPQxQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "oval-leaf-d9ffs.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "oval-leaf-d9ffs",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "oval-leaf-d9ffs.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "490771641590",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:490771641590:web:c8cf9b0c31593e001da8d7"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom databaseId if provided
const dbId = import.meta.env.VITE_FIREBASE_DATABASE_ID || "ai-studio-englishplacement-4951a063-ae8d-4e3c-aef1-cb9ae9e49298";
export const db = getFirestore(app, dbId);

export const auth = getAuth(app);
export const storage = getStorage(app);

/**
 * Recursively cleans an object or array to ensure it is 100% compliant with Firestore data rules.
 * Specifically eliminates any `undefined` values that cause Firestore SDK to crash with:
 * "Unsupported field value: undefined".
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (data instanceof Date) {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  const cleanObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      cleanObj[key] = sanitizeForFirestore(value);
    }
  }
  return cleanObj as T;
}

export default app;
