import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET(request: NextRequest) {
  try {
    // Get all ambassadors
    const ambassadorsSnapshot = await adminDb
      .collection("ambassadors")
      .orderBy("createdAt", "desc")
      .get();

    // Build CSV header
    const headers = ["name", "code", "storeId", "uses", "createdAtISO"];
    
    // Build CSV rows
    const rows = ambassadorsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return [
        data.name || "",
        data.code || "",
        data.storeId || "store_123",
        data.uses || 0,
        data.createdAt?.toDate?.()?.toISOString() || "",
      ];
    });

    // Combine headers and rows
    const csvContent = [headers, ...rows]
      .map((row) => row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=ambassadors.csv",
      },
    });
  } catch (error) {
    console.error("Error exporting ambassadors:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
