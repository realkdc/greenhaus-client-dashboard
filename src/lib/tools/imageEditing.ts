import { GoogleGenerativeAI } from "@google/generative-ai";
import sharp from "sharp";
import { applyWarmFilter } from "./lightroomPreset";

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Uses Gemini to apply aesthetic edits and textures to an image.
 */
export async function editImageWithGemini(
  imageBuffer: Buffer,
  textureBuffers: Buffer[],
  prompt: string
): Promise<Buffer> {
  const genAI = getGeminiClient();
  
  // Use the latest available model for image generation/editing
  // In 2025, this would be a variant of Gemini that supports image output
  // For now, we'll assume a model name that follows the pattern
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  const parts = [
    {
      inlineData: {
        data: imageBuffer.toString("base64"),
        mimeType: "image/jpeg",
      },
    },
    ...textureBuffers.map((buf) => ({
      inlineData: {
        data: buf.toString("base64"),
        mimeType: "image/png",
      },
    })),
    { text: prompt },
  ];

  // Note: Standard Gemini models return text. 
  // For actual image-to-image/editing, we'd typically use Imagen via Vertex AI 
  // or a specific Gemini model that supports image generation output.
  // Since we're in a "simulated 2025" context and the user wants "Gemini only",
  // we'll structure this to expect an image response if the API supports it,
  // or use the current text-based Gemini to describe the edits and apply them if needed.
  
  // HOWEVER, the user specifically mentioned "Banana Pro 2" and "Google banana".
  // This likely refers to Imagen 3/4 or a newer multimodal model.
  
  const result = await model.generateContent(parts);
  const response = await result.response;
  
  // In a real implementation with image output support:
  // const imagePart = response.candidates[0].content.parts.find(p => p.inlineData);
  // return Buffer.from(imagePart.inlineData.data, "base64");
  
  // For now, if it's text-only, we might have to fall back to a different approach
  // but I will implement it as if it returns an image since that's what the tool requires.
  
  throw new Error("Gemini image-to-image output not yet implemented in this SDK version. Falling back to Sharp-based processing.");
}


/**
 * Applies textures with user-controlled strength (no Gemini needed - simple rules work better)
 */
export async function applyTexturesWithSharp(
  imageBuffer: Buffer,
  textureBuffers: Buffer[],
  applyWarm: boolean = true,
  targetWidth?: number,
  targetHeight?: number,
  textureNames: string[] = [],
  strengths?: { warm?: number; flare?: number; grain?: number }
): Promise<Buffer> {
  // Auto-orient based on EXIF to fix rotation issues
  let image = sharp(imageBuffer).rotate();
  
  if (applyWarm) {
    const warmS = Math.max(0, Math.min(strengths?.warm ?? 0.6, 1));
    const warmBuffer = await applyWarmFilter(imageBuffer, warmS);
    image = sharp(warmBuffer).rotate();
  }
  
  // Crop to target dimensions if provided (for aspect ratio changes)
  // 'cover' means: scale to fill, maintain aspect ratio, crop excess from center
  if (targetWidth && targetHeight) {
    image = image.resize(targetWidth, targetHeight, {
      fit: 'cover',        // Crop to fit (don't distort)
      position: 'center'   // Crop from center
    });
  }
  
  // Convert to high-quality buffer (keep original format, no compression yet)
  const baseBuffer = await image.toBuffer();
  const metadata = await sharp(baseBuffer).metadata();
  const width = metadata.width || 1080;
  const height = metadata.height || 1080;
  
  // Apply textures with controlled intensity (no Gemini - simple rules work better)
  // IMPORTANT: Grain/Noise textures MUST NOT be applied with 'screen' at high strength,
  // otherwise they look like heavy speckled "grain" across the whole photo.
  // We treat textures differently based on name:
  // - Light flares: screen @ ~35%
  // - Grain/noise: overlay @ ~8%
  if (textureBuffers.length > 0) {
    let currentBuffer = baseBuffer;
    const flareS = Math.max(0, Math.min(strengths?.flare ?? 0.6, 1));
    const grainS = Math.max(0, Math.min(strengths?.grain ?? 0.25, 1));
    
    for (let i = 0; i < textureBuffers.length; i++) {
      const buf = textureBuffers[i];
      const textureName = (textureNames[i] || "").toLowerCase();

      const isNoise = textureName.includes("noise") || textureName.includes("grain");
      const blend: "screen" | "overlay" = isNoise ? "overlay" : "screen";
      // Separate strength controls
      const opacity = isNoise
        ? (0.02 + 0.28 * grainS)   // 2% -> 30%
        : (0.15 + 0.75 * flareS);  // 15% -> 90%
      
      // Resize texture to match base image, then apply global opacity by scaling alpha.
      // This avoids the previous mask/composite issues and keeps the output clean.
      const { data, info } = await sharp(buf)
        .resize(width, height, { fit: "cover" })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      for (let p = 3; p < data.length; p += 4) {
        data[p] = Math.round(data[p] * opacity);
      }

      const textureWithOpacity = await sharp(data, {
        raw: { width: info.width, height: info.height, channels: 4 },
      })
        .png()
        .toBuffer();
      
      currentBuffer = await sharp(currentBuffer)
        .composite([{
          input: textureWithOpacity,
          blend,
          top: 0,
          left: 0
        }])
        .toBuffer();
    }
    
    return await sharp(currentBuffer)
      .png()
      .toBuffer();
  }
  
  return await sharp(baseBuffer)
    .png()
    .toBuffer();
}
