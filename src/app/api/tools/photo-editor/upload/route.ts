import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

// Upload a single generated (canvas) image to Vercel Blob.
// This lets Step 1 generation be 1:1 with the Canvas preview.
export async function POST(request: NextRequest) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        {
          error:
            "Blob storage is not configured. Please set BLOB_READ_WRITE_TOKEN in Vercel environment variables.",
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const safeName = (file.name || "generated.png").replace(/[^\w.\-]+/g, "-");
    const blob = await put(`photo-editor/${Date.now()}-${safeName}`, buffer, {
      access: "public",
      contentType: file.type || "image/png",
      addRandomSuffix: true,
    });

    return NextResponse.json({ url: blob.url });
  } catch (error: any) {
    console.error("Error in photo-editor upload route:", error);
    return NextResponse.json({ error: error?.message || "Upload failed" }, { status: 500 });
  }
}

