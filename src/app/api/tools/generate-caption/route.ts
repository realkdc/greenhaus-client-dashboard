import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { put } from '@vercel/blob';
import captionStyleJson from "@/data/caption-style.json";
import { extractFileId, downloadDriveFile } from "@/lib/tools/googleDrive";
import { checkUsageLimit, recordUsage, calculateCost } from "@/lib/usage/tracker";

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

IMPORTANT RULES:
1. Follow the brand voice exactly: ${captionStyleJson.voice.tone.join(", ")}
2. Keep captions between ${captionStyleJson.content_unit_framework.length.min_words} and ${captionStyleJson.content_unit_framework.length.max_words} words
3. Use ONLY approved emojis: ${captionStyleJson.format_rules.emoji_usage.approved.join(" ")}
4. Maximum ${captionStyleJson.format_rules.emoji_usage.max_total} emojis total
5. Include exactly ${captionStyleJson.format_rules.hashtags.count} hashtags at the end
6. Always end with "21+" for age compliance
7. Use the Hook → Details → Reward → CTA structure
8. Keep it conversational and friendly, like a knowledgeable budtender friend
9. NEVER use em dashes (—). Use commas, periods, or regular hyphens (-) instead

Your task is to analyze the provided content and generate ONE perfect caption that follows all these guidelines.`;

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
            // Accept video from Drive but skip processing to avoid complexity
            userPrompt += `\nVideo file "${fileName}" from Google Drive uploaded. For best results, describe the video content in the "Content Name / Idea" field.\n`;
            console.log(`Video from Drive accepted: ${fileName}, processing skipped`);
          } else {
            userPrompt += `\nNote: Unsupported file type from Drive: ${fileName} (${mimeType})\n`;
          }
        } catch (error: any) {
          console.error("Error downloading from Drive:", error);
          userPrompt += `\nNote: Could not access file from link: ${link}. ${error.message}\n`;
        }
      }
    }

    // Add all collected images to the message
    // We can support more images now since we are sending URLs
    const maxImages = 10;
    for (const url of finalImageUrls.slice(0, maxImages)) {
      messages[1].content.push({
        type: "image_url",
        image_url: {
          url: url,
          detail: "low", // Use "low" for faster processing and lower cost
        },
      });
    }

    if (finalImageUrls.length > maxImages) {
      userPrompt += `\nNote: Analyzed first ${maxImages} of ${finalImageUrls.length} total images.\n`;
    }

    if (finalImageUrls.length === 0) {
      userPrompt += `\nNo visual content was successfully processed. Please create a caption based on the description provided.\n`;
    }

    userPrompt += "\n\nIMPORTANT: Create a UNIQUE and CREATIVE caption that follows the GreenHaus brand guidelines perfectly. ";
    userPrompt += "Avoid using repetitive opening phrases like 'psst... your weekend reset' or similar patterns. ";
    userPrompt += "Each caption should be fresh, original, and tailored specifically to THIS content. ";
    userPrompt += "Vary your approach - use different hooks, angles, and creative openings for each caption. ";
    userPrompt += "NEVER use em dashes (—). Use commas, periods, or regular hyphens (-) instead.";

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
