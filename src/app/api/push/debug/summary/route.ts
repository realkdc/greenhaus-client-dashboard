import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const { searchParams } = new URL(request.url);
    const env = searchParams.get("env");
    const storeId = searchParams.get("storeId");
    const dryRun = searchParams.get("dryRun") === "true";

    if (!env || !storeId) {
      return NextResponse.json(
        { ok: false, error: "Missing required parameters: env, storeId" },
        { status: 400 }
      );
    }

    // Build query with filters
    let query = adminDb.collection("pushTokens")
      .where("enabled", "==", true)
      .where("optedIn", "==", true)
      .where("env", "==", env)
      .where("storeId", "==", storeId);

    const snapshot = await query.get();
    const tokens = snapshot.docs.map(doc => doc.get("token") as string).filter(Boolean);
    
    // Count by device type
    const iosCount = snapshot.docs.filter(doc => doc.get("deviceOS") === "ios").length;
    const androidCount = snapshot.docs.filter(doc => doc.get("deviceOS") === "android").length;

    // Sample tokens (first 5)
    const sample = tokens.slice(0, 5);

    return NextResponse.json({
      ok: true,
      env,
      storeId,
      counts: {
        total: tokens.length,
        ios: iosCount,
        android: androidCount
      },
      sample,
      queryUsed: { env, storeId }
    });
  } catch (error) {
    console.error("[debug/summary] error", error);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
