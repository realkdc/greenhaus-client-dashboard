import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import captionStyleJson from "@/data/caption-style.json";
import { extractFileId, downloadDriveFile } from "@/lib/tools/googleDrive";
import { analyzeVideoWithGemini, isGeminiConfigured } from "@/lib/tools/geminiVideo";
import { checkUsageLimit, recordUsage, calculateCost } from "@/lib/usage/tracker";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper to convert files to base64
async function fileToBase64(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  return buffer.toString("base64");
}

// Helper to convert buffer to base64
function bufferToBase64(buffer: Buffer): string {
  return buffer.toString("base64");
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

    // Validate input
    if (files.length === 0 && !googleDriveLinks) {
      return NextResponse.json(
        { error: "Please provide at least one file or Google Drive link" },
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
          // Handle video files using Gemini AI
          if (isGeminiConfigured()) {
            try {
              const videoBuffer = Buffer.from(await file.arrayBuffer());
              const videoAnalysis = await analyzeVideoWithGemini(
                videoBuffer,
                file.name,
                file.type
              );
              userPrompt += `\nVideo Analysis (${file.name}):\n${videoAnalysis}\n`;
            } catch (error: any) {
              console.error("Error analyzing video with Gemini:", error);
              userPrompt += `\nNote: Could not analyze video "${file.name}". ${error.message}\n`;
            }
          } else {
            userPrompt += `\nNote: Video file "${file.name}" uploaded. Video analysis unavailable (Gemini API not configured).\n`;
            console.log("Video processing skipped - Gemini API not configured");
          }
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
              base64: bufferToBase64(buffer),
              mimeType,
            });
            userPrompt += `\nProcessed image from Drive: ${fileName}\n`;
          } else if (mimeType.startsWith("video/")) {
            // Handle video from Drive using Gemini AI
            if (isGeminiConfigured()) {
              try {
                const videoAnalysis = await analyzeVideoWithGemini(
                  buffer,
                  fileName,
                  mimeType
                );
                userPrompt += `\nVideo Analysis from Drive (${fileName}):\n${videoAnalysis}\n`;
              } catch (error: any) {
                console.error("Error analyzing Drive video with Gemini:", error);
                userPrompt += `\nNote: Could not analyze video "${fileName}" from Drive. ${error.message}\n`;
              }
            } else {
              userPrompt += `\nNote: Video file "${fileName}" from Drive. Video analysis unavailable (Gemini API not configured).\n`;
              console.log("Video processing skipped for Drive file - Gemini API not configured");
            }
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
