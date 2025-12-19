import sharp from 'sharp';

/**
 * Applies the GreenHaus "Warm" brand aesthetic.
 * Creates a golden, warm tone similar to the designer's style.
 */
export async function applyWarmFilter(
  input: Buffer | string,
  strength: number = 0.6
): Promise<Buffer> {
  // Auto-orient based on EXIF to fix rotation
  let image = sharp(input).rotate();
  
  const s = Math.max(0, Math.min(strength, 1));
  // Warmth should be noticeable but safe (no "deep fried")
  const brightness = 1 + 0.08 * s; // 1.00 -> 1.08
  const saturation = 1 + 0.25 * s; // 1.00 -> 1.25

  image = image.modulate({ brightness, saturation });
  
  return await image.toBuffer();
}
