import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setStaffPinHash, getStaffPinStatus, hashStaffPin } from "@/lib/staffPin";

const SetPinSchema = z.object({
  newPin: z.string().regex(/^\d{3,6}$/, "PIN must be 3-6 digits"),
  actorEmail: z.string().email().optional(),
});

const AdminKeySchema = z.string().min(1, "Admin key required");

export async function POST(request: NextRequest) {
  try {
    // Check admin key
    const adminKey = request.headers.get('x-admin-key');
    const expectedKey = process.env.NEXT_PUBLIC_VITE_ADMIN_API_KEY;
    
    if (!expectedKey) {
      return NextResponse.json(
        { error: "Admin API key not configured" },
        { status: 500 }
      );
    }

    const validatedAdminKey = AdminKeySchema.parse(adminKey);
    if (validatedAdminKey !== expectedKey) {
      return NextResponse.json(
        { error: "Invalid admin key" },
        { status: 401 }
      );
    }

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
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check admin key
    const adminKey = request.headers.get('x-admin-key');
    const expectedKey = process.env.NEXT_PUBLIC_VITE_ADMIN_API_KEY;
    
    if (!expectedKey) {
      return NextResponse.json(
        { error: "Admin API key not configured" },
        { status: 500 }
      );
    }

    const validatedAdminKey = AdminKeySchema.parse(adminKey);
    if (validatedAdminKey !== expectedKey) {
      return NextResponse.json(
        { error: "Invalid admin key" },
        { status: 401 }
      );
    }

    const status = await getStaffPinStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error("Error getting staff PIN status:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid admin key" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
