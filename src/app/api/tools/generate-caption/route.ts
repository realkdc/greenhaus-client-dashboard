import { NextRequest, NextResponse } from "next/server";
import { put } from '@vercel/blob';
import { extractFileId, downloadDriveFile } from "@/lib/tools/googleDrive";
import { checkUsageLimit, recordUsage } from "@/lib/usage/tracker";
import { saveCaptionToHistory } from "@/lib/caption-history";
import { generateCaptionFromImages, generateCaptionFromVideo, isGeminiConfigured } from "@/lib/tools/geminiVideo";

// Gemini is now the primary caption generator - no OpenAI needed

// Helper to upload buffer to Vercel Blob and return URL
async function uploadBufferToBlob(buffer: Buffer, fileName: string): Promise<string> {
  const blob = await put(fileName, buffer, {
    access: 'public',
    addRandomSuffix: true,
  });

  return blob.url;
}

export async function POST(request: NextRequest) {
  try {
    // Check usage limits first
    const usageCheck = await checkUsageLimit();
    if (!usageCheck.allowed) {
      return NextResponse.json(
        {
          error: usageCheck.warningMessage,
          usageInfo: {
            currentCost: usageCheck.currentCost,
            limit: usageCheck.limit,
            percentUsed: usageCheck.percentUsed,
          }
        },
        { status: 429 } // Too Many Requests
      );
    }

    const body = await request.json();
    const imageUrls = body.imageUrls as string[] || [];
    const googleDriveLinks = body.googleDriveLinks as string;
    const contentName = body.contentName as string;
    const contentType = body.contentType as string || "Single Post";
    const platform = body.platform as string || "Instagram";

    // Validate input - require either image URLs, Drive links, OR content description
    if (imageUrls.length === 0 && !googleDriveLinks && !contentName) {
      return NextResponse.json(
        { error: "Please provide at least one image, Google Drive link, or content description" },
        { status: 400 }
      );
    }

    // Check if Gemini is configured
    if (!isGeminiConfigured()) {
      return NextResponse.json(
        { error: "Gemini API is not configured. Please set GEMINI_API_KEY in your environment variables." },
        { status: 500 }
      );
    }

    // Final list of URLs and buffers
    const finalImageUrls: string[] = [...imageUrls];
    const imageBuffers: Array<{ buffer: Buffer; mimeType: string; fileName: string }> = [];
    const videoBuffers: Array<{ buffer: Buffer; mimeType: string; fileName: string; source: string }> = [];
    
    // Track Gemini analyses to return to user
    const videoAnalyses: Array<{ fileName: string; analysis: string; source: string }> = [];

    // Process Google Drive links
    if (googleDriveLinks) {
      const links = googleDriveLinks
        .split(/[\n,]/)
        .map((link) => link.trim())
        .filter((link) => link.length > 0);

      for (const link of links) {
        try {
          const fileId = extractFileId(link);
          if (!fileId) {
            userPrompt += `\nNote: Invalid Google Drive link: ${link}\n`;
            continue;
          }

          const { buffer, mimeType, fileName } = await downloadDriveFile(fileId);

          if (mimeType.startsWith("image/")) {
            // Store image buffer for Gemini processing
            imageBuffers.push({ buffer, mimeType, fileName });
            console.log(`[Caption Generator] Added Google Drive image: ${fileName}`);
          } else if (mimeType.startsWith("video/")) {
            // Store video buffer for Gemini processing
            videoBuffers.push({ buffer, mimeType, fileName, source: 'Google Drive' });
            console.log(`[Caption Generator] Added Google Drive video: ${fileName}`);
          } else {
            console.log(`[Caption Generator] Unsupported file type from Drive: ${fileName} (${mimeType})`);
          }
        } catch (error: any) {
          console.error("Error downloading from Drive:", error);
          const errorMessage = error?.message || "Unknown error";
          
          // Provide user-friendly error messages for common issues
          if (errorMessage.includes("invalid_grant") || errorMessage.includes("account not found")) {
            userPrompt += `\nNote: Google Drive authentication error. Please check that the Google Drive service account credentials are properly configured in environment variables (GOOGLE_DRIVE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY).\n`;
          } else if (errorMessage.includes("permission") || errorMessage.includes("access")) {
            userPrompt += `\nNote: Could not access file from Google Drive link: ${link}. The file may not be shared with the service account or the link may be invalid.\n`;
          } else {
            userPrompt += `\nNote: Could not access file from link: ${link}. ${errorMessage}\n`;
          }
        }
      }
    }

    // Process uploaded image URLs - download them to buffers
    for (const url of finalImageUrls) {
      try {
        const lowerUrl = url.toLowerCase();
        const isVideo = lowerUrl.includes('.mp4') || 
                       lowerUrl.includes('.mov') || 
                       lowerUrl.includes('.avi') || 
                       lowerUrl.includes('.webm') ||
                       lowerUrl.includes('video/');
        
        if (isVideo) {
          // Download video from Blob URL
          const videoResponse = await fetch(url);
          if (!videoResponse.ok) {
            throw new Error(`Failed to download video: ${videoResponse.statusText}`);
          }
          const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
          
          // Determine mime type from URL
          const fileName = url.split('/').pop() || 'video.mp4';
          let mimeType = 'video/mp4';
          if (fileName.includes('.mov')) mimeType = 'video/quicktime';
          else if (fileName.includes('.webm')) mimeType = 'video/webm';
          else if (fileName.includes('.avi')) mimeType = 'video/x-msvideo';
          
          videoBuffers.push({ buffer: videoBuffer, mimeType, fileName, source: 'Upload' });
          console.log(`[Caption Generator] Added uploaded video: ${fileName}`);
        } else {
          // Download image from Blob URL
          const imageResponse = await fetch(url);
          if (!imageResponse.ok) {
            throw new Error(`Failed to download image: ${imageResponse.statusText}`);
          }
          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          
          // Determine mime type from URL
          const fileName = url.split('/').pop() || 'image.jpg';
          let mimeType = 'image/jpeg';
          if (fileName.includes('.png')) mimeType = 'image/png';
          else if (fileName.includes('.gif')) mimeType = 'image/gif';
          else if (fileName.includes('.webp')) mimeType = 'image/webp';
          
          imageBuffers.push({ buffer: imageBuffer, mimeType, fileName });
          console.log(`[Caption Generator] Added uploaded image: ${fileName}`);
        }
      } catch (error: any) {
        console.error(`[Caption Generator] Error downloading file from ${url}:`, error);
      }
    }

    // Generate caption using Gemini
    let generatedCaption = "";
    let allAnalyses: string[] = [];

    // Process videos first (if any)
    if (videoBuffers.length > 0) {
      console.log(`[Caption Generator] Processing ${videoBuffers.length} video(s) with Gemini...`);
      for (const video of videoBuffers.slice(0, 3)) { // Limit to 3 videos
        try {
          const result = await generateCaptionFromVideo(
            video.buffer,
            video.fileName,
            video.mimeType,
            contentName,
            contentType,
            platform
          );
          
          allAnalyses.push(result.analysis);
          videoAnalyses.push({
            fileName: video.fileName,
            analysis: result.analysis,
            source: video.source
          });
          
          // Use the first video's caption (or combine if multiple)
          if (!generatedCaption) {
            generatedCaption = result.caption;
          }
          
          console.log(`[Caption Generator] Generated caption from video: ${video.fileName}`);
        } catch (error: any) {
          console.error(`[Caption Generator] Error processing video ${video.fileName}:`, error);
        }
      }
    }

    // Process images (if any)
    if (imageBuffers.length > 0) {
      console.log(`[Caption Generator] Processing ${imageBuffers.length} image(s) with Gemini...`);
      try {
        const result = await generateCaptionFromImages(
          imageBuffers.slice(0, 16), // Gemini supports up to 16 images
          contentName,
          contentType,
          platform
        );
        
        allAnalyses.push(result.analysis);
        
        // Use image caption if no video caption was generated
        if (!generatedCaption) {
          generatedCaption = result.caption;
        }
        
        console.log(`[Caption Generator] Generated caption from images`);
      } catch (error: any) {
        console.error(`[Caption Generator] Error processing images:`, error);
        throw error;
      }
    }

    // If no content was provided, return error
    if (imageBuffers.length === 0 && videoBuffers.length === 0) {
      return NextResponse.json(
        { error: "No images or videos were successfully processed. Please check your uploads or Google Drive links." },
        { status: 400 }
      );
    }

    // If no caption was generated, return error
    if (!generatedCaption) {
      return NextResponse.json(
        { error: "Failed to generate caption. Please try again." },
        { status: 500 }
      );
    }

    // Fix Instagram handle if it's wrong (shouldn't happen with new prompts, but just in case)
    generatedCaption = generatedCaption.replace(/@GreenhausCannabis/gi, '@greenhaus_cannabis');

    // Record usage (Gemini usage tracking would go here if needed)
    await recordUsage();

    // Save caption to history
    await saveCaptionToHistory(generatedCaption, finalImageUrls, contentName);

    // Get updated usage info to return to user
    const updatedUsageCheck = await checkUsageLimit();

    return NextResponse.json({
      caption: generatedCaption,
      videoAnalyses: videoAnalyses.length > 0 ? videoAnalyses : undefined,
      usageWarning: updatedUsageCheck.warningMessage,
      usageInfo: {
        percentUsed: Math.round(updatedUsageCheck.percentUsed),
        remainingCost: updatedUsageCheck.remainingCost.toFixed(2),
      },
    });
  } catch (error: any) {
    console.error("Error generating caption:", error);
    console.error("Error details:", {
      status: error?.status,
      code: error?.code,
      message: error?.message,
      type: error?.type,
    });

    // Handle Gemini-specific errors
    if (error?.message?.includes("GEMINI_API_KEY") || error?.message?.includes("Gemini API")) {
      return NextResponse.json(
        { error: "Gemini API is not configured. Please set GEMINI_API_KEY in your environment variables." },
        { status: 500 }
      );
    }

    if (error?.message?.includes("quota")) {
      return NextResponse.json(
        { error: "Gemini API quota exceeded. Please try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: error?.message || "Failed to generate caption. Please try again.",
        details: error?.code ? `Error code: ${error.code}` : undefined
      },
      { status: 500 }
    );
  }
}
