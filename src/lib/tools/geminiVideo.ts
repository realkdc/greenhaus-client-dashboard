import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini API
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }
  return new GoogleGenerativeAI(apiKey);
}

// Analyze video content using Gemini (returns full analysis with suggested caption)
export async function analyzeVideoWithGemini(
  videoBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  try {
    const genAI = getGeminiClient();

    // Use Gemini 2.0 Flash for video analysis (best cost-to-performance ratio)
    // At $0.10 per 1M input tokens, 33% cheaper than 1.5 Flash with better performance
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    // Convert buffer to base64
    const base64Video = videoBuffer.toString("base64");

    // Create the request with video and prompt
    const prompt = `Analyze this video and provide a detailed description of:
1. The main visual elements and scenes
2. Any products, cannabis strains, or items shown
3. The overall mood and aesthetic
4. Any text or graphics visible
5. Key moments or highlights

Keep the description concise but informative, focusing on elements that would be relevant for creating an engaging Instagram caption.

At the end, provide a relevant Instagram caption for the video. IMPORTANT: Use the Instagram handle @greenhaus_cannabis (with underscore, not @GreenhausCannabis).`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Video,
          mimeType: mimeType,
        },
      },
      prompt,
    ]);

    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new Error("No analysis generated from video");
    }

    return text;
  } catch (error: any) {
    console.error("Error analyzing video with Gemini:", error);

    // Provide helpful error messages
    if (error?.message?.includes("API_KEY")) {
      throw new Error("Invalid Gemini API key. Please check your configuration.");
    }

    if (error?.message?.includes("quota")) {
      throw new Error("Gemini API quota exceeded. Please try again later.");
    }

    throw new Error(`Failed to analyze video: ${error?.message || "Unknown error"}`);
  }
}

// Generate caption from image(s) using Gemini
export async function generateCaptionFromImages(
  imageBuffers: Array<{ buffer: Buffer; mimeType: string; fileName: string }>,
  contentName?: string,
  contentType?: string,
  platform?: string
): Promise<{ analysis: string; caption: string }> {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    // Build the prompt
    let prompt = `Analyze these image(s) and provide a detailed description of:
1. The main visual elements and scenes
2. Any products, cannabis strains, or items shown
3. The overall mood and aesthetic
4. Any text or graphics visible
5. Key details or highlights

Keep the description concise but informative, focusing on elements that would be relevant for creating an engaging Instagram caption.`;

    if (contentName) {
      prompt += `\n\nContent context: ${contentName}`;
    }

    if (contentType) {
      prompt += `\n\nContent type: ${contentType}`;
    }

    if (platform) {
      prompt += `\n\nPlatform: ${platform}`;
    }

    prompt += `\n\nAt the end, provide a relevant Instagram caption for the content. The caption should be fun, playful, and friendly. Include 3-4 relevant hashtags like #GreenHaus, #HausLife, #CrossvilleTN, or #FlavorForward. End with "21+". Only mention @greenhaus_cannabis if it naturally fits the caption - it's not required.`;

    // Prepare content parts
    const parts: any[] = [];
    
    // Add images
    for (const img of imageBuffers.slice(0, 16)) { // Gemini supports up to 16 images
      parts.push({
        inlineData: {
          data: img.buffer.toString("base64"),
          mimeType: img.mimeType,
        },
      });
    }

    // Add prompt
    parts.push(prompt);

    const result = await model.generateContent(parts);
    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new Error("No analysis generated from images");
    }

    // Extract caption from the response
    // Look for patterns like "A relevant Instagram caption for..." or similar
    // Try multiple patterns to catch different formatting styles
    let caption = "";
    
    // Pattern 1: "A relevant Instagram caption for..." or "Instagram caption:"
    const pattern1 = text.match(/A relevant Instagram caption[^:]*:\s*([\s\S]+?)(?:\n\n|\n(?=\d+\.)|$)/i);
    if (pattern1 && pattern1[1]) {
      caption = pattern1[1].trim();
    }
    
    // Pattern 2: "Instagram caption:" (simpler)
    if (!caption || caption.length < 10) {
      const pattern2 = text.match(/Instagram caption[^:]*:\s*([\s\S]+?)(?:\n\n|\n(?=\d+\.)|$)/i);
      if (pattern2 && pattern2[1]) {
        caption = pattern2[1].trim();
      }
    }
    
    // Pattern 3: Look for quoted caption (might be in quotes)
    if (!caption || caption.length < 10) {
      const pattern3 = text.match(/caption[^:]*:\s*["']?([\s\S]+?)["']?(?:\n\n|\n(?=\d+\.)|$)/i);
      if (pattern3 && pattern3[1]) {
        caption = pattern3[1].trim();
      }
    }
    
    // Strip markdown formatting if present (**text** becomes text)
    if (caption) {
      caption = caption.replace(/\*\*([^*]+)\*\*/g, '$1'); // Remove **bold**
      caption = caption.replace(/\*([^*]+)\*/g, '$1'); // Remove *italic*
      caption = caption.replace(/^["']|["']$/g, ''); // Remove surrounding quotes
      caption = caption.trim();
    }
    
    // If still no good caption, try to extract the last paragraph
    if (!caption || caption.length < 10) {
      const paragraphs = text.split(/\n\n+/);
      // Look for the last substantial paragraph (likely the caption)
      for (let i = paragraphs.length - 1; i >= 0; i--) {
        const para = paragraphs[i].trim();
        // Skip if it's too short, too long, or looks like a section header
        if (para.length > 20 && para.length < 500 && !para.match(/^\d+\./)) {
          caption = para;
          break;
        }
      }
    }

    // If still no caption, use the full text (fallback)
    if (!caption || caption.length < 10) {
      caption = text.trim();
    }
    
    // Final cleanup
    caption = caption.trim();
    
    // Remove any leading/trailing markdown or formatting
    caption = caption.replace(/^[\*\#\-\s]+|[\*\#\-\s]+$/g, '');
    
    // Fix Instagram handle if it's wrong
    caption = caption.replace(/@GreenhausCannabis/gi, '@greenhaus_cannabis');
    
    // Log for debugging
    console.log(`[Gemini] Extracted caption length: ${caption.length}, preview: ${caption.substring(0, 50)}...`);

    return {
      analysis: text,
      caption: caption,
    };
  } catch (error: any) {
    console.error("Error generating caption from images with Gemini:", error);

    if (error?.message?.includes("API_KEY")) {
      throw new Error("Invalid Gemini API key. Please check your configuration.");
    }

    if (error?.message?.includes("quota")) {
      throw new Error("Gemini API quota exceeded. Please try again later.");
    }

    throw new Error(`Failed to generate caption: ${error?.message || "Unknown error"}`);
  }
}

// Generate caption from video using Gemini (extracts suggested caption)
export async function generateCaptionFromVideo(
  videoBuffer: Buffer,
  fileName: string,
  mimeType: string,
  contentName?: string,
  contentType?: string,
  platform?: string
): Promise<{ analysis: string; caption: string }> {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    // Convert buffer to base64
    const base64Video = videoBuffer.toString("base64");

    // Build the prompt
    let prompt = `Analyze this video and provide a detailed description of:
1. The main visual elements and scenes
2. Any products, cannabis strains, or items shown
3. The overall mood and aesthetic
4. Any text or graphics visible
5. Key moments or highlights

Keep the description concise but informative, focusing on elements that would be relevant for creating an engaging Instagram caption.`;

    if (contentName) {
      prompt += `\n\nContent context: ${contentName}`;
    }

    if (contentType) {
      prompt += `\n\nContent type: ${contentType}`;
    }

    if (platform) {
      prompt += `\n\nPlatform: ${platform}`;
    }

    prompt += `\n\nAt the end, provide a relevant Instagram caption for the video. The caption should be fun, playful, and friendly. Include 3-4 relevant hashtags like #GreenHaus, #HausLife, #CrossvilleTN, or #FlavorForward. End with "21+". Only mention @greenhaus_cannabis if it naturally fits the caption - it's not required.`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Video,
          mimeType: mimeType,
        },
      },
      prompt,
    ]);

    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new Error("No analysis generated from video");
    }

    // Extract caption from the response
    // Try multiple patterns to catch different formatting styles
    let caption = "";
    
    // Pattern 1: "A relevant Instagram caption for..." or "Instagram caption:"
    const pattern1 = text.match(/A relevant Instagram caption[^:]*:\s*([\s\S]+?)(?:\n\n|\n(?=\d+\.)|$)/i);
    if (pattern1 && pattern1[1]) {
      caption = pattern1[1].trim();
    }
    
    // Pattern 2: "Instagram caption:" (simpler)
    if (!caption || caption.length < 10) {
      const pattern2 = text.match(/Instagram caption[^:]*:\s*([\s\S]+?)(?:\n\n|\n(?=\d+\.)|$)/i);
      if (pattern2 && pattern2[1]) {
        caption = pattern2[1].trim();
      }
    }
    
    // Pattern 3: Look for quoted caption (might be in quotes)
    if (!caption || caption.length < 10) {
      const pattern3 = text.match(/caption[^:]*:\s*["']?([\s\S]+?)["']?(?:\n\n|\n(?=\d+\.)|$)/i);
      if (pattern3 && pattern3[1]) {
        caption = pattern3[1].trim();
      }
    }
    
    // Strip markdown formatting if present (**text** becomes text)
    if (caption) {
      caption = caption.replace(/\*\*([^*]+)\*\*/g, '$1'); // Remove **bold**
      caption = caption.replace(/\*([^*]+)\*/g, '$1'); // Remove *italic*
      caption = caption.replace(/^["']|["']$/g, ''); // Remove surrounding quotes
      caption = caption.trim();
    }
    
    // If still no good caption, try to extract the last paragraph
    if (!caption || caption.length < 10) {
      const paragraphs = text.split(/\n\n+/);
      // Look for the last substantial paragraph (likely the caption)
      for (let i = paragraphs.length - 1; i >= 0; i--) {
        const para = paragraphs[i].trim();
        // Skip if it's too short, too long, or looks like a section header
        if (para.length > 20 && para.length < 500 && !para.match(/^\d+\./)) {
          caption = para;
          break;
        }
      }
    }

    // If still no caption, use the full text (fallback)
    if (!caption || caption.length < 10) {
      caption = text.trim();
    }
    
    // Final cleanup
    caption = caption.trim();
    
    // Remove any leading/trailing markdown or formatting
    caption = caption.replace(/^[\*\#\-\s]+|[\*\#\-\s]+$/g, '');
    
    // Fix Instagram handle if it's wrong
    caption = caption.replace(/@GreenhausCannabis/gi, '@greenhaus_cannabis');
    
    // Log for debugging
    console.log(`[Gemini] Extracted caption length: ${caption.length}, preview: ${caption.substring(0, 50)}...`);

    return {
      analysis: text,
      caption: caption,
    };
  } catch (error: any) {
    console.error("Error generating caption from video with Gemini:", error);

    if (error?.message?.includes("API_KEY")) {
      throw new Error("Invalid Gemini API key. Please check your configuration.");
    }

    if (error?.message?.includes("quota")) {
      throw new Error("Gemini API quota exceeded. Please try again later.");
    }

    throw new Error(`Failed to generate caption: ${error?.message || "Unknown error"}`);
  }
}

// Check if Gemini API is configured
export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}
