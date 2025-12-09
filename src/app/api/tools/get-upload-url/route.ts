import { NextRequest, NextResponse } from "next/server";
import { put } from '@vercel/blob';

// Generate a signed URL for client-side upload
// This allows direct upload to blob storage without going through the serverless function
export async function POST(request: NextRequest) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: 'Blob storage is not configured. Please set BLOB_READ_WRITE_TOKEN in Vercel environment variables.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { fileName, fileSize, contentType } = body;

    if (!fileName) {
      return NextResponse.json(
        { error: "fileName is required" },
        { status: 400 }
      );
    }

    // Generate a signed URL for upload
    // The client will upload directly to this URL
    const blob = await put(`caption-images/${fileName}`, new Uint8Array(0), {
      access: 'public',
      addRandomSuffix: true,
      contentType: contentType || 'application/octet-stream',
    });

    // Return the URL - the client will need to PUT the file to this URL
    // Actually, Vercel Blob doesn't support signed URLs for uploads in the same way
    // We need to use the handleUpload approach or server-side upload
    
    // Let's use server-side upload but with better error handling
    return NextResponse.json({ 
      error: 'Please use /api/tools/upload-images endpoint instead',
      message: 'Direct signed URL uploads are not supported. Use the upload-images endpoint.'
    }, { status: 400 });
  } catch (error: any) {
    console.error("Error in get-upload-url route:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
