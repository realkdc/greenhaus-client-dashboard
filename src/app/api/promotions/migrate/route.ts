import { NextRequest, NextResponse } from "next/server";
import { migratePromotions } from "../../../../../scripts/migratePromotions";

export async function POST(request: NextRequest) {
  try {
    // Check for admin key
    const adminKey = request.headers.get("x-admin-key");
    const expectedKey = process.env.NEXT_PUBLIC_VITE_ADMIN_API_KEY;
    
    if (!adminKey || !expectedKey || adminKey !== expectedKey) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    console.log("Starting promotions migration via API...");
    
    const result = await migratePromotions();
    
    return NextResponse.json({
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors.length,
    });
    
  } catch (error) {
    console.error("Migration API error:", error);
    return NextResponse.json(
      { error: "Migration failed" },
      { status: 500 }
    );
  }
}
