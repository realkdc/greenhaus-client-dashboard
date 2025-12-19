import sharp from 'sharp';

interface TextField {
  text: string;
  font: 'Civane Cond Demi' | 'Elaina Script';
  fontSize: number;
  color: string;
  x: number;
  y: number;
  maxWidth?: number;
}

/**
 * Adds text overlays to an image using Sharp and SVG.
 */
export async function addTextOverlay(
  imageBuffer: Buffer,
  textFields: TextField[]
): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || 1080;
  const height = metadata.height || 1080;

  // Create SVG overlay
  let svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
  
  // Note: For the fonts to work on the server, they must be installed on the system
  // or referenced correctly. Since we're in a serverless environment, this is tricky.
  // A better approach for server-side is often to use a library that can load font files directly,
  // or to do it all on the client.
  
  for (const field of textFields) {
    const fontFamily = field.font === 'Civane Cond Demi' ? 'Civane Cond Demi' : 'Elaina Script';
    
    // Simple text wrapping if maxWidth is provided
    const text = field.text;
    
    svgContent += `
      <text 
        x="${field.x}" 
        y="${field.y}" 
        font-family="${fontFamily}" 
        font-size="${field.fontSize}" 
        fill="${field.color}"
        text-anchor="middle"
      >${text}</text>
    `;
  }
  
  svgContent += `</svg>`;

  return await sharp(imageBuffer)
    .composite([{
      input: Buffer.from(svgContent),
      top: 0,
      left: 0
    }])
    .toBuffer();
}
