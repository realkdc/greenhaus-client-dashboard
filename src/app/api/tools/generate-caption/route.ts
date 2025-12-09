import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { put } from '@vercel/blob';
import captionStyleJson from "@/data/caption-style.json";
import { extractFileId, downloadDriveFile } from "@/lib/tools/googleDrive";
import { checkUsageLimit, recordUsage, calculateCost } from "@/lib/usage/tracker";
import { getRecentPhrasesToAvoid, saveCaptionToHistory } from "@/lib/caption-history";
import { analyzeVideoWithGemini, isGeminiConfigured } from "@/lib/tools/geminiVideo";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configurable model list so we can avoid specific families (e.g., 4o)
const CAPTION_MODELS = (process.env.CAPTION_MODELS || "")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

// Default to gpt-5-mini (as previously used)
// Can override with CAPTION_MODELS env var (comma-separated)
const DEFAULT_MODELS = ["gpt-5-mini"];

// Retry helper for OpenAI calls to ride out short rate limits
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateCaptionWithRetry(messages: any[]) {
  // Try configured models first, otherwise fall back to defaults
  const models = CAPTION_MODELS.length > 0 ? CAPTION_MODELS : DEFAULT_MODELS;
  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await openai.chat.completions.create({
          model,
          messages,
          max_completion_tokens: 4096, // Explicitly set high limit (model supports up to 128k, but 4k is plenty for captions)
          // temperature is not supported for gpt-5-mini (only default value of 1)
        });
      } catch (error: any) {
        lastError = error;
        const status = error?.status ?? error?.response?.status;
        const isRetryable = status === 429 || (status && status >= 500);

        if (!isRetryable) {
          throw error;
        }

        // Respect retry-after header if present; otherwise exponential backoff with jitter
        const retryAfterHeader =
          typeof error?.response?.headers?.get === "function"
            ? error.response.headers.get("retry-after")
            : error?.response?.headers?.["retry-after"];

        const retryAfterMs =
          retryAfterHeader && !isNaN(Number(retryAfterHeader))
            ? Number(retryAfterHeader) * 1000
            : Math.min(4000, 1000 * Math.pow(2, attempt)) + Math.random() * 250;

        console.warn(
          `[Caption Generator] OpenAI ${status} on ${model}, attempt ${attempt + 1} — retrying in ${Math.round(
            retryAfterMs
          )}ms`
        );

        await sleep(retryAfterMs);
      }
    }
  }

  throw lastError || new Error("OpenAI temporarily unavailable. Please try again.");
}

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

    // Build the system prompt with brand guidelines
    const systemPrompt = `You are an expert Instagram caption writer for GreenHaus Cannabis Co., a boutique cannabis dispensary with locations in Crossville, TN and Cookeville, TN.

BRAND VOICE & STYLE:
${JSON.stringify(captionStyleJson, null, 2)}

CRITICAL INSTRUCTIONS - CREATE TRULY UNIQUE CAPTIONS:
The JSON file above shows you HOW captions should be structured and styled. Your job is to UNDERSTAND the PATTERNS and CREATE COMPLETELY NEW, UNIQUE captions - NEVER copy or reuse exact phrases from the JSON examples.

🚫 FORBIDDEN - DO NOT USE THESE EXACT PHRASES:
- DO NOT start with "psst..." or "psst…" - this is just an example pattern, create your own opening
- DO NOT use the exact CTAs from cta_variants - they are examples only, create NEW ones in that style
- DO NOT copy headline_hooks verbatim - understand the playful, conversational style and create NEW hooks
- DO NOT reuse the same phrases you've used before - every caption must be completely unique

✅ WHAT TO DO INSTEAD:
1. **Hook**: Understand the style (playful, conversational, friendly) and CREATE a completely new hook based on what you see in the images. Never use "psst..." or copy any template.

2. **CTA**: Understand the pattern (friendly, inviting, mentions GreenHaus, ends with "21+") and CREATE a brand new CTA every time. Never reuse the same CTA wording.

3. **Details**: Use the "variables" concepts (product names, flavor notes, benefits, moments) naturally based on the actual images you're analyzing.

4. **Hashtags**: Select ${captionStyleJson.format_rules.hashtags.count} hashtags from the examples_pool or create new ones in that style.

5. **Structure**: Hook → Details → Reward → CTA → Hashtags → "21+"

OTHER IMPORTANT RULES:
- Follow the brand voice exactly: ${captionStyleJson.voice.tone.join(", ")}
- Keep captions between ${captionStyleJson.content_unit_framework.length.min_words} and ${captionStyleJson.content_unit_framework.length.max_words} words
- Use ONLY approved emojis: ${captionStyleJson.format_rules.emoji_usage.approved.join(" ")}
- Maximum ${captionStyleJson.format_rules.emoji_usage.max_total} emojis total
- Keep it conversational and friendly, like a knowledgeable budtender friend
- CRITICAL: NEVER use em dashes (—). Use commas, periods, or regular hyphens (-) instead.

Your task: ANALYZE the provided images, UNDERSTAND the JSON patterns, then CREATE a completely fresh, unique caption that follows those patterns. The JSON shows you HOW to write - use that understanding to create something new.`;

    // Build the user prompt
    let userPrompt = `Generate a ${platform} caption for this content:\n\n`;

    userPrompt += `Content Type: ${contentType}\n`;
    userPrompt += `Platform: ${platform}\n\n`;

    if (contentName) {
      userPrompt += `Content Description: ${contentName}\n\n`;
    }

    // Build messages array for OpenAI
    const messages: any[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
        ],
      },
    ];

    // Final list of URLs to send to OpenAI
    const finalImageUrls: string[] = [...imageUrls];

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
            // Upload Drive image to Blob and get URL
            const imageUrl = await uploadBufferToBlob(buffer, fileName);
            finalImageUrls.push(imageUrl);
            userPrompt += `\nProcessed image from Drive: ${fileName}\n`;
          } else if (mimeType.startsWith("video/")) {
            // Analyze video with Gemini if configured
            if (isGeminiConfigured()) {
              try {
                console.log(`[Caption Generator] Analyzing Google Drive video with Gemini: ${fileName}`);
                const videoAnalysis = await analyzeVideoWithGemini(buffer, fileName, mimeType);
                userPrompt += `\n\nVideo Analysis from Google Drive (${fileName}):\n${videoAnalysis}\n`;
                console.log(`[Caption Generator] Successfully analyzed Google Drive video: ${fileName}`);
              } catch (error: any) {
                console.error(`[Caption Generator] Error analyzing Google Drive video ${fileName}:`, error);
                userPrompt += `\n\nNote: Could not analyze video file "${fileName}" from Google Drive. Please describe the video content in the "Content Name / Idea" field for best results.\n`;
              }
            } else {
              console.log(`[Caption Generator] Gemini not configured, skipping Google Drive video: ${fileName}`);
              userPrompt += `\n\nNote: Video file "${fileName}" from Google Drive was provided but video analysis is not configured. Please describe the video content in the "Content Name / Idea" field for best results.\n`;
            }
          } else {
            userPrompt += `\nNote: Unsupported file type from Drive: ${fileName} (${mimeType})\n`;
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

    // Separate videos from images - videos will be analyzed with Gemini, images with OpenAI
    const imageUrlsOnly: string[] = [];
    const videoUrls: string[] = [];
    
    for (const url of finalImageUrls) {
      const lowerUrl = url.toLowerCase();
      const isVideo = lowerUrl.includes('.mp4') || 
                     lowerUrl.includes('.mov') || 
                     lowerUrl.includes('.avi') || 
                     lowerUrl.includes('.webm') ||
                     lowerUrl.includes('video/');
      if (isVideo) {
        videoUrls.push(url);
      } else {
        imageUrlsOnly.push(url);
      }
    }
    
    // Analyze videos with Gemini if configured
    if (videoUrls.length > 0) {
      if (isGeminiConfigured()) {
        console.log(`[Caption Generator] Analyzing ${videoUrls.length} video(s) with Gemini...`);
        for (const videoUrl of videoUrls.slice(0, 3)) { // Limit to 3 videos to avoid timeout
          try {
            // Download video from Blob URL
            const videoResponse = await fetch(videoUrl);
            if (!videoResponse.ok) {
              throw new Error(`Failed to download video: ${videoResponse.statusText}`);
            }
            const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
            
            // Determine mime type from URL
            const fileName = videoUrl.split('/').pop() || 'video.mp4';
            let mimeType = 'video/mp4';
            if (fileName.includes('.mov')) mimeType = 'video/quicktime';
            else if (fileName.includes('.webm')) mimeType = 'video/webm';
            else if (fileName.includes('.avi')) mimeType = 'video/x-msvideo';
            
            // Analyze with Gemini
            const videoAnalysis = await analyzeVideoWithGemini(videoBuffer, fileName, mimeType);
            userPrompt += `\n\nVideo Analysis (${fileName}):\n${videoAnalysis}\n`;
            console.log(`[Caption Generator] Successfully analyzed video: ${fileName}`);
          } catch (error: any) {
            console.error(`[Caption Generator] Error analyzing video ${videoUrl}:`, error);
            userPrompt += `\n\nNote: Could not analyze video file. Please describe the video content in the "Content Name / Idea" field for best results.\n`;
          }
        }
        if (videoUrls.length > 3) {
          userPrompt += `\nNote: Analyzed first 3 of ${videoUrls.length} videos. Remaining videos will be skipped.\n`;
        }
      } else {
        console.log(`[Caption Generator] Gemini not configured, skipping ${videoUrls.length} video(s)`);
        userPrompt += `\n\nNote: ${videoUrls.length} video file(s) were provided but video analysis is not configured. Please describe the video content in the "Content Name / Idea" field for best results.\n`;
      }
    }
    
    // Add all collected images to the message (videos handled separately above)
    const maxImages = 10;
    const imagesToSend = imageUrlsOnly.slice(0, maxImages);
    
    console.log(`[Caption Generator] Sending ${imagesToSend.length} images to OpenAI (out of ${imageUrlsOnly.length} total, ${videoUrls.length} videos analyzed with Gemini)`);
    
    for (const url of imagesToSend) {
      messages[1].content.push({
        type: "image_url",
        image_url: {
          url: url,
          detail: "high", // Use "high" for better image analysis - captions need accurate visual understanding
        },
      });
    }

    if (imageUrlsOnly.length > maxImages) {
      userPrompt += `\nNote: Analyzed first ${maxImages} of ${imageUrlsOnly.length} total images.\n`;
    }

    if (imageUrlsOnly.length === 0 && videoUrls.length === 0) {
      userPrompt += `\nNo visual content was successfully processed. Please create a caption based on the description provided.\n`;
    } else {
      // Emphasize that images/videos were provided and must be analyzed
      if (imageUrlsOnly.length > 0) {
        userPrompt += `\n\nIMPORTANT: ${imageUrlsOnly.length} image(s) are provided above. You MUST carefully analyze these actual images to understand what's in them.`;
      }
      if (videoUrls.length > 0) {
        userPrompt += `\n\nIMPORTANT: ${videoUrls.length} video(s) were analyzed above. Use the video analysis descriptions to understand the video content.`;
      }
      userPrompt += `\n\nThe caption must be based on what you SEE in the images/videos, not just the text description.`;
    }

    // Get recent captions to avoid repetition
    const recentPhrases = await getRecentPhrasesToAvoid();
    
    userPrompt += "\n\n🚫 CRITICAL - DO NOT REUSE THESE PHRASES:";
    userPrompt += "\n- NEVER start with 'psst...' or 'psst…' - create a completely different opening";
    userPrompt += "\n- NEVER copy any headline_hooks from the JSON - they are examples only";
    userPrompt += "\n- NEVER reuse the exact CTAs from cta_variants - create brand new ones every time";
    userPrompt += "\n- NEVER use the same hook, CTA, or phrasing you've used before";
    
    // Add recent hooks and CTAs to avoid
    if (recentPhrases.hooks.length > 0) {
      userPrompt += `\n\n🚫 RECENT HOOKS TO AVOID (do not reuse these exact phrases):`;
      recentPhrases.hooks.slice(0, 10).forEach((hook, i) => {
        userPrompt += `\n   ${i + 1}. "${hook}"`;
      });
    }
    
    if (recentPhrases.ctas.length > 0) {
      userPrompt += `\n\n🚫 RECENT CTAs TO AVOID (do not reuse these exact phrases):`;
      recentPhrases.ctas.slice(0, 10).forEach((cta, i) => {
        userPrompt += `\n   ${i + 1}. "${cta}"`;
      });
    }
    
    if (recentPhrases.recentCaptions.length > 0) {
      userPrompt += `\n\n⚠️ RECENT CAPTIONS FOR CONTEXT (avoid similar phrasing):`;
      recentPhrases.recentCaptions.slice(0, 5).forEach((caption, i) => {
        userPrompt += `\n   ${i + 1}. "${caption}..."`;
      });
      userPrompt += `\n\nYour new caption must be COMPLETELY DIFFERENT from all of these.`;
    }
    userPrompt += "\n\n✅ CRITICAL CONSTRUCTION REQUIREMENTS:";
    userPrompt += "\n1. Structure MUST be: Hook → Details → Reward → CTA → Hashtags → 21+";
    userPrompt += "\n2. Hook: Create a BRAND NEW, UNIQUE hook in a playful, conversational style. Base it on what you see in the images. DO NOT use 'psst...' or any template from the JSON.";
    userPrompt += "\n3. CTA: Create a BRAND NEW, UNIQUE CTA that's friendly and inviting, mentions GreenHaus, and ends with '21+'. DO NOT copy any CTA from the examples. Examples show the STYLE (friendly, location-specific) - create NEW ones in that style:";
    captionStyleJson.cta_variants.forEach((cta: string) => {
      userPrompt += `\n   - "${cta}" (STYLE EXAMPLE ONLY - create something NEW like this, not this exact phrase)`;
    });
    userPrompt += "\n4. Hashtags: Select exactly 4 hashtags from the examples_pool or create new ones in that style.";
    userPrompt += "\n5. NEVER use em dashes (—). Use commas, periods, or regular hyphens (-) instead.";
    userPrompt += "\n\nCONTENT REQUIREMENTS:";
    userPrompt += "\n- ANALYZE the provided images carefully - what products, scenes, or content do you actually see?";
    userPrompt += "\n- CREATE a completely fresh, unique caption - every word should be new, not copied from examples";
    userPrompt += "\n- If you find yourself writing 'psst...' or any phrase from the JSON examples, STOP and create something completely different";
    userPrompt += "\n- Each caption must be 100% unique - no reused hooks, CTAs, or phrases";

    // Update the text content
    messages[1].content[0].text = userPrompt;

    // Call OpenAI with retry/backoff to survive transient rate limits
    const completion = await generateCaptionWithRetry(messages);

    // Log the full response for debugging
    console.log("Token usage:", completion.usage);
    console.log("Finish reason:", completion.choices[0]?.finish_reason);
    console.log("Prompt tokens:", completion.usage?.prompt_tokens);
    console.log("Completion tokens:", completion.usage?.completion_tokens);
    console.log("Total tokens:", completion.usage?.total_tokens);
    
    // Check if we're hitting input token limits
    if (completion.usage?.prompt_tokens && completion.usage.prompt_tokens > 300000) {
      console.warn("WARNING: Prompt tokens very high:", completion.usage.prompt_tokens);
    }

    const generatedCaption = completion.choices[0]?.message?.content?.trim();

    if (!generatedCaption) {
      console.error("No caption in response. Full response:", completion);
      console.error("Choices:", completion.choices);
      console.error("First choice:", completion.choices?.[0]);
      console.error("Message:", completion.choices?.[0]?.message);
      
      // Return more details for debugging
      const debugInfo = {
        hasChoices: !!completion.choices,
        choicesLength: completion.choices?.length,
        firstChoice: completion.choices?.[0],
        finishReason: completion.choices?.[0]?.finish_reason,
        messageRole: completion.choices?.[0]?.message?.role,
        contentType: typeof completion.choices?.[0]?.message?.content,
        contentValue: completion.choices?.[0]?.message?.content,
      };
      throw new Error(`No caption generated. Debug: ${JSON.stringify(debugInfo)}`);
    }

    // Record usage after successful generation
    const tokensUsed = completion.usage;
    if (tokensUsed) {
      const cost = calculateCost(tokensUsed.prompt_tokens, tokensUsed.completion_tokens);
      await recordUsage(cost);
    } else {
      // Fallback to average cost if token info unavailable
      await recordUsage();
    }

    // Save caption to history to avoid future repetition
    await saveCaptionToHistory(generatedCaption, finalImageUrls, contentName);

    // Get updated usage info to return to user
    const updatedUsageCheck = await checkUsageLimit();

    return NextResponse.json({
      caption: generatedCaption,
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

    // Handle specific OpenAI errors
    if (error?.status === 401) {
      return NextResponse.json(
        { error: "Invalid OpenAI API key. Please check your OPENAI_API_KEY environment variable." },
        { status: 500 }
      );
    }

    if (error?.status === 402) {
      return NextResponse.json(
        { 
          error: "OpenAI account payment required. Please add a payment method to your OpenAI account at https://platform.openai.com/account/billing",
          details: "OpenAI requires a payment method on file to use their API, even for free tier usage."
        },
        { status: 402 }
      );
    }

    if (error?.status === 429) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429 }
      );
    }

    // Handle model-specific errors
    if (error?.code === 'model_not_found' || error?.message?.includes('model_not_found')) {
      return NextResponse.json(
        { 
          error: `Model not available. Please check your CAPTION_MODELS environment variable or use a different model.`,
          details: error?.message
        },
        { status: 500 }
      );
    }

    // Handle insufficient quota errors
    if (error?.code === 'insufficient_quota' || error?.message?.includes('insufficient_quota') || error?.message?.includes('billing')) {
      return NextResponse.json(
        { 
          error: "OpenAI account has insufficient quota. Please check your billing at https://platform.openai.com/account/billing",
          details: "You may need to add funds or update your payment method."
        },
        { status: 402 }
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
