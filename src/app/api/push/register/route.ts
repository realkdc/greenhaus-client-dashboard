import { NextResponse } from "next/server";
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isExpoPushToken } from "@/lib/expo-push";

export const runtime = "nodejs";

type RegisterPayload = {
  token?: string;
  env?: string;
  storeId?: string | null;
  deviceId?: string | null;
  platform?: string | null;
  appVersion?: string | null;
};

const ALLOWED_ENVS = new Set(["prod", "production", "staging", "stage", "dev", "development"]);

function normalizeEnv(env: string | undefined): "prod" | "staging" | "dev" {
  const value = (env ?? "prod").toLowerCase();
  if (value.startsWith("prod")) return "prod";
  if (value.startsWith("stag")) return "staging";
  return "dev";
}

export async function POST(request: Request) {
  if (!db) {
    return NextResponse.json(
      { error: "Firestore is not configured." },
      { status: 500 },
    );
  }

  let payload: RegisterPayload;
  try {
    payload = (await request.json()) as RegisterPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const rawToken = payload.token?.trim();
  if (!isExpoPushToken(rawToken)) {
    return NextResponse.json(
      { error: "A valid Expo push token is required." },
      { status: 400 },
    );
  }

  const env = normalizeEnv(payload.env);

  if (payload.env && !ALLOWED_ENVS.has(payload.env.toLowerCase())) {
    return NextResponse.json(
      { error: "Environment must be prod, staging, or dev." },
      { status: 400 },
    );
  }

  const storeId = typeof payload.storeId === "string" && payload.storeId.trim().length > 0
    ? payload.storeId.trim()
    : null;
  const deviceId = typeof payload.deviceId === "string" && payload.deviceId.trim().length > 0
    ? payload.deviceId.trim()
    : null;
  const platform = typeof payload.platform === "string" && payload.platform.trim().length > 0
    ? payload.platform.trim().toLowerCase()
    : null;
  const appVersion = typeof payload.appVersion === "string" && payload.appVersion.trim().length > 0
    ? payload.appVersion.trim()
    : null;

  const tokensCollection = collection(db, "pushTokens");
  const tokenRef = doc(tokensCollection, rawToken);

  let existingCreatedAt = serverTimestamp();
  try {
    const currentDoc = await getDoc(tokenRef);
    if (currentDoc.exists()) {
      const snapshotData = currentDoc.data();
      if (snapshotData?.createdAt) {
        existingCreatedAt = snapshotData.createdAt;
      }
    }
  } catch (error) {
    console.error("Failed to read existing push token", error);
  }

  const now = serverTimestamp();

  await setDoc(
    tokenRef,
    {
      token: rawToken,
      env,
      storeId: storeId ?? null,
      deviceId: deviceId ?? null,
      platform,
      appVersion,
      createdAt: existingCreatedAt,
      updatedAt: now,
    },
    { merge: true },
  );

  return NextResponse.json({ ok: true, token: rawToken, env, storeId });
}

