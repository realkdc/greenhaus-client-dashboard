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

    prompt += `\n\nIMPORTANT: After your analysis, provide ONLY the Instagram caption on a new line starting with "CAPTION:". The caption should be fun, playful, and friendly. Include 3-4 relevant hashtags like #GreenHaus, #HausLife, #CrossvilleTN, or #FlavorForward. End with "21+". Only mention @greenhaus_cannabis if it naturally fits the caption - it's not required.

Format your response like this:
[Your analysis here]

CAPTION:
[Your caption here]`;

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
    console.log(`[Gemini Raw Image Analysis]: ${text.substring(0, 300)}...`);

    // Extract caption from the response
    let caption = "";

    // Store full analysis separately
    const fullAnalysis = text;

    // Strategy 1: Look for "CAPTION:" (our explicit format)
    const explicitCaptionMatch = text.match(/CAPTION:\s*\n*([\s\S]*?)(?=\n\n|$)/i);
    if (explicitCaptionMatch && explicitCaptionMatch[1]) {
        caption = explicitCaptionMatch[1].trim();
        console.log('[Gemini] Strategy 1 matched: CAPTION:');
    }

    // Strategy 2: Look for "**Instagram Caption:**" with markdown bold formatting
    if (!caption || caption.length < 10) {
        const instagramCaptionMatch = text.match(/\*\*Instagram Caption:\*\*\s*\n*([\s\S]*?)(?=\n\n\*\*|\n\n[A-Z][a-z]+:|$)/i);
        if (instagramCaptionMatch && instagramCaptionMatch[1]) {
            caption = instagramCaptionMatch[1].trim();
            console.log('[Gemini] Strategy 2 matched: **Instagram Caption:**');
        }
    }

    // Strategy 3: Look for "Instagram Caption:" without markdown
    if (!caption || caption.length < 10) {
        const captionMatch = text.match(/Instagram Caption:\s*\n*([\s\S]*?)(?=\n\n\*\*|\n\n[A-Z][a-z]+:|$)/i);
        if (captionMatch && captionMatch[1]) {
            caption = captionMatch[1].trim();
            console.log('[Gemini] Strategy 3 matched: Instagram Caption: (no markdown)');
        }
    }

    // Strategy 4: Look for "Suggested Instagram Caption" variants
    if (!caption || caption.length < 10) {
        const suggestedMatch = text.match(/\*{0,2}Suggested (Instagram )?Caption:?\*{0,2}\s*\n*([\s\S]*?)(?=\n\n\*\*|\n\n[A-Z][a-z]+:|$)/i);
        if (suggestedMatch && suggestedMatch[2]) {
            caption = suggestedMatch[2].trim();
            console.log('[Gemini] Strategy 4 matched: Suggested Caption');
        }
    }

    // Strategy 5: Look for just "Caption:"
    if (!caption || caption.length < 10) {
        const simpleCaptionMatch = text.match(/(?:^|\n)Caption:\s*\n*([\s\S]*?)(?=\n\n\*\*|\n\n[A-Z][a-z]+:|$)/i);
        if (simpleCaptionMatch && simpleCaptionMatch[1]) {
            caption = simpleCaptionMatch[1].trim();
            console.log('[Gemini] Strategy 5 matched: Caption:');
        }
    }

    // Strategy 6: Find the section that looks like a caption (has emojis, hashtags, or @mentions)
    if (!caption || caption.length < 10) {
        const sections = text.split(/\n\n+/);
        for (let i = sections.length - 1; i >= 0; i--) {
            const section = sections[i].trim();
            // Check if this section looks like a caption (has hashtags, emojis, or mentions)
            // AND doesn't look like analysis (doesn't start with numbered list or "The main", etc.)
            if ((section.includes('#') || section.includes('@') || /[\u{1F300}-\u{1F9FF}]/u.test(section)) &&
                !/^(1\.|2\.|3\.|4\.|5\.|The main|Any products|The overall|Any text|Key details)/i.test(section)) {
                caption = section;
                console.log('[Gemini] Strategy 6 matched: found section with emoji/hashtag/@mention');
                break;
            }
        }
    }

    // Strategy 7: Find text that contains hashtags and "21+" (strong indicator of caption)
    if (!caption || caption.length < 10) {
        const lines = text.split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.includes('#') && (line.includes('21+') || text.substring(text.indexOf(line)).includes('21+'))) {
                // Get the paragraph containing this line
                const paragraphStart = text.lastIndexOf('\n\n', text.indexOf(line));
                const paragraphEnd = text.indexOf('\n\n', text.indexOf(line) + line.length);
                const paragraph = text.substring(
                    paragraphStart >= 0 ? paragraphStart + 2 : 0,
                    paragraphEnd >= 0 ? paragraphEnd : text.length
                ).trim();
                if (paragraph.length > 20) {
                    caption = paragraph;
                    console.log('[Gemini] Strategy 7 matched: found paragraph with hashtags and 21+');
                    break;
                }
            }
        }
    }

    // Strategy 8: Fallback - take the last paragraph, but only if it looks like a caption
    if (!caption || caption.length < 10) {
        const paragraphs = text.split(/\n\n+/);
        if (paragraphs.length > 1) {
            const lastParagraph = paragraphs[paragraphs.length - 1].trim();
            // Only use if it has hashtags, emojis, or mentions (likely a caption)
            if (lastParagraph.includes('#') || lastParagraph.includes('@') || /[\u{1F300}-\u{1F9FF}]/u.test(lastParagraph)) {
                caption = lastParagraph;
                console.log('[Gemini] Strategy 8 matched: last paragraph with caption indicators');
            }
        }
    }

    // Cleanup: Remove any remaining labels/headers
    caption = caption.replace(/^(Image Description:|Video Description:|Instagram Caption:|Caption:|Relevant caption:)\s*/gi, '');

    // Cleanup: Remove quotes and markdown
    caption = caption.replace(/^["']|["']$/g, '');
    caption = caption.replace(/\*\*([^*]+)\*\*/g, '$1'); // bold
    caption = caption.replace(/\*([^*]+)\*/g, '$1');     // italic

    // Cleanup: Remove "Here is a caption..." prefixes
    caption = caption.replace(/^(Here is|I've created|Here's) a .*caption.*:?\s*/i, '').trim();

    // Final cleanup
    caption = caption
      // Strip lines that are only asterisks (leftover markdown)
      .replace(/^\s*\*+\s*$/gm, '')
      // Remove lone leading/trailing asterisks
      .replace(/^\*+\s*/g, '')
      .replace(/\s*\*+$/g, '')
      .trim();
    
    // If we accidentally captured the analysis (starts with analysis indicators), try to find the actual caption
    if (/^(Image Analysis|Video Analysis|1\.|2\.|3\.|The main|Any products|The overall)/i.test(caption) || 
        (caption.length > 200 && !caption.includes('#') && !caption.includes('@'))) {
      // Try to find a section that looks like a caption
      const captionSections = text.split(/\n\n+/);
      for (let i = captionSections.length - 1; i >= 0; i--) {
        const section = captionSections[i].trim();
        if (section.includes('#') && (section.includes('21+') || section.length < 500)) {
          caption = section;
          console.log('[Gemini] Cleanup fallback: found actual caption section (images)');
          break;
        }
      }
    }

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

    prompt += `\n\nIMPORTANT: After your analysis, provide ONLY the Instagram caption on a new line starting with "CAPTION:". The caption should be fun, playful, and friendly. Include 3-4 relevant hashtags like #GreenHaus, #HausLife, #CrossvilleTN, or #FlavorForward. End with "21+". Only mention @greenhaus_cannabis if it naturally fits the caption - it's not required.

Format your response like this:
[Your analysis here]

CAPTION:
[Your caption here]`;

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
    console.log(`[Gemini Raw Video Analysis]: ${text.substring(0, 300)}...`);

    // Extract caption from the response
    let caption = "";

    // Strategy 1: Look for "CAPTION:" (our explicit format)
    const explicitCaptionMatch = text.match(/CAPTION:\s*\n*([\s\S]*?)(?=\n\n|$)/i);
    if (explicitCaptionMatch && explicitCaptionMatch[1]) {
        caption = explicitCaptionMatch[1].trim();
        console.log('[Gemini] Strategy 1 matched: CAPTION:');
    }

    // Strategy 2: Look for "**Instagram Caption:**" with markdown bold formatting
    if (!caption || caption.length < 10) {
        const instagramCaptionMatch = text.match(/\*\*Instagram Caption:\*\*\s*\n*([\s\S]*?)(?=\n\n\*\*|\n\n[A-Z][a-z]+:|$)/i);
        if (instagramCaptionMatch && instagramCaptionMatch[1]) {
            caption = instagramCaptionMatch[1].trim();
            console.log('[Gemini] Strategy 2 matched: **Instagram Caption:**');
        }
    }

    // Strategy 3: Look for "Instagram Caption:" without markdown
    if (!caption || caption.length < 10) {
        const captionMatch = text.match(/Instagram Caption:\s*\n*([\s\S]*?)(?=\n\n\*\*|\n\n[A-Z][a-z]+:|$)/i);
        if (captionMatch && captionMatch[1]) {
            caption = captionMatch[1].trim();
            console.log('[Gemini] Strategy 3 matched: Instagram Caption: (no markdown)');
        }
    }

    // Strategy 4: Look for "Suggested Instagram Caption" variants
    if (!caption || caption.length < 10) {
        const suggestedMatch = text.match(/\*{0,2}Suggested (Instagram )?Caption:?\*{0,2}\s*\n*([\s\S]*?)(?=\n\n\*\*|\n\n[A-Z][a-z]+:|$)/i);
        if (suggestedMatch && suggestedMatch[2]) {
            caption = suggestedMatch[2].trim();
            console.log('[Gemini] Strategy 4 matched: Suggested Caption');
        }
    }

    // Strategy 5: Look for just "Caption:"
    if (!caption || caption.length < 10) {
        const simpleCaptionMatch = text.match(/(?:^|\n)Caption:\s*\n*([\s\S]*?)(?=\n\n\*\*|\n\n[A-Z][a-z]+:|$)/i);
        if (simpleCaptionMatch && simpleCaptionMatch[1]) {
            caption = simpleCaptionMatch[1].trim();
            console.log('[Gemini] Strategy 5 matched: Caption:');
        }
    }

    // Strategy 6: Find the section that looks like a caption (has emojis, hashtags, or @mentions)
    if (!caption || caption.length < 10) {
        const sections = text.split(/\n\n+/);
        for (let i = sections.length - 1; i >= 0; i--) {
            const section = sections[i].trim();
            // Check if this section looks like a caption (has hashtags, emojis, or mentions)
            // AND doesn't look like analysis (doesn't start with numbered list or "The main", etc.)
            if ((section.includes('#') || section.includes('@') || /[\u{1F300}-\u{1F9FF}]/u.test(section)) &&
                !/^(1\.|2\.|3\.|4\.|5\.|The main|Any products|The overall|Any text|Key details)/i.test(section)) {
                caption = section;
                console.log('[Gemini] Strategy 6 matched: found section with emoji/hashtag/@mention');
                break;
            }
        }
    }

    // Strategy 7: Find text that contains hashtags and "21+" (strong indicator of caption)
    if (!caption || caption.length < 10) {
        const lines = text.split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.includes('#') && (line.includes('21+') || text.substring(text.indexOf(line)).includes('21+'))) {
                // Get the paragraph containing this line
                const paragraphStart = text.lastIndexOf('\n\n', text.indexOf(line));
                const paragraphEnd = text.indexOf('\n\n', text.indexOf(line) + line.length);
                const paragraph = text.substring(
                    paragraphStart >= 0 ? paragraphStart + 2 : 0,
                    paragraphEnd >= 0 ? paragraphEnd : text.length
                ).trim();
                if (paragraph.length > 20) {
                    caption = paragraph;
                    console.log('[Gemini] Strategy 7 matched: found paragraph with hashtags and 21+');
                    break;
                }
            }
        }
    }

    // Strategy 8: Fallback - take the last paragraph, but only if it looks like a caption
    if (!caption || caption.length < 10) {
        const paragraphs = text.split(/\n\n+/);
        if (paragraphs.length > 1) {
            const lastParagraph = paragraphs[paragraphs.length - 1].trim();
            // Only use if it has hashtags, emojis, or mentions (likely a caption)
            if (lastParagraph.includes('#') || lastParagraph.includes('@') || /[\u{1F300}-\u{1F9FF}]/u.test(lastParagraph)) {
                caption = lastParagraph;
                console.log('[Gemini] Strategy 8 matched: last paragraph with caption indicators');
            }
        }
    }

    // Cleanup: Remove any remaining labels/headers (with or without asterisks)
    caption = caption.replace(/^(\*{0,2}Image Description:\*{0,2}|\*{0,2}Video Description:\*{0,2}|\*{0,2}Instagram Caption:\*{0,2}|\*{0,2}Caption:\*{0,2}|\*{0,2}Relevant caption:\*{0,2})\s*/gi, '');

    // Cleanup: Remove quotes and markdown formatting
    caption = caption.replace(/^["']|["']$/g, '');
    caption = caption.replace(/\*\*([^*]+)\*\*/g, '$1'); // bold
    caption = caption.replace(/\*([^*]+)\*/g, '$1');     // italic

    // Cleanup: Remove escaped characters that shouldn't be there
    caption = caption.replace(/\\#/g, '#');  // \# -> #
    caption = caption.replace(/\\\//g, '/'); // \/ -> /

    // Cleanup: Remove "Here is a caption..." prefixes
    caption = caption.replace(/^(Here is|I've created|Here's) a .*caption.*:?\s*/i, '').trim();

    // Final cleanup
    caption = caption
      // Strip lines that are only asterisks (leftover markdown)
      .replace(/^\s*\*+\s*$/gm, '')
      // Remove lone leading/trailing asterisks
      .replace(/^\*+\s*/g, '')
      .replace(/\s*\*+$/g, '')
      .trim();
    caption = caption.replace(/@GreenhausCannabis/gi, '@greenhaus_cannabis');
    
    // If we accidentally captured the analysis (starts with analysis indicators), try to find the actual caption
    if (/^(Image Analysis|Video Analysis|1\.|2\.|3\.|The main|Any products|The overall)/i.test(caption) || 
        (caption.length > 200 && !caption.includes('#') && !caption.includes('@'))) {
      // Try to find a section that looks like a caption
      const captionSections = text.split(/\n\n+/);
      for (let i = captionSections.length - 1; i >= 0; i--) {
        const section = captionSections[i].trim();
        if (section.includes('#') && (section.includes('21+') || section.length < 500)) {
          caption = section;
          console.log('[Gemini] Cleanup fallback: found actual caption section (video)');
          break;
        }
      }
    }
    
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
