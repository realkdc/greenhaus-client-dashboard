import { NextResponse } from "next/server";
import {
  Timestamp,
  addDoc,
  collection,
  type WithFieldValue,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type ReferralPayload = {
  code: string;
  landing?: string;
};

export async function POST(request: Request) {
  if (!db) {
    return NextResponse.json(
      { error: "Firestore is not configured." },
      { status: 500 }
    );
  }

  let payload: ReferralPayload | null = null;
  try {
    payload = (await request.json()) as ReferralPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const code = payload?.code?.trim();
  if (!code) {
    return NextResponse.json(
      { error: "Referral code is required." },
      { status: 400 }
    );
  }

  const landing =
    typeof payload?.landing === "string" && payload.landing.trim().length > 0
      ? payload.landing.trim()
      : "/";

  const userAgent = request.headers.get("user-agent") ?? "unknown";

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip =
    forwardedFor?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;

  const record: WithFieldValue<{
    code: string;
    landing: string;
    ts: Timestamp;
    userAgent: string;
    ip?: string | null;
  }> = {
    code,
    landing,
    ts: Timestamp.now(),
    userAgent,
  };

  if (ip) {
    record.ip = ip;
  }

  try {
    await addDoc(collection(db, "referrals"), record);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Failed to log referral", error);
    return NextResponse.json(
      { error: "Failed to log referral." },
      { status: 500 }
    );
  }
}
