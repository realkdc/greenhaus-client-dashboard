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
    
    // Log raw text for debugging
    console.log(`[Gemini Raw Image Analysis]: ${text.substring(0, 200)}...`);

    // Extract caption from the response
    let caption = "";
    
    // Strategy 1: Explicit markers (most reliable)
    // Matches: "Instagram caption: ..." or "Caption: ..."
    const markerRegex = /(?:Instagram caption|Caption|Relevant caption)[^:]*:\s*([\s\S]+)/i;
    const match = text.match(markerRegex);
    if (match && match[1]) {
        caption = match[1].trim();
    }
    
    // Strategy 2: If no marker, look for the last paragraph if the text is long
    if (!caption || caption.length < 10) {
        const paragraphs = text.split(/\n\n+/);
        if (paragraphs.length > 1) {
            caption = paragraphs[paragraphs.length - 1].trim();
        }
    }
    
    // Strategy 3: Fallback to full text if it's short (likely just the caption)
    if (!caption || caption.length < 10) {
        caption = text.trim();
    }

    // Cleanup: Remove quotes and markdown block symbols
    caption = caption.replace(/^["']|["']$/g, '');
    caption = caption.replace(/\*\*([^*]+)\*\*/g, '$1'); // bold
    caption = caption.replace(/\*([^*]+)\*/g, '$1');     // italic
    
    // Cleanup: Remove "Here is a caption..." prefixes if captured
    caption = caption.replace(/^(Here is|I've created|Here's) a .*caption.*:?/i, '').trim();

    // Final cleanup
    caption = caption.trim();
    
    // Fix Instagram handle
    caption = caption.replace(/@GreenhausCannabis/gi, '@greenhaus_cannabis');
    
    console.log(`[Gemini] Extracted caption length: ${caption.length}`);

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

    // Log raw text for debugging
    console.log(`[Gemini Raw Video Analysis]: ${text.substring(0, 200)}...`);

    // Extract caption from the response
    let caption = "";
    
    // Strategy 1: Explicit markers
    const markerRegex = /(?:Instagram caption|Caption|Relevant caption)[^:]*:\s*([\s\S]+)/i;
    const match = text.match(markerRegex);
    if (match && match[1]) {
        caption = match[1].trim();
    }
    
    // Strategy 2: Last paragraph
    if (!caption || caption.length < 10) {
        const paragraphs = text.split(/\n\n+/);
        if (paragraphs.length > 1) {
            caption = paragraphs[paragraphs.length - 1].trim();
        }
    }
    
    // Strategy 3: Full text fallback
    if (!caption || caption.length < 10) {
        caption = text.trim();
    }

    // Cleanup
    caption = caption.replace(/^["']|["']$/g, '');
    caption = caption.replace(/\*\*([^*]+)\*\*/g, '$1');
    caption = caption.replace(/\*([^*]+)\*/g, '$1');
    caption = caption.replace(/^(Here is|I've created|Here's) a .*caption.*:?/i, '').trim();

    // Final cleanup
    caption = caption.trim();
    caption = caption.replace(/@GreenhausCannabis/gi, '@greenhaus_cannabis');
    
    console.log(`[Gemini] Extracted video caption length: ${caption.length}`);

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
