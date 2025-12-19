import sharp from 'sharp';

/**
 * Applies the GreenHaus "Warm" brand aesthetic.
 * Creates a golden, warm tone similar to the designer's style.
 */
export async function applyWarmFilter(input: Buffer | string): Promise<Buffer> {
  // Auto-orient based on EXIF to fix rotation
  let image = sharp(input).rotate();
  
  // Apply the warm brand look:
  // 1. Slight warmth via modulate
  // 2. Gentle gamma adjustment for that golden glow
  image = image
    .modulate({
      brightness: 1.05,    // 5% brighter
      saturation: 1.15,    // 15% more saturated for rich colors
    })
    .gamma(1.1, 1.0)      // Boost reds/yellows slightly (warm shift)
    .toColourspace('srgb'); // Ensure consistent color space
  
  return await image.toBuffer();
}
