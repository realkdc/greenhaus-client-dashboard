import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { put } from '@vercel/blob';
import captionStyleJson from "@/data/caption-style.json";
import { extractFileId, downloadDriveFile } from "@/lib/tools/googleDrive";
import { checkUsageLimit, recordUsage, calculateCost } from "@/lib/usage/tracker";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    userPrompt += "\nPlease create a caption that follows the GreenHaus brand guidelines perfectly.";

    // Update the text content
    messages[1].content[0].text = userPrompt;

    // Call OpenAI API with GPT-4o (better for vision)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // Upgrading to gpt-4o for better vision support
      messages: messages,
      max_tokens: 500,
      temperature: 0.8,
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
