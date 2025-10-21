import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { setStaffPinHash, getStaffPinStatus, hashStaffPin } from "@/lib/staffPin";

const SetPinSchema = z.object({
  newPin: z.string().regex(/^\d{3,6}$/, "PIN must be 3-6 digits"),
  actorEmail: z.string().email().optional(),
});

export async function POST(request: NextRequest) {
  // Check for admin authentication
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = await request.json();
    const { newPin, actorEmail } = SetPinSchema.parse(body);

    // Hash the PIN
    const hash = await hashStaffPin(newPin);
    
    // Store the hash
    await setStaffPinHash(hash, actorEmail);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error setting staff PIN:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Check for admin authentication
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const status = await getStaffPinStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error("Error getting staff PIN status:", error);
    
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
