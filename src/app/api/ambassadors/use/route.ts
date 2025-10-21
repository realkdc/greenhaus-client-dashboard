import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

const UseAmbassadorSchema = z.object({
  code: z.string().min(1, "Code is required"),
  staffPin: z.string().min(1, "Staff PIN is required"),
  staffName: z.string().optional(),
  note: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, staffPin, staffName, note } = UseAmbassadorSchema.parse(body);

    // Validate staff PIN
    const expectedPin = process.env.AMBASSADOR_STAFF_PIN;
    if (!expectedPin) {
      return NextResponse.json(
        { error: "Staff PIN not configured" },
        { status: 500 }
      );
    }

    if (staffPin !== expectedPin) {
      return NextResponse.json(
        { error: "Invalid staff PIN" },
        { status: 401 }
      );
    }

    // Find ambassador by code (case-insensitive)
    const ambassadorsRef = adminDb.collection("ambassadors");
    const querySnapshot = await ambassadorsRef
      .where("codeLower", "==", code.toLowerCase())
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return NextResponse.json(
        { error: "Ambassador code not found" },
        { status: 404 }
      );
    }

    const ambassadorDoc = querySnapshot.docs[0];
    const ambassadorId = ambassadorDoc.id;

    // Use transaction to atomically update ambassador and create use record
    const result = await adminDb.runTransaction(async (transaction) => {
      const ambassadorRef = adminDb.collection("ambassadors").doc(ambassadorId);
      const usesRef = adminDb
        .collection("ambassadors")
        .doc(ambassadorId)
        .collection("uses");

      // Get current ambassador data
      const ambassadorDoc = await transaction.get(ambassadorRef);
      if (!ambassadorDoc.exists) {
        throw new Error("Ambassador not found");
      }

      const currentUses = ambassadorDoc.data()?.uses || 0;
      const newUses = currentUses + 1;

      // Update ambassador uses count
      transaction.update(ambassadorRef, {
        uses: newUses,
      });

      // Create new use record
      const useDocRef = usesRef.doc();
      transaction.set(useDocRef, {
        usedAt: FieldValue.serverTimestamp(),
        staff: staffName || null,
        note: note || null,
      });

      return {
        uses: newUses,
        useId: useDocRef.id,
      };
    });

    return NextResponse.json({
      success: true,
      uses: result.uses,
      useId: result.useId,
    });
  } catch (error) {
    console.error("Error using ambassador code:", error);
    
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
