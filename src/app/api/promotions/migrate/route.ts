import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/auth";
import { migratePromotionsCollection } from "@/lib/promotions/migratePromotions";

export async function POST(request: NextRequest) {
  // Check for admin authentication
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    console.log("Starting promotions migration via API...");
    
    const result = await migratePromotionsCollection(adminDb);
    
    return NextResponse.json({
      ok: true,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors.length,
    });
    
  } catch (error) {
    console.error("Migration API error:", error);
    return NextResponse.json(
      { ok: false, error: "Migration failed" },
      { status: 500 }
    );
  }
}
