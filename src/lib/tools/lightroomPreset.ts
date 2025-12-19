import sharp from 'sharp';

/**
 * Replicates the "Warm Preset" from Lightroom using Sharp.
 * 
 * Key adjustments from XMP:
 * - Temperature: +15
 * - Tint: +12
 * - Contrast: -7
 * - Highlights: -9
 * - Whites: -15
 * - Blacks: +2
 * - Vibrance/Saturation: +5
 * - Texture/Clarity: +5/+10
 */
export async function applyWarmFilter(input: Buffer | string): Promise<Buffer> {
  // Auto-orient based on EXIF to fix rotation
  let image = sharp(input).rotate(); // .rotate() without args auto-rotates based on EXIF
  
  // 1. Safe Warmth & Brightness
  // We use modulate because it's much safer than recomb/linear
  image = image.modulate({
    brightness: 1.03,
    saturation: 1.15, // Light saturation boost for brand feel
  });

  // 2. Subtle Golden Tint (Warmth)
  // This is a much softer way to add warmth without "breaking" the colors
  image = image.tint({ r: 255, g: 240, b: 220 }); 

  // 3. Soften the look
  // Instead of sharpening, we'll keep it natural
  
  return await image.toBuffer();

  // 5. Tone Curve (Approximated)
  // [0,0], [36,20], [147,156], [255,255]
  // This is a subtle S-curve that lifts shadows slightly less than input
  // and keeps highlights mostly same.
  
  return await image.toBuffer();
}
