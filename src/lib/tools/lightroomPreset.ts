import sharp from 'sharp';

/**
 * Applies a subtle "Warm" filter to the image.
 * Kept VERY simple to avoid color distortion issues.
 */
export async function applyWarmFilter(input: Buffer | string): Promise<Buffer> {
  // Auto-orient based on EXIF to fix rotation
  let image = sharp(input).rotate();
  
  // ONLY use modulate - it's the safest operation in Sharp
  // Very subtle adjustments to avoid any color distortion
  image = image.modulate({
    brightness: 1.02,    // 2% brighter
    saturation: 1.08,    // 8% more saturated
  });
  
  return await image.toBuffer();
}
