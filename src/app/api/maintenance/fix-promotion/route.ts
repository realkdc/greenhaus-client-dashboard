import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    console.log("Fixing promotion store IDs...");

    // Get all promotions with old store IDs
    const oldStoreIds = ["cookeville", "crossville", "store_123"];
    let totalUpdated = 0;

    for (const oldStoreId of oldStoreIds) {
      // Find promotions with old store IDs
      const promotionsQuery = adminDb.collection("promotions")
        .where("storeId", "==", oldStoreId);

      const promotionsSnapshot = await promotionsQuery.get();
      console.log(`Found ${promotionsSnapshot.docs.length} promotions with storeId: ${oldStoreId}`);

      if (promotionsSnapshot.docs.length > 0) {
        const batch = adminDb.batch();
        
        promotionsSnapshot.docs.forEach((doc) => {
          let newStoreId = "greenhaus-tn-crossville"; // default
          
          // Map old store IDs to new canonical ones
          if (oldStoreId === "cookeville") {
            newStoreId = "greenhaus-tn-cookeville";
          } else if (oldStoreId === "crossville") {
            newStoreId = "greenhaus-tn-crossville";
          } else if (oldStoreId === "store_123") {
            newStoreId = "greenhaus-tn-crossville";
          }

          batch.update(doc.ref, {
            storeId: newStoreId,
            updatedAt: new Date()
          });
          totalUpdated++;
        });

        await batch.commit();
        console.log(`Updated ${promotionsSnapshot.docs.length} promotions from ${oldStoreId} to ${newStoreId}`);
      }
    }

    const result = {
      success: true,
      totalUpdated,
      message: `Fixed ${totalUpdated} promotions with old store IDs`
    };

    console.log("Promotion fix completed:", result);
    return NextResponse.json(result);

  } catch (error) {
    console.error("Error fixing promotions:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fix promotions",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
