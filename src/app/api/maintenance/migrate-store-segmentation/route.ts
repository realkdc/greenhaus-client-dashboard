import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    console.log("Starting store segmentation migration...");

    // Migrate pushTokens with env=="prod" AND storeId=="store_123"
    const pushTokensQuery = adminDb.collection("pushTokens")
      .where("env", "==", "prod")
      .where("storeId", "==", "store_123");

    const pushTokensSnapshot = await pushTokensQuery.get();
    console.log(`Found ${pushTokensSnapshot.docs.length} pushTokens to migrate`);

    let updatedTokens = 0;
    const pushTokensBatch = adminDb.batch();

    pushTokensSnapshot.docs.forEach((doc) => {
      pushTokensBatch.update(doc.ref, {
        storeId: "greenhaus-tn-crossville"
      });
      updatedTokens++;
    });

    if (updatedTokens > 0) {
      await pushTokensBatch.commit();
      console.log(`Updated ${updatedTokens} pushTokens`);
    }

    // Migrate promotions with env=="prod" AND storeId=="store_123"
    const promotionsQuery = adminDb.collection("promotions")
      .where("env", "==", "prod")
      .where("storeId", "==", "store_123");

    const promotionsSnapshot = await promotionsQuery.get();
    console.log(`Found ${promotionsSnapshot.docs.length} promotions to migrate`);

    let updatedPromotions = 0;
    const promotionsBatch = adminDb.batch();

    promotionsSnapshot.docs.forEach((doc) => {
      promotionsBatch.update(doc.ref, {
        storeId: "greenhaus-tn-crossville"
      });
      updatedPromotions++;
    });

    if (updatedPromotions > 0) {
      await promotionsBatch.commit();
      console.log(`Updated ${updatedPromotions} promotions`);
    }

    const result = {
      success: true,
      updatedTokens,
      updatedPromotions,
      message: `Migration completed: ${updatedTokens} pushTokens and ${updatedPromotions} promotions updated`
    };

    console.log("Store segmentation migration completed:", result);
    return NextResponse.json(result);

  } catch (error) {
    console.error("Error during store segmentation migration:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to migrate store segmentation",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
