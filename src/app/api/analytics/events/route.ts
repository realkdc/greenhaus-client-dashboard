import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp } from "@/lib/firebaseAdmin";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { logAnalyticsEvent } from "@/lib/analytics";
import { getClientIP } from "@/lib/ip-utils";

const AnalyticsEventSchema = z.object({
  eventType: z.string().min(1, "eventType is required"),
  metadata: z.record(z.unknown()).optional(),
  userId: z.string().nullable().optional(),
});

const RATE_LIMIT_PER_HOUR = 100;

/**
 * Verify Firebase Auth token and extract user ID
 * Returns null if token is missing or invalid (never throws)
 */
async function verifyAuthToken(
  authHeader: string | null
): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const auth = getAuth(getAdminApp());
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    // Token invalid or expired - fail silently
    console.warn("[analytics] Auth token verification failed:", error);
    return null;
  }
}

/**
 * Check rate limit for analytics events
 * Returns true if rate limited, false otherwise
 */
async function checkRateLimit(clientIP: string): Promise<boolean> {
  try {
    const now = new Date();
    const hourKey = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const rateLimitKey = `analytics:${clientIP}`;
    const attemptsKey = `attempts:${hourKey}`;

    const docRef = adminDb.collection("rateLimits").doc(rateLimitKey);
    const doc = await docRef.get();

    if (!doc.exists) {
      return false;
    }

    const data = doc.data();
    const attempts = data?.[attemptsKey] || 0;

    return attempts >= RATE_LIMIT_PER_HOUR;
  } catch (error) {
    console.error("[analytics] Error checking rate limit:", error);
    return false; // Fail open
  }
}

/**
 * Record an analytics event attempt for rate limiting
 */
async function recordAttempt(clientIP: string): Promise<void> {
  try {
    const now = new Date();
    const hourKey = now.toISOString().slice(0, 13);
    const rateLimitKey = `analytics:${clientIP}`;
    const attemptsKey = `attempts:${hourKey}`;

    const docRef = adminDb.collection("rateLimits").doc(rateLimitKey);

    await docRef.set(
      {
        [attemptsKey]: FieldValue.increment(1),
        lastAttempt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error("[analytics] Error recording attempt:", error);
    // Don't throw - this is not critical
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const clientIP = getClientIP(request);

    // Check rate limit
    const isRateLimited = await checkRateLimit(clientIP);
    if (isRateLimited) {
      return NextResponse.json(
        { error: "Too many requests, please try again later" },
        { status: 429 }
      );
    }

    // Record attempt
    await recordAttempt(clientIP);

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

    const parsed = AnalyticsEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { eventType, metadata, userId: bodyUserId } = parsed.data;

    // Try to get userId from auth token first, then body, then null
    const authHeader = request.headers.get("Authorization");
    const tokenUserId = await verifyAuthToken(authHeader);
    const userId = tokenUserId || bodyUserId || null;

    // Determine source - if called from admin dashboard, it's "admin", otherwise "mobile_app"
    // For now, we'll default to "mobile_app" since this endpoint is primarily for mobile
    // Admin can call this too, but we'll track it as "mobile_app" unless we add a source param
    const source = "mobile_app";

    // Log the event (this never throws)
    await logAnalyticsEvent({
      userId,
      eventType,
      source,
      metadata,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    // Catch-all error handler - never throw
    console.error("[analytics] Unexpected error in events endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

