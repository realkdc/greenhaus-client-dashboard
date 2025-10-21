import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyStaffPin } from "@/lib/staffPin";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

const VerifyPinSchema = z.object({
  pin: z.string().regex(/^\d{3,6}$/, "PIN must be 3-6 digits"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pin } = VerifyPinSchema.parse(body);

    // Get client IP for rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    
    // Check rate limit
    const isRateLimited = await checkRateLimit(clientIP);
    if (isRateLimited) {
      return NextResponse.json(
        { error: "Too many attempts, try again later" },
        { status: 429 }
      );
    }

    // Verify the PIN
    const isValid = await verifyStaffPin(pin);
    
    // Record the attempt for rate limiting
    await recordAttempt(clientIP, isValid);

    return NextResponse.json({ ok: isValid });
  } catch (error) {
    console.error("Error verifying staff PIN:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid PIN format" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function checkRateLimit(clientIP: string): Promise<boolean> {
  try {
    const now = new Date();
    const hourKey = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const rateLimitKey = `staffPin:${clientIP}`;
    const attemptsKey = `attempts:${hourKey}`;
    
    const docRef = adminDb.collection('rateLimits').doc(rateLimitKey);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return false;
    }
    
    const data = doc.data();
    const attempts = data?.[attemptsKey] || 0;
    
    return attempts >= 5;
  } catch (error) {
    console.error("Error checking rate limit:", error);
    return false; // Fail open
  }
}

async function recordAttempt(clientIP: string, isValid: boolean): Promise<void> {
  try {
    const now = new Date();
    const hourKey = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const rateLimitKey = `staffPin:${clientIP}`;
    const attemptsKey = `attempts:${hourKey}`;
    
    const docRef = adminDb.collection('rateLimits').doc(rateLimitKey);
    
    await docRef.set({
      [attemptsKey]: FieldValue.increment(1),
      lastAttempt: FieldValue.serverTimestamp(),
      lastResult: isValid
    }, { merge: true });
  } catch (error) {
    console.error("Error recording attempt:", error);
    // Don't throw - this is not critical
  }
}
