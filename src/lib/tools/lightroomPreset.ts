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
  
  // 1. Basic adjustments (Approximated with modulations)
  // Temperature +15 and Tint +12: shift towards yellow and magenta
  // Sharp doesn't have direct temp/tint, but we can modulate colors
  image = image.recomb([
    [1.05, 0.02, 0.0], // R
    [0.0, 1.02, 0.0],  // G
    [0.0, 0.0, 0.95],  // B
  ]);

  // 2. Contrast and Brightness
  // Contrast -7, Blacks +2, Whites -15, Highlights -9
  // We'll use linear to adjust contrast and offset
  image = image.linear(0.93, 0.05); // slightly lower contrast

  // 3. Saturation and Vibrance (+5)
  image = image.modulate({
    saturation: 1.1, // slightly increased
    brightness: 1.02,
  });

  // 4. Clarity/Texture (Approximated with sharpening/blurring)
  // Sharpness is 0 in XMP, but Clarity is +10. We can use a subtle sharpen.
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
