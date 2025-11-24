import { NextRequest, NextResponse } from "next/server";
import { getAdminApp } from "@/lib/firebaseAdmin";
import { getFirestore } from "firebase-admin/firestore";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "20", 10), 1), 100);

    // Get admin app and firestore instance
    const adminApp = getAdminApp();
    const adminDb = getFirestore(adminApp);

    // Query all promotions ordered by creation date
    const snapshot = await adminDb
      .collection("promotions")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const promos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamps to ISO strings for JSON serialization
      createdAt: doc.data().createdAt?.toDate().toISOString() || null,
      updatedAt: doc.data().updatedAt?.toDate().toISOString() || null,
      startsAt: doc.data().startsAt?.toDate().toISOString() || null,
      endsAt: doc.data().endsAt?.toDate().toISOString() || null,
    }));

    return NextResponse.json(promos);
  } catch (error) {
    console.error("Error fetching promotions for admin:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error details:", { errorMessage, errorStack });

    return NextResponse.json(
      {
        error: "Failed to fetch promotions",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}
