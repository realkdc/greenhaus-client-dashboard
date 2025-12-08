import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import captionStyleJson from "@/data/caption-style.json";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper to convert files to base64
async function fileToBase64(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  return buffer.toString("base64");
}

// Helper to get image MIME type
function getImageMimeType(file: File): string {
  // Use the File object's type property, which the browser provides correctly
  // This is more reliable than inferring from filename extensions
  if (file.type && file.type.startsWith("image/")) {
    return file.type;
  }
  // Fallback to jpeg if type is missing or invalid (shouldn't happen after filtering)
  return "image/jpeg";
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const googleDriveLinks = formData.get("googleDriveLinks") as string;
    const contentName = formData.get("contentName") as string;

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
    let userPrompt = "Generate an Instagram caption for this content:\n\n";

    if (contentName) {
      userPrompt += `Content Description: ${contentName}\n\n`;
    }

    if (googleDriveLinks) {
      userPrompt += `Google Drive Links: ${googleDriveLinks}\n\n`;
    }

    if (files.length > 0) {
      userPrompt += `I'm uploading ${files.length} file(s) for you to analyze.\n`;
    }

    userPrompt += "\nPlease create a caption that follows the GreenHaus brand guidelines perfectly.";

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

    // Add images if provided (GPT-4o-mini supports vision)
    if (files.length > 0) {
      // Process images only (videos would need different handling)
      const imageFiles = files.filter((file) =>
        file.type.startsWith("image/")
      );

      for (const file of imageFiles.slice(0, 4)) {
        // Limit to 4 images
        const base64 = await fileToBase64(file);
        const mimeType = getImageMimeType(file);

        messages[1].content.push({
          type: "image_url",
          image_url: {
            url: `data:${mimeType};base64,${base64}`,
            detail: "low", // Use "low" for faster processing and lower cost
          },
        });
      }
    }

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

    return NextResponse.json({ caption: generatedCaption });
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
