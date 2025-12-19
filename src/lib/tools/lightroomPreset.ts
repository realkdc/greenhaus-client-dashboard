import sharp from 'sharp';

/**
 * Applies the GreenHaus "Warm" brand aesthetic.
 * Creates a golden, warm tone similar to the designer's style.
 */
export async function applyWarmFilter(input: Buffer | string): Promise<Buffer> {
  // Auto-orient based on EXIF to fix rotation
  let image = sharp(input).rotate();
  
  // Apply the warm brand look with high quality processing
  image = image.modulate({
    brightness: 1.05,    // 5% brighter
    saturation: 1.15,    // 15% more saturated for rich colors
  });
  
  return await image.toBuffer();
}
