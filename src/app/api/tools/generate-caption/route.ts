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
    
    // Track errors for better user feedback
    const driveErrors: string[] = [];

    // Process Google Drive links
    if (googleDriveLinks) {
      const links = googleDriveLinks
        .split(/[\n,]/)
        .map((link) => link.trim())
        .filter((link) => link.length > 0);

      console.log(`[Caption Generator] Processing ${links.length} Google Drive link(s)...`);

      for (const link of links) {
        try {
          const fileId = extractFileId(link);
          if (!fileId) {
            const errorMsg = `Invalid Google Drive link format: ${link}`;
            console.log(`[Caption Generator] ${errorMsg}`);
            driveErrors.push(errorMsg);
            continue;
          }

          console.log(`[Caption Generator] Downloading Google Drive file: ${fileId}`);
          const { buffer, mimeType, fileName } = await downloadDriveFile(fileId);
          console.log(`[Caption Generator] Successfully downloaded: ${fileName} (${mimeType})`);

          if (mimeType.startsWith("image/")) {
            // Store image buffer for Gemini processing
            imageBuffers.push({ buffer, mimeType, fileName });
            console.log(`[Caption Generator] Added Google Drive image: ${fileName}`);
          } else if (mimeType.startsWith("video/")) {
            // Store video buffer for Gemini processing
            videoBuffers.push({ buffer, mimeType, fileName, source: 'Google Drive' });
            console.log(`[Caption Generator] Added Google Drive video: ${fileName}`);
          } else {
            const errorMsg = `Unsupported file type: ${fileName} (${mimeType}). Only images and videos are supported.`;
            console.log(`[Caption Generator] ${errorMsg}`);
            driveErrors.push(errorMsg);
          }
        } catch (error: any) {
          console.error(`[Caption Generator] Error downloading from Drive (${link}):`, error);
          const errorMessage = error?.message || "Unknown error";
          
          // Build user-friendly error message
          let userErrorMsg = "";
          if (errorMessage.includes("invalid_grant") || errorMessage.includes("account not found")) {
            userErrorMsg = `Google Drive authentication error. Please check that GOOGLE_DRIVE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY (or GOOGLE_DRIVE_PRIVATE_KEY) are correctly configured in Vercel environment variables.`;
            console.error(`[Caption Generator] Google Drive authentication error for ${link}: ${errorMessage}`);
          } else if (errorMessage.includes("DECODER routines::unsupported") || errorMessage.includes("bad decrypt")) {
            userErrorMsg = `Private Key Format Error. The GOOGLE_DRIVE_PRIVATE_KEY (or FIREBASE_PRIVATE_KEY) is invalid. It should start with "-----BEGIN PRIVATE KEY-----" and not be surrounded by quotes. Please check Vercel environment variables.`;
            console.error(`[Caption Generator] Private Key format error: ${errorMessage}`);
          } else if (errorMessage.includes("permission") || errorMessage.includes("access") || errorMessage.includes("404")) {
            userErrorMsg = `Could not access file from Google Drive link. Make sure the file is shared with "Anyone with the link can view" and the link is correct.`;
            console.error(`[Caption Generator] Access error for ${link}: ${errorMessage}`);
          } else {
            userErrorMsg = `Failed to download file from Google Drive: ${errorMessage}`;
            console.error(`[Caption Generator] Download error for ${link}: ${errorMessage}`);
          }
          
          driveErrors.push(userErrorMsg);
        }
      }
      
      console.log(`[Caption Generator] Google Drive processing complete: ${imageBuffers.length} images, ${videoBuffers.length} videos, ${driveErrors.length} errors`);
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

    // If no content was provided, return error with details
    if (imageBuffers.length === 0 && videoBuffers.length === 0) {
      let errorMessage = "No images or videos were successfully processed.";
      
      if (driveErrors.length > 0) {
        errorMessage += "\n\nGoogle Drive errors:\n" + driveErrors.map((err, i) => `${i + 1}. ${err}`).join("\n");
      }
      
      if (googleDriveLinks && googleDriveLinks.trim()) {
        errorMessage += "\n\nPlease check:\n- The file is shared with 'Anyone with the link can view'\n- The link is correct and not expired\n- The file is an image or video (not a document or folder)";
      }
      
      console.error(`[Caption Generator] No content processed. Errors: ${JSON.stringify(driveErrors)}`);
      console.error(`[Caption Generator] Image buffers: ${imageBuffers.length}, Video buffers: ${videoBuffers.length}, Upload URLs: ${finalImageUrls.length}`);
      
      return NextResponse.json(
        { error: errorMessage },
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
