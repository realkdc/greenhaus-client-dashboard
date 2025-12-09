import { NextRequest, NextResponse } from "next/server";
import { put } from '@vercel/blob';

// Server-side upload endpoint that accepts files and uploads to Vercel Blob
// This still bypasses the 4.5MB limit because we process files one at a time
export async function POST(request: NextRequest) {
  try {
    // Check if BLOB_READ_WRITE_TOKEN is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: 'Blob storage is not configured. Please set BLOB_READ_WRITE_TOKEN in Vercel environment variables.' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    
    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    const imageUrls: string[] = [];

    // Upload each file to Vercel Blob
    for (const file of files) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        continue; // Skip non-image/video files
      }

      try {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const blob = await put(`caption-images/${file.name}`, buffer, {
          access: 'public',
          addRandomSuffix: true,
          contentType: file.type,
        });

        imageUrls.push(blob.url);
      } catch (uploadError) {
        console.error(`Error uploading ${file.name}:`, uploadError);
        // Continue with other files even if one fails
      }
    }

    if (imageUrls.length === 0) {
      return NextResponse.json(
        { error: "No files were successfully uploaded" },
        { status: 400 }
      );
    }

    return NextResponse.json({ urls: imageUrls });
  } catch (error: any) {
    console.error("Error in upload-images route:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to upload images" },
      { status: 500 }
    );
  }
}
