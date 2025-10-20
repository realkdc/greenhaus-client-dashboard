import { NextResponse } from "next/server";
import {
  collection,
  getDocs,
  query,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  sendExpoPushNotifications,
  isExpoPushToken,
  type ExpoPushResult,
} from "@/lib/expo-push";

export const runtime = "nodejs";

type BroadcastPayload = {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  segment?: {
    env?: "prod" | "staging" | "dev";
    storeId?: string;
  };
};

function getAdminKey(request: Request): string | null {
  const headerKey = request.headers.get("x-admin-key");
  if (headerKey && headerKey.trim()) {
    return headerKey.trim();
  }
  if (process.env.VITE_ADMIN_API_KEY) {
    return process.env.VITE_ADMIN_API_KEY;
  }
  if (process.env.NEXT_PUBLIC_VITE_ADMIN_API_KEY) {
    return process.env.NEXT_PUBLIC_VITE_ADMIN_API_KEY;
  }
  return null;
}

function validateAdminKey(request: Request): Response | null {
  const expectedKey = getAdminKey(request);
  const suppliedKey = request.headers.get("x-admin-key");

  if (!expectedKey) {
    console.warn(
      "VITE_ADMIN_API_KEY is not configured for push broadcast endpoint.",
    );
    return NextResponse.json(
      { error: "Server misconfiguration: admin key missing." },
      { status: 500 },
    );
  }

  if (!suppliedKey || suppliedKey.trim() !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export async function POST(request: Request) {
  if (!db) {
    return NextResponse.json(
      { error: "Firestore is not configured." },
      { status: 500 },
    );
  }

  const unauthorized = validateAdminKey(request);
  if (unauthorized) {
    return unauthorized;
  }

  let payload: BroadcastPayload;
  try {
    payload = (await request.json()) as BroadcastPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const title = payload.title?.trim();
  const body = payload.body?.trim();
  if (!title || !body) {
    return NextResponse.json(
      { error: "Both title and body are required." },
      { status: 400 },
    );
  }

  const data = payload.data && typeof payload.data === "object" ? payload.data : {};

  const env = payload.segment?.env ?? "prod";
  const storeId = payload.segment?.storeId?.trim();

  const constraints: QueryConstraint[] = [where("env", "==", env)];
  if (storeId) {
    constraints.push(where("storeId", "==", storeId));
  }

  const tokensCollection = collection(db, "pushTokens");
  const tokenQuery = query(tokensCollection, ...constraints);
  const snapshot = await getDocs(tokenQuery);

  const tokens = Array.from(
    new Set(
      snapshot.docs
        .map((docSnapshot) => docSnapshot.get("token") as string | undefined)
        .filter(isExpoPushToken),
    ),
  );

  if (tokens.length === 0) {
    return NextResponse.json(
      { error: "No tokens available for this segment." },
      { status: 404 },
    );
  }

  let results: ExpoPushResult[] = [];
  try {
    results = await sendExpoPushNotifications(tokens, { title, body, data });
  } catch (error) {
    console.error("Failed to call Expo Push API", error);
    return NextResponse.json(
      { error: "Failed to deliver push notifications." },
      { status: 502 },
    );
  }

  const okCount = results.filter((result) => result.ok).length;

  return NextResponse.json({
    ok: true,
    totalTokens: tokens.length,
    batches: results.length,
    delivered: okCount,
    results,
  });
}

