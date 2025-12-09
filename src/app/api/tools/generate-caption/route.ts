import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import captionStyleJson from "@/data/caption-style.json";
import { extractFileId, downloadDriveFile } from "@/lib/tools/googleDrive";
import { isGeminiConfigured } from "@/lib/tools/geminiVideo";
import { checkUsageLimit, recordUsage, calculateCost } from "@/lib/usage/tracker";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper to convert files to base64 with compression
async function fileToBase64(file: File): Promise<string> {
  const sharp = require('sharp');
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Compress images to reduce payload size (Vercel has 4.5MB limit)
  // Resize to max 800px width and compress to 80% quality
  const compressed = await sharp(buffer)
    .resize(800, null, { withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  return compressed.toString("base64");
}

// Helper to convert buffer to base64 with compression
async function bufferToBase64(buffer: Buffer): Promise<string> {
  const sharp = require('sharp');

  // Compress images from Google Drive too
  const compressed = await sharp(buffer)
    .resize(800, null, { withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  return compressed.toString("base64");
}

// Helper to get image MIME type
function getImageMimeType(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
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

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const googleDriveLinks = formData.get("googleDriveLinks") as string;
    const contentName = formData.get("contentName") as string;
    const contentType = formData.get("contentType") as string || "Single Post";
    const platform = formData.get("platform") as string || "Instagram";

    // Validate input - require either files, Drive links, OR content description
    if (files.length === 0 && !googleDriveLinks && !contentName) {
      return NextResponse.json(
        { error: "Please provide at least one file, Google Drive link, or content description" },
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

    // Collection to hold all images (from files and Drive)
    const imagesToProcess: Array<{ base64: string; mimeType: string }> = [];

    // Process uploaded files
    if (files.length > 0) {
      for (const file of files) {
        if (file.type.startsWith("image/")) {
          // Handle image files
          const base64 = await fileToBase64(file);
          const mimeType = getImageMimeType(file);
          imagesToProcess.push({ base64, mimeType });
        } else if (file.type.startsWith("video/")) {
          // Accept video but skip AI processing to avoid serverless payload limits
          // Videos cause FUNCTION_PAYLOAD_TOO_LARGE errors when sent through API
          userPrompt += `\nVideo file "${file.name}" uploaded. For best results, describe the video content in the "Content Name / Idea" field.\n`;
          console.log(`Video file accepted: ${file.name}, processing skipped due to serverless constraints`);
        }
      }
    }

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
            // Handle image from Drive
            imagesToProcess.push({
              base64: await bufferToBase64(buffer),
              mimeType: "image/jpeg", // Sharp converts to JPEG
            });
            userPrompt += `\nProcessed image from Drive: ${fileName}\n`;
          } else if (mimeType.startsWith("video/")) {
            // Accept video from Drive but skip processing to avoid payload limits
            userPrompt += `\nVideo file "${fileName}" from Google Drive uploaded. For best results, describe the video content in the "Content Name / Idea" field.\n`;
            console.log(`Video from Drive accepted: ${fileName}, processing skipped due to serverless constraints`);
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
    // For carousels, we want to support up to 10 slides
    const maxImages = contentType === "Carousel" ? 12 : 10;
    for (const image of imagesToProcess.slice(0, maxImages)) {
      messages[1].content.push({
        type: "image_url",
        image_url: {
          url: `data:${image.mimeType};base64,${image.base64}`,
          detail: "low", // Use "low" for faster processing and lower cost
        },
      });
    }

    if (imagesToProcess.length > maxImages) {
      userPrompt += `\nNote: Analyzed first ${maxImages} of ${imagesToProcess.length} total images/frames.\n`;
    }

    if (imagesToProcess.length === 0) {
      userPrompt += `\nNo visual content was successfully processed. Please create a caption based on the description provided.\n`;
    }

    userPrompt += "\nPlease create a caption that follows the GreenHaus brand guidelines perfectly.";

    // Update the text content
    messages[1].content[0].text = userPrompt;

    // Call OpenAI API with GPT-5 mini (supports vision)
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: messages,
      max_tokens: 500,
      temperature: 0.8, // Slightly creative but still consistent
    });

    const generatedCaption = completion.choices[0]?.message?.content?.trim();

    if (!generatedCaption) {
      throw new Error("No caption generated");
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

    // Handle specific OpenAI errors
    if (error?.status === 401) {
      return NextResponse.json(
        { error: "Invalid OpenAI API key" },
        { status: 500 }
      );
    }

    if (error?.status === 429) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: error?.message || "Failed to generate caption. Please try again."
      },
      { status: 500 }
    );
  }
}
