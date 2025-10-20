import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let adminApp: App | null = null;

function getEnv(name: string): string | null {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getPrivateKey(rawKey: string | null): string | null {
  if (!rawKey) return null;
  return rawKey.replace(/\\n/g, "\n");
}

export function getAdminApp(): App {
  if (adminApp) {
    return adminApp;
  }

  const existingApp = getApps()[0];
  if (existingApp) {
    adminApp = existingApp;
    return adminApp;
  }

  const projectId = getEnv("FIREBASE_PROJECT_ID") ?? "demo-project";
  const clientEmail = getEnv("FIREBASE_CLIENT_EMAIL") ?? "demo@example.com";
  const privateKey = getPrivateKey(getEnv("FIREBASE_PRIVATE_KEY")) ?? "-----BEGIN PRIVATE KEY-----\nMII...dummy\n-----END PRIVATE KEY-----\n";

  const hasRealCredentials = Boolean(
    getEnv("FIREBASE_PROJECT_ID") &&
      getEnv("FIREBASE_CLIENT_EMAIL") &&
      getPrivateKey(getEnv("FIREBASE_PRIVATE_KEY")),
  );

  if (!hasRealCredentials) {
    console.warn(
      "Firebase Admin environment variables are not fully configured. Using placeholder credentials.",
    );
  }

  adminApp = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  return adminApp;
}

export const adminDb = getFirestore(getAdminApp());


