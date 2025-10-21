import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { ensurePromo } from "@/lib/promotions/ensurePromo";
import {
  coerceCanonicalStoreId,
  resolveStoreAliases,
} from "@/lib/promotions/storeIds";
import { Timestamp } from "firebase-admin/firestore";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters - env and storeId are now required
    const env = searchParams.get("env");
    const storeId = searchParams.get("storeId");
    const limitParam = searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "5", 10), 1), 10);

    // Validate required parameters
    if (!env) {
      return NextResponse.json(
        { error: "env parameter is required" },
        { status: 400 }
      );
    }

    if (!storeId) {
      return NextResponse.json(
        { error: "storeId parameter is required" },
        { status: 400 }
      );
    }

    const { canonical: canonicalStoreId, aliases } =
      resolveStoreAliases(storeId) ?? {
        canonical: coerceCanonicalStoreId(storeId),
        aliases: [storeId],
      };

    const storeIdsToQuery = Array.from(
      new Set([canonicalStoreId, ...aliases]),
    );

    console.log("[promotions API] Query params:", {
      requestedStoreId: storeId,
      canonicalStoreId,
      aliases,
      storeIdsToQuery,
      env,
    });

    // Validate environment parameter
    if (env !== "prod" && env !== "staging") {
      return NextResponse.json(
        { error: "Invalid env parameter. Must be 'prod' or 'staging'" },
        { status: 400 }
      );
    }

    // Build Firestore query with required env and storeId
    let query = adminDb
      .collection("promotions")
      .where("enabled", "==", true)
      .where("env", "==", env)
      .where("storeId", "in", storeIdsToQuery);

    // Execute query
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      return NextResponse.json([]);
    }

    const now = new Date();
    const nowTimestamp = Timestamp.fromDate(now);
    
    // Filter and process results
    const promos = [];
    
    for (const doc of snapshot.docs) {
      const data: any = { id: doc.id, ...doc.data() };
      
      // Check date window constraints
      const startsAt = data.startsAt;
      const endsAt = data.endsAt;
      
      // If startsAt exists, it must be <= now
      if (startsAt && startsAt.toDate() > now) {
        continue;
      }
      
      // If endsAt exists, it must be > now
      if (endsAt && endsAt.toDate() <= now) {
        continue;
      }
      
      try {
        const leanPromo = ensurePromo(data);
        promos.push(leanPromo);
      } catch (error) {
        console.warn(`Skipping invalid promo ${doc.id}:`, error);
        continue;
      }
    }
    
    // Sort by startsAt desc (most recent first)
    promos.sort((a, b) => {
      const aTime = a.startsAt ? new Date(a.startsAt).getTime() : 0;
      const bTime = b.startsAt ? new Date(b.startsAt).getTime() : 0;
      return bTime - aTime; // desc order
    });
    
    // Apply limit
    const limitedPromos = promos.slice(0, limit);
    
    return NextResponse.json(limitedPromos);
    
  } catch (error) {
    console.error("Error fetching promotions:", error);
    return NextResponse.json(
      { error: "Failed to fetch promotions" },
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
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
