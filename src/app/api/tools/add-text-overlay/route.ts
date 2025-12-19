import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { addTextOverlay } from "@/lib/tools/textOverlay";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, textFields } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: "No image URL provided" }, { status: 400 });
    }

    // 1. Fetch image
    const imageRes = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

    // 2. Add text overlay
    const finalBuffer = await addTextOverlay(imageBuffer, textFields);

    // 3. Upload to Vercel Blob
    const fileName = `final-${Date.now()}.png`;
    const blob = await put(`photo-editor/${fileName}`, finalBuffer, {
      access: "public",
      contentType: "image/png",
    });

    return NextResponse.json({ finalImageUrl: blob.url });
  } catch (error: any) {
    console.error("Error in add-text-overlay route:", error);
    return NextResponse.json({ error: error.message || "Failed to add text overlay" }, { status: 500 });
  }
}
