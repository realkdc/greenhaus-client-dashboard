import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

const EventSchema = z.object({
  id: z.string().min(1, "id is required"),
  type: z.string().min(1, "type is required"),
  userId: z.string().min(1, "userId is required"),
  campaignId: z.string().optional().nullable(),
  retailer: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const parsed = EventSchema.safeParse(body);
    if (!parsed.success) {
      // Log validation errors but don't crash
      console.warn("[events] Invalid request data:", parsed.error.errors);
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { id, type, userId, campaignId, retailer, metadata, timestamp } = parsed.data;

    // Store event in Firestore
    const eventData: Record<string, any> = {
      eventId: id,
      type,
      userId,
      campaignId: campaignId || null,
      retailer: retailer || null,
      metadata: metadata || {},
      timestamp: timestamp ? new Date(timestamp) : FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    };

    await adminDb.collection("events").add(eventData);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    // Catch-all error handler - never crash
    console.error("[events] Unexpected error in events endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
