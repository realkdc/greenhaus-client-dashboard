import {
  initializeApp,
  getApps,
  getApp,
  type FirebaseApp,
} from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

let firebaseApp: FirebaseApp | null = null;
let firestore: Firestore | null = null;
let firebaseAuth: Auth | null = null;

const isConfigured = Object.values(firebaseConfig).every(
  (value) => typeof value === "string" && value.length > 0
);

if (isConfigured) {
  firebaseApp =
    getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  firebaseAuth = getAuth(firebaseApp);
  firestore = getFirestore(firebaseApp);
} else if (process.env.NODE_ENV === "development") {
  console.warn(
    "Firebase is not configured. Populate NEXT_PUBLIC_FIREBASE_* env vars to enable Firestore."
  );
}

export const app = firebaseApp;
export const auth: Auth | null = firebaseAuth;
export const db: Firestore | null = firestore;
export const firebaseReady = Boolean(firebaseApp);
