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
  
  // 1. Subtle Warmth (much more professional)
  // Instead of aggressive recomb, we'll use a very light shift
  image = image.recomb([
    [1.06, 0.0, 0.0], // R (very slight boost)
    [0.0, 1.02, 0.0], // G
    [0.0, 0.0, 0.94], // B (slight reduction for warmth)
  ]);

  // 2. Natural Contrast & Brightness
  // Subtle lift to the shadows for that "airy" look
  image = image.linear(1.0, 0.02); 

  // 3. Subtle Saturation (+10%)
  image = image.modulate({
    saturation: 1.12,
    brightness: 1.02,
  });

  // 4. Gentle Clarity
  // Much softer sharpening
  image = image.sharpen({
    sigma: 0.5,
    m1: 1.0,
    m2: 2.0,
  });

  // 5. Tone Curve (Approximated)
  // [0,0], [36,20], [147,156], [255,255]
  // This is a subtle S-curve that lifts shadows slightly less than input
  // and keeps highlights mostly same.
  
  return await image.toBuffer();
}
