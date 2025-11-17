// src/app/api/push/register/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// Canonical store IDs
const STORES = new Set(["greenhaus-tn-crossville", "greenhaus-tn-cookeville"]);
const ENV = new Set(["prod"]); // we only accept prod from app

const EXPO_TOKEN_RE = /^ExponentPushToken\[[A-Za-z0-9-_]+\]$/;

// Simple per-token throttle: block updates < 20s apart
const THROTTLE_SECONDS = 20;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      token,
      deviceOS,
      env,
      storeId,
      optedIn,
      appVersion,
      deviceId,
    } = body as Record<string, unknown>;

    // Validate required fields
    if (typeof token !== "string" || !EXPO_TOKEN_RE.test(token)) {
      return NextResponse.json(
        { ok: false, error: "Invalid Expo token" },
        { status: 400 }
      );
    }
    if (deviceOS !== "ios" && deviceOS !== "android") {
      return NextResponse.json(
        { ok: false, error: "deviceOS must be 'ios' or 'android'" },
        { status: 400 }
      );
    }
    if (typeof env !== "string" || !ENV.has(env)) {
      return NextResponse.json(
        { ok: false, error: "env must be 'prod'" },
        { status: 400 }
      );
    }
    if (typeof storeId !== "string" || !STORES.has(storeId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid storeId" },
        { status: 400 }
      );
    }
    if (typeof optedIn !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "optedIn must be boolean" },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("pushTokens").doc(token);

    // Throttle: if last updated < THROTTLE_SECONDS ago, skip heavy work
    const snap = await docRef.get();
    const now = Date.now();
    if (snap.exists) {
      const prev = snap.get("updatedAt")?.toMillis?.() ?? 0;
      if (prev && now - prev < THROTTLE_SECONDS * 1000) {
        return NextResponse.json({ ok: true, throttled: true });
      }
    }

    // Upsert token
    await docRef.set(
      {
        token,
        deviceOS,
        platform: deviceOS, // legacy field kept for compatibility
        env,
        storeId,
        optedIn,
        appVersion: typeof appVersion === "string" ? appVersion : null,
        deviceId: typeof deviceId === "string" ? deviceId : null,
        enabled: true,
        createdAt: snap.exists ? FieldValue.delete() : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, token, env, storeId });
  } catch (err: any) {
    console.error("[register] error", err);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
  }
}