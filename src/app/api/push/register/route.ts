import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/auth";

type TokenDocument = {
  token: string;
  userId: string | null;
  deviceOS: "ios" | "android" | null;
  optedIn: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export const runtime = "nodejs";

const payloadSchema = z.object({
  token: z.string().min(1, "Expo token is required"),
  userId: z.string().min(1).optional(),
  deviceOS: z.enum(["ios", "android"]).optional(),
  optedIn: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const json = await request.json();
    const payload = payloadSchema.parse(json);

    const tokenDoc = adminDb.collection("pushTokens").doc(payload.token);
    const now = new Date();

    const snapshot = await tokenDoc.get();
    const existingData = snapshot.exists
      ? (snapshot.data() as Partial<TokenDocument>)
      : null;

    const createdAt = existingData?.createdAt ?? now;

    const nextData: TokenDocument = {
      token: payload.token,
      userId: payload.userId ?? null,
      deviceOS: payload.deviceOS ?? null,
      optedIn: payload.optedIn ?? true,
      createdAt,
      updatedAt: now,
    };

    await tokenDoc.set(nextData, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: error.flatten() },
        { status: 400 },
      );
    }

    console.error("Failed to register push token", error);
    return NextResponse.json(
      { ok: false, error: "Unable to register token" },
      { status: 500 },
    );
  }
}
