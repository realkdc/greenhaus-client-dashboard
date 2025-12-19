import {
  initializeApp,
  getApps,
  getApp,
  type FirebaseApp,
} from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

// Firebase configuration - uses environment variables
// Set these in your .env.local file or Vercel environment variables:
// - NEXT_PUBLIC_FIREBASE_API_KEY
// - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
// - NEXT_PUBLIC_FIREBASE_PROJECT_ID
// - NEXT_PUBLIC_FIREBASE_APP_ID
// - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
};

let firebaseApp: FirebaseApp | null = null;
let firestore: Firestore | null = null;
let firebaseAuth: Auth | null = null;

// Check if Firebase is configured with valid credentials
const isConfigured = Object.values(firebaseConfig).every(
  (value) => typeof value === "string" && value.length > 0
);

if (isConfigured) {
  firebaseApp =
    getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  firebaseAuth = getAuth(firebaseApp);
  firestore = getFirestore(firebaseApp);
} else {
  // Firebase not configured - set environment variables to enable Firestore features
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* environment variables in .env.local to enable Firestore features."
    );
  }
}

export const app = firebaseApp;
export const auth: Auth | null = firebaseAuth;
export const db: Firestore | null = firestore;
export const firebaseReady = Boolean(firebaseApp);
