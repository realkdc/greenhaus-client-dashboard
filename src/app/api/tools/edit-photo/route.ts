import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { applyTexturesWithSharp } from "@/lib/tools/imageEditing";
import { checkUsageLimit, recordUsage } from "@/lib/usage/tracker";

export async function POST(request: NextRequest) {
  try {
    // 1. Check usage limits
    const usageCheck = await checkUsageLimit();
    if (!usageCheck.allowed) {
      return NextResponse.json({ error: usageCheck.warningMessage }, { status: 429 });
    }

    const body = await request.json();
    const { imageUrl, textureUrls, applyWarmFilter, effectStrength, aspectRatio } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: "No image URL provided" }, { status: 400 });
    }

    // 2. Fetch images
    const imageRes = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
    
    // Get image metadata for aspect ratio calculations
    const imageMetadata = await sharp(imageBuffer).metadata();

    const textureBuffers: Buffer[] = [];
    if (textureUrls && Array.isArray(textureUrls)) {
      for (const url of textureUrls) {
        try {
          // Handle relative URLs - decode them properly
          const decodedUrl = decodeURIComponent(url);
          const fullUrl = url.startsWith('http') ? url : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${decodedUrl}`;
          const texRes = await fetch(fullUrl);
          if (!texRes.ok) {
            console.error(`Failed to fetch texture: ${fullUrl} - ${texRes.statusText}`);
            continue;
          }
          textureBuffers.push(Buffer.from(await texRes.arrayBuffer()));
        } catch (err) {
          console.error(`Error loading texture ${url}:`, err);
          // Continue with other textures even if one fails
        }
      }
    }

    // 3. Calculate target dimensions based on aspect ratio
    const originalWidth = imageMetadata.width || 1080;
    const originalHeight = imageMetadata.height || 1080;
    
    let targetWidth: number | undefined;
    let targetHeight: number | undefined;
    
    if (aspectRatio) {
      switch (aspectRatio) {
        case '1:1': // Square (Instagram post)
          targetWidth = 1080;
          targetHeight = 1080;
          break;
        case '4:5': // Portrait (Instagram post)
          targetWidth = 1080;
          targetHeight = 1350;
          break;
        case '9:16': // Story
          targetWidth = 1080;
          targetHeight = 1920;
          break;
        case '4:3': // Landscape
          targetWidth = 1080;
          targetHeight = 810;
          break;
        default:
          // Keep original dimensions
          break;
      }
    }
    
    // 4. Process image (Using Sharp fallback for now as primary, as current Gemini SDK is text-focused)
    // We can still use Gemini to "decide" parameters if we wanted to be fancy
    const processedBuffer = await applyTexturesWithSharp(
      imageBuffer,
      textureBuffers,
      applyWarmFilter,
      targetWidth,
      targetHeight
    );

    // 4. Upload result to Vercel Blob
    const fileName = `edited-${Date.now()}.jpg`;
    const blob = await put(`photo-editor/${fileName}`, processedBuffer, {
      access: "public",
      contentType: "image/jpeg",
    });

    // 6. Record usage
    await recordUsage(0.01); // Arbitrary cost for image editing

    return NextResponse.json({ editedImageUrl: blob.url });
  } catch (error: any) {
    console.error("Error in edit-photo route:", error);
    return NextResponse.json({ error: error.message || "Failed to edit photo" }, { status: 500 });
  }
}
