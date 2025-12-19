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
    if (!field.text || !field.text.trim()) continue; // Skip empty fields
    
    const fontFamily = field.font === 'Civane Cond Demi' ? 'Civane Cond Demi' : 'Elaina Script';
    const text = field.text;
    const maxWidth = field.maxWidth || width * 0.85; // Allow 85% of width for text
    const lineHeight = field.fontSize * 1.2;
    
    // Split by manual line breaks first
    const lines = text.split('\n');
    let currentY = field.y;
    
    lines.forEach((line, lineIdx) => {
      // Word wrap each line
      const words = line.split(' ');
      let currentLine = '';
      let currentLineY = currentY;
      
      words.forEach((word) => {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        // Estimate text width (rough approximation: 0.6 * fontSize * charCount)
        const estimatedWidth = testLine.length * field.fontSize * 0.6;
        
        if (estimatedWidth > maxWidth && currentLine) {
          // Draw current line with shadow effect and start new one
          const isPink = field.color.toLowerCase().includes('ff69b4') || field.color.toLowerCase().includes('ff1493') ||
                         (field.color.toLowerCase().includes('ff') && (field.color.toLowerCase().includes('b4') || field.color.toLowerCase().includes('93')));
          
          if (isPink) {
            // Darker pink shadow layer
            const shadowColor = field.color === '#FF69B4' || field.color.toLowerCase() === '#ff69b4' ? '#D81B60' : '#C2185B';
            svgContent += `
              <text 
                x="${field.x + 2}" 
                y="${currentLineY + 2}" 
                font-family="${fontFamily}" 
                font-size="${field.fontSize}" 
                fill="${shadowColor}"
                text-anchor="middle"
              >${currentLine.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>
            `;
            // Brighter pink top layer
            svgContent += `
              <text 
                x="${field.x}" 
                y="${currentLineY}" 
                font-family="${fontFamily}" 
                font-size="${field.fontSize}" 
                fill="${field.color}"
                text-anchor="middle"
              >${currentLine.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>
            `;
          } else {
            svgContent += `
              <text 
                x="${field.x}" 
                y="${currentLineY}" 
                font-family="${fontFamily}" 
                font-size="${field.fontSize}" 
                fill="${field.color}"
                stroke="rgba(0,0,0,0.3)"
                stroke-width="1"
                text-anchor="middle"
              >${currentLine.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>
            `;
          }
          currentLineY += lineHeight;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      });
      
      // Draw the last line of this paragraph
      if (currentLine) {
        // Check if color is pink - add double layer effect
        const isPink = field.color.toLowerCase().includes('ff69b4') || field.color.toLowerCase().includes('ff1493') ||
                       (field.color.toLowerCase().includes('ff') && (field.color.toLowerCase().includes('b4') || field.color.toLowerCase().includes('93')));
        
        if (isPink) {
          // Darker pink shadow layer (offset slightly)
          const shadowColor = field.color === '#FF69B4' || field.color.toLowerCase() === '#ff69b4' ? '#D81B60' : '#C2185B';
          svgContent += `
            <text 
              x="${field.x + 2}" 
              y="${currentLineY + 2}" 
              font-family="${fontFamily}" 
              font-size="${field.fontSize}" 
              fill="${shadowColor}"
              text-anchor="middle"
            >${currentLine.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>
          `;
          // Brighter pink top layer
          svgContent += `
            <text 
              x="${field.x}" 
              y="${currentLineY}" 
              font-family="${fontFamily}" 
              font-size="${field.fontSize}" 
              fill="${field.color}"
              text-anchor="middle"
            >${currentLine.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>
          `;
        } else {
          // Non-pink colors - add subtle shadow for readability
          svgContent += `
            <text 
              x="${field.x}" 
              y="${currentLineY}" 
              font-family="${fontFamily}" 
              font-size="${field.fontSize}" 
              fill="${field.color}"
              stroke="rgba(0,0,0,0.3)"
              stroke-width="1"
              text-anchor="middle"
            >${currentLine.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>
          `;
        }
        currentLineY += lineHeight;
      }
      
      // Add extra space between paragraphs (manual line breaks)
      if (lineIdx < lines.length - 1) {
        currentLineY += lineHeight * 0.5;
      }
      
      currentY = currentLineY;
    });
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
