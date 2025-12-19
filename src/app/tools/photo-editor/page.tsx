"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import toast from "react-hot-toast";

const TEXTURES = [
  { id: "light-flare-1", name: "Light Flare 1", url: "/brand-assets/textures/Light%20Flare_1.png" },
  { id: "light-flare-2", name: "Light Flare 2", url: "/brand-assets/textures/Light%20Flare_2.png" },
  { id: "light-flare-3", name: "Light Flare 3", url: "/brand-assets/textures/Light%20Flare_3.png" },
  { id: "light-flare-4", name: "Light Flare 4", url: "/brand-assets/textures/Light%20Flare_4.png" },
  { id: "light-flare-5", name: "Light Flare 5", url: "/brand-assets/textures/Light%20Flare_5.png" },
  { id: "light-flare-6", name: "Light Flare 6", url: "/brand-assets/textures/Light%20Flare_6.png" },
  { id: "noise-1", name: "Grain 1", url: "/brand-assets/textures/Noise_1.png" },
  { id: "noise-2", name: "Grain 2", url: "/brand-assets/textures/Noise_2.png" },
];

const FONTS = [
  { id: "civane", name: "Civane Cond Demi", family: "Civane Cond Demi" },
  { id: "elaina", name: "Elaina Script", family: "Elaina Script" },
];

const ASPECT_RATIOS = [
  { id: "1:1", name: "Square (1:1)", width: 1080, height: 1080, description: "Instagram post" },
  { id: "4:5", name: "Portrait (4:5)", width: 1080, height: 1350, description: "Instagram post" },
  { id: "9:16", name: "Story (9:16)", width: 1080, height: 1920, description: "Instagram story" },
  { id: "4:3", name: "Landscape (4:3)", width: 1080, height: 810, description: "Instagram post" },
  { id: "original", name: "Keep Original", width: 0, height: 0, description: "Use photo's natural size" },
];

export default function PhotoEditorPage() {
  // Step State
  const [step, setStep] = useState(1); // 1: Edit, 2: Text
  
  // Image State
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string>("");
  const [editedUrl, setEditedUrl] = useState<string>("");
  const [finalUrl, setFinalUrl] = useState<string>("");
  
  // Settings State
  const [selectedTextures, setSelectedTextures] = useState<string[]>([]);
  const [applyWarm, setApplyWarm] = useState(true);
  const [aspectRatio, setAspectRatio] = useState("original");
  // Separate strength controls (0-100)
  const [warmthStrength, setWarmthStrength] = useState(60);
  const [flareStrength, setFlareStrength] = useState(70);
  const [grainStrength, setGrainStrength] = useState(25);
  
  // Text State
  const [headline, setHeadline] = useState("");
  const [details, setDetails] = useState("");
  const [cta, setCta] = useState("");
  const [headlineFont, setHeadlineFont] = useState(FONTS[0].family);
  const [detailsFont, setDetailsFont] = useState(FONTS[0].family);
  const [ctaFont, setCtaFont] = useState(FONTS[0].family);
  const [headlinePosition, setHeadlinePosition] = useState("center-top");
  const [detailsPosition, setDetailsPosition] = useState("center");
  const [ctaPosition, setCtaPosition] = useState("center-bottom");
  const [textColor, setTextColor] = useState("#FFFFFF");

  const TEXT_POSITIONS = [
    { id: "center-top", name: "Center Top" },
    { id: "center", name: "Center" },
    { id: "center-bottom", name: "Center Bottom" },
    { id: "left-top", name: "Left Top" },
    { id: "left-center", name: "Left Center" },
    { id: "left-bottom", name: "Left Bottom" },
    { id: "right-top", name: "Right Top" },
    { id: "right-center", name: "Right Center" },
    { id: "right-bottom", name: "Right Bottom" },
  ];

  // Helper to calculate position from position string
  // Returns position, alignment, and maxWidth that keeps text within bounds
  const getTextPosition = (position: string, canvasWidth: number, canvasHeight: number) => {
    const padding = canvasWidth * 0.05; // 5% padding from edges
    const maxContentWidth = canvasWidth - (padding * 2); // Available width after padding
    
    switch (position) {
      case "center-top":
        return { x: canvasWidth / 2, y: canvasHeight * 0.15, align: "center" as const, maxWidth: maxContentWidth };
      case "center":
        return { x: canvasWidth / 2, y: canvasHeight * 0.5, align: "center" as const, maxWidth: maxContentWidth };
      case "center-bottom":
        return { x: canvasWidth / 2, y: canvasHeight * 0.85, align: "center" as const, maxWidth: maxContentWidth };
      case "left-top":
        return { x: padding, y: canvasHeight * 0.15, align: "left" as const, maxWidth: canvasWidth * 0.4 }; // Max 40% width from left
      case "left-center":
        return { x: padding, y: canvasHeight * 0.5, align: "left" as const, maxWidth: canvasWidth * 0.4 };
      case "left-bottom":
        return { x: padding, y: canvasHeight * 0.85, align: "left" as const, maxWidth: canvasWidth * 0.4 };
      case "right-top":
        return { x: canvasWidth - padding, y: canvasHeight * 0.15, align: "right" as const, maxWidth: canvasWidth * 0.4 }; // Max 40% width from right
      case "right-center":
        return { x: canvasWidth - padding, y: canvasHeight * 0.5, align: "right" as const, maxWidth: canvasWidth * 0.4 };
      case "right-bottom":
        return { x: canvasWidth - padding, y: canvasHeight * 0.85, align: "right" as const, maxWidth: canvasWidth * 0.4 };
      default:
        return { x: canvasWidth / 2, y: canvasHeight * 0.5, align: "center" as const, maxWidth: maxContentWidth };
    }
  };
  
  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    setOriginalFile(file);
    setIsLoading(true);
    
    try {
      const newBlob = await upload(`photo-editor/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/tools/upload-token",
      });
      setOriginalUrl(newBlob.url);
      toast.success("Photo uploaded!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload photo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFileUpload(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0 && droppedFiles[0].type.startsWith("image/")) {
      await handleFileUpload(droppedFiles[0]);
    }
  };

  // Step 1: Generate Edit
  const handleGenerateEdit = async () => {
    if (!originalUrl) return;
    setIsLoading(true);
    
    try {
      const response = await fetch("/api/tools/edit-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: originalUrl,
          textureUrls: selectedTextures.map(id => TEXTURES.find(t => t.id === id)?.url),
          applyWarmFilter: applyWarm,
          aspectRatio: aspectRatio === "original" ? undefined : aspectRatio,
          warmStrength: warmthStrength / 100,
          flareStrength: flareStrength / 100,
          grainStrength: grainStrength / 100,
        }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      setEditedUrl(data.editedImageUrl);
      setStep(2);
      toast.success("Design applied! Now add some text.");
    } catch (err: any) {
      toast.error(err.message || "Failed to apply design");
    } finally {
      setIsLoading(false);
    }
  };

  // Real-time preview for Step 1 (effects preview)
  useEffect(() => {
    if (step === 1 && originalUrl && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = originalUrl;
      
      img.onload = async () => {
        // Keep canvas at a reasonable preview size (500px max)
        const maxDimension = 500;
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        // Draw base image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Apply warm filter - golden glow effect
        if (applyWarm) {
          const s = Math.max(0, Math.min(warmthStrength / 100, 1));
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            // Golden warm shift - boost reds/yellows, reduce blues slightly
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Increase brightness and warmth
            data[i] = Math.min(255, r * (1 + 0.12 * s));     // R boost
            data[i + 1] = Math.min(255, g * (1 + 0.05 * s)); // G slight boost
            data[i + 2] = Math.min(255, b * (1 - 0.08 * s)); // B reduce for warmth
            
            // Increase saturation slightly
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            const sat = 1 + 0.35 * s;
            data[i] = Math.min(255, avg + (data[i] - avg) * sat);
            data[i + 1] = Math.min(255, avg + (data[i + 1] - avg) * sat);
            data[i + 2] = Math.min(255, avg + (data[i + 2] - avg) * sat);
          }
          ctx.putImageData(imageData, 0, 0);
        }
        
        // Apply texture overlays if selected
        if (selectedTextures.length > 0) {
          const texturePromises = selectedTextures.map(textureId => {
            const texture = TEXTURES.find(t => t.id === textureId);
            if (!texture) return Promise.resolve();
            
            return new Promise<void>((resolve) => {
              const texImg = new Image();
              texImg.crossOrigin = "anonymous";
              texImg.src = texture.url;
              
              texImg.onload = () => {
                const isNoise = texture.id.startsWith("noise");
                const flareS = Math.max(0, Math.min(flareStrength / 100, 1));
                const grainS = Math.max(0, Math.min(grainStrength / 100, 1));
                // Light flares: screen, Grain: overlay (very subtle)
                ctx.globalCompositeOperation = isNoise ? "overlay" : "screen";
                // Grain can be turned up independently now
                ctx.globalAlpha = isNoise
                  ? (0.02 + 0.28 * grainS)   // 2% -> 30%
                  : (0.15 + 0.75 * flareS);  // 15% -> 90%
                ctx.drawImage(texImg, 0, 0, canvas.width, canvas.height);
                ctx.globalCompositeOperation = "source-over";
                ctx.globalAlpha = 1.0;
                resolve();
              };
              texImg.onerror = () => resolve();
            });
          });
          
          await Promise.all(texturePromises);
        }
      };
      
      img.onerror = () => {
        console.error("Failed to load image for preview");
      };
    }
  }, [step, originalUrl, applyWarm, selectedTextures, aspectRatio, warmthStrength, flareStrength, grainStrength]);

  // Step 2: Draw on Canvas for preview with text
  useEffect(() => {
    if (step === 2 && editedUrl && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = editedUrl;
      img.onload = () => {
        // Match canvas size to image aspect ratio (max 500px for clean preview)
        const maxDimension = 500;
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Helper function to draw text with double-layer effect (shadow + main)
        const drawTextWithShadow = (
          text: string,
          x: number,
          y: number,
          mainColor: string,
          fontSize: number,
          font: string,
          align: "left" | "center" | "right" = "center",
          isBold: boolean = false
        ) => {
          ctx.font = (isBold ? 'bold ' : '') + fontSize + `px "${font}"`;
          ctx.textAlign = align;
          ctx.textBaseline = "top";
          
          // Check if text color is pink - if so, add shadow effect
          const isPink = mainColor.toLowerCase().includes('ff69b4') || mainColor.toLowerCase().includes('ff1493') || 
                         mainColor.toLowerCase().includes('ff') && (mainColor.toLowerCase().includes('b4') || mainColor.toLowerCase().includes('93'));
          
          if (isPink) {
            // Darker pink shadow (offset slightly down and right)
            const shadowColor = mainColor === '#FF69B4' || mainColor.toLowerCase() === '#ff69b4' ? '#D81B60' : '#C2185B';
            ctx.fillStyle = shadowColor;
            ctx.fillText(text, x + 2, y + 2); // Offset shadow
            // Main brighter pink on top
            ctx.fillStyle = mainColor;
            ctx.fillText(text, x, y);
          } else {
            // For non-pink colors, add subtle shadow for readability
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            ctx.fillStyle = mainColor;
            ctx.fillText(text, x, y);
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
          }
        };
        
        // Helper function to wrap text and handle line breaks, returns final Y position
        const drawMultilineText = (
          text: string,
          x: number,
          y: number,
          maxWidth: number,
          fontSize: number,
          font: string,
          align: "left" | "center" | "right" = "center",
          isBold: boolean = false,
          lineHeight: number = 1.2
        ): number => {
          ctx.textAlign = align;
          ctx.textBaseline = "top";
          
          // Split by line breaks first (manual breaks)
          const lines = text.split('\n');
          let currentY = y;
          
          lines.forEach((line, lineIdx) => {
            // Wrap each line if it's too long
            const words = line.split(' ');
            let currentLine = '';
            
            words.forEach(word => {
              const testLine = currentLine + (currentLine ? ' ' : '') + word;
              ctx.font = (isBold ? 'bold ' : '') + fontSize + `px "${font}"`;
              const metrics = ctx.measureText(testLine);
              
              if (metrics.width > maxWidth && currentLine) {
                // Draw current line with shadow effect and start new one
                drawTextWithShadow(currentLine, x, currentY, textColor, fontSize, font, align, isBold);
                currentY += fontSize * lineHeight;
                currentLine = word;
              } else {
                currentLine = testLine;
              }
            });
            
            // Draw the last line with shadow effect
            if (currentLine) {
              drawTextWithShadow(currentLine, x, currentY, textColor, fontSize, font, align, isBold);
              currentY += fontSize * lineHeight;
            }
            
            // Add extra space between manual line breaks (paragraphs)
            if (lineIdx < lines.length - 1) {
              currentY += fontSize * 0.3;
            }
          });
          
          return currentY;
        };
        
        ctx.fillStyle = textColor;
        
        // Headline with wrapping (bold) - only if has content
        if (headline.trim()) {
          const headlineFontSize = Math.round(canvas.width * 0.08);
          const headlinePos = getTextPosition(headlinePosition, canvas.width, canvas.height);
          drawMultilineText(
            headline, 
            headlinePos.x, 
            headlinePos.y, 
            headlinePos.maxWidth, 
            headlineFontSize, 
            headlineFont,
            headlinePos.align,
            true
          );
        }
        
        // Details with wrapping - only if has content
        if (details.trim()) {
          const detailsFontSize = Math.round(canvas.width * 0.04);
          const detailsPos = getTextPosition(detailsPosition, canvas.width, canvas.height);
          drawMultilineText(
            details, 
            detailsPos.x, 
            detailsPos.y, 
            detailsPos.maxWidth, 
            detailsFontSize, 
            detailsFont,
            detailsPos.align,
            false
          );
        }
        
        // CTA with wrapping (bold) - only if has content
        if (cta.trim()) {
          const ctaFontSize = Math.round(canvas.width * 0.05);
          const ctaPos = getTextPosition(ctaPosition, canvas.width, canvas.height);
          drawMultilineText(
            cta, 
            ctaPos.x, 
            ctaPos.y, 
            ctaPos.maxWidth, 
            ctaFontSize, 
            ctaFont,
            ctaPos.align,
            true
          );
        }
      };
    }
  }, [step, editedUrl, headline, details, cta, headlineFont, detailsFont, ctaFont, headlinePosition, detailsPosition, ctaPosition, textColor]);

  // Step 2: Export Final (using client-side canvas for proper font rendering)
  const handleExport = async () => {
    if (!editedUrl) return;
    setIsLoading(true);
    
    try {
      // Load the edited image
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = editedUrl;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      
      // Create high-res canvas
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = img.width;
      exportCanvas.height = img.height;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');
      
      // Draw the edited image (with aesthetics already applied)
      ctx.drawImage(img, 0, 0);
      
      // Helper to draw text with shadow (same as preview)
      const drawTextWithShadow = (
        text: string,
        x: number,
        y: number,
        mainColor: string,
        fontSize: number,
        font: string,
        align: "left" | "center" | "right" = "center",
        isBold: boolean = false
      ) => {
        ctx.font = (isBold ? 'bold ' : '') + fontSize + `px "${font}"`;
        ctx.textAlign = align;
        ctx.textBaseline = "top";
        
        const isPink = mainColor.toLowerCase().includes('ff69b4') || mainColor.toLowerCase().includes('ff1493') || 
                       mainColor.toLowerCase().includes('ff') && (mainColor.toLowerCase().includes('b4') || mainColor.toLowerCase().includes('93'));
        
        // Adjust shadow offset based on alignment
        const shadowOffsetX = align === 'left' ? 2 : align === 'right' ? -2 : 3;
        
        if (isPink) {
          // Darker pink shadow (offset slightly down and right/left based on alignment)
          const shadowColor = mainColor === '#FF69B4' || mainColor.toLowerCase() === '#ff69b4' ? '#D81B60' : '#C2185B';
          ctx.fillStyle = shadowColor;
          ctx.fillText(text, x + shadowOffsetX, y + 3); // Offset shadow
          // Main brighter pink on top
          ctx.fillStyle = mainColor;
          ctx.fillText(text, x, y);
        } else {
          // For non-pink colors, add subtle shadow for readability
          ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = shadowOffsetX;
          ctx.shadowOffsetY = 2;
          ctx.fillStyle = mainColor;
          ctx.fillText(text, x, y);
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }
      };
      
      // Helper to draw multiline text
      const drawMultilineTextExport = (
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        fontSize: number,
        font: string,
        align: "left" | "center" | "right" = "center",
        isBold: boolean = false,
        lineHeight: number = 1.2
      ): number => {
        ctx.textAlign = align;
        ctx.textBaseline = "top";
        
        const lines = text.split('\n');
        let currentY = y;
        
        lines.forEach((line, lineIdx) => {
          const words = line.split(' ');
          let currentLine = '';
          
          words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            ctx.font = (isBold ? 'bold ' : '') + fontSize + `px "${font}"`;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && currentLine) {
              drawTextWithShadow(currentLine, x, currentY, textColor, fontSize, font, align, isBold);
              currentY += fontSize * lineHeight;
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          });
          
          if (currentLine) {
            drawTextWithShadow(currentLine, x, currentY, textColor, fontSize, font, align, isBold);
            currentY += fontSize * lineHeight;
          }
          
          if (lineIdx < lines.length - 1) {
            currentY += fontSize * 0.3;
          }
        });
        
        return currentY;
      };
      
      // Draw all text fields
      if (headline.trim()) {
        const headlineFontSize = Math.round(exportCanvas.width * 0.08);
        const headlinePos = getTextPosition(headlinePosition, exportCanvas.width, exportCanvas.height);
        drawMultilineTextExport(
          headline,
          headlinePos.x,
          headlinePos.y,
          headlinePos.maxWidth,
          headlineFontSize,
          headlineFont,
          headlinePos.align,
          true
        );
      }
      
      if (details.trim()) {
        const detailsFontSize = Math.round(exportCanvas.width * 0.04);
        const detailsPos = getTextPosition(detailsPosition, exportCanvas.width, exportCanvas.height);
        drawMultilineTextExport(
          details,
          detailsPos.x,
          detailsPos.y,
          detailsPos.maxWidth,
          detailsFontSize,
          detailsFont,
          detailsPos.align,
          false
        );
      }
      
      if (cta.trim()) {
        const ctaFontSize = Math.round(exportCanvas.width * 0.05);
        const ctaPos = getTextPosition(ctaPosition, exportCanvas.width, exportCanvas.height);
        drawMultilineTextExport(
          cta,
          ctaPos.x,
          ctaPos.y,
          ctaPos.maxWidth,
          ctaFontSize,
          ctaFont,
          ctaPos.align,
          true
        );
      }
      
      // Convert canvas to blob and download at maximum quality
      exportCanvas.toBlob((blob) => {
        if (!blob) {
          toast.error("Failed to create image");
          return;
        }
        
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        // PNG export = lossless (keeps it crisp / HQ)
        link.download = `greenhaus-post-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
        
        toast.success("Downloaded successfully!");
      }, 'image/png'); // lossless
      
    } catch (err: any) {
      console.error('Export error:', err);
      toast.error(err.message || "Failed to export");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="min-h-full px-6 py-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link href="/tools" className="text-sm text-slate-600 hover:text-accent flex items-center gap-1">
              ← Back to Tools
            </Link>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Brand Photo Editor</h1>
            <p className="text-slate-600">Create beautiful posts in seconds!</p>
          </div>
          
          <div className="flex gap-2">
            {[1, 2].map(s => (
              <div 
                key={s}
                className={`h-3 w-12 rounded-full ${step >= s ? 'bg-accent' : 'bg-slate-200'}`}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Main Workspace */}
          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm min-h-[400px] flex items-center justify-center relative">
              {isLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent"></div>
                    <p className="font-medium text-slate-900">Working our magic...</p>
                  </div>
                </div>
              )}

              {step === 1 ? (
                originalUrl ? (
                  <div className="p-4 w-full">
                    <canvas ref={canvasRef} className="mx-auto max-w-full max-h-[500px] rounded-lg shadow-md bg-white" />
                    <button 
                      onClick={() => {
                        setOriginalUrl("");
                        setSelectedTextures([]);
                        setApplyWarm(true);
                      }}
                      className="mt-4 mx-auto block text-sm text-red-600 font-medium"
                    >
                      Remove and try another
                    </button>
                  </div>
                ) : (
                  <label 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`flex h-full w-full cursor-pointer flex-col items-center justify-center p-12 text-center transition ${
                      isDragging ? "bg-accent/10 border-2 border-accent border-dashed" : "hover:bg-slate-100"
                    }`}
                  >
                    <div className="rounded-full bg-accent/10 p-4 text-accent">
                      <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="mt-4 text-xl font-bold text-slate-900">
                      {isDragging ? "Drop your photo here" : "Click to add your photo"}
                    </h3>
                    <p className="mt-1 text-slate-600">
                      {isDragging ? "Release to upload" : "Or drag and drop any photo here"}
                    </p>
                    <input type="file" className="sr-only" onChange={handleFileChange} accept="image/*" />
                  </label>
                )
              ) : (
                <div className="p-4 w-full">
                  <canvas ref={canvasRef} className="mx-auto max-w-full rounded-lg shadow-xl bg-white" />
                  <p className="mt-4 text-center text-xs text-slate-500">Preview (Final export will be higher quality)</p>
                </div>
              )}
            </div>
          </div>

          {/* Controls Sidebar */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              {step === 1 ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">1. Choose Styles</h3>
                    <p className="text-sm text-slate-600">Pick the cool effects you want to add.</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <span className="mb-2 block text-sm font-bold text-slate-900">Post Size</span>
                      <select 
                        value={aspectRatio} 
                        onChange={(e) => setAspectRatio(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:ring-accent"
                      >
                        {ASPECT_RATIOS.map(ar => (
                          <option key={ar.id} value={ar.id}>{ar.name} - {ar.description}</option>
                        ))}
                      </select>
                    </div>

                    <label className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 transition hover:border-accent cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={applyWarm} 
                        onChange={(e) => setApplyWarm(e.target.checked)}
                        className="h-5 w-5 rounded border-slate-300 text-accent focus:ring-accent"
                      />
                      <div>
                        <span className="block font-bold text-slate-900">Warm Haus Filter</span>
                        <span className="text-xs text-slate-500">Makes everything look cozy and bright.</span>
                      </div>
                    </label>

                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900">Warmth</span>
                        <span className="text-xs font-medium text-slate-600">{warmthStrength}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={warmthStrength}
                        onChange={(e) => setWarmthStrength(parseInt(e.target.value, 10))}
                        className="mt-2 w-full"
                      />
                      <p className="mt-1 text-xs text-slate-500">Controls the warm filter only.</p>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900">Flares</span>
                        <span className="text-xs font-medium text-slate-600">{flareStrength}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={flareStrength}
                        onChange={(e) => setFlareStrength(parseInt(e.target.value, 10))}
                        className="mt-2 w-full"
                      />
                      <p className="mt-1 text-xs text-slate-500">Controls Light Flare strength.</p>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900">Grain</span>
                        <span className="text-xs font-medium text-slate-600">{grainStrength}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={grainStrength}
                        onChange={(e) => setGrainStrength(parseInt(e.target.value, 10))}
                        className="mt-2 w-full"
                      />
                      <p className="mt-1 text-xs text-slate-500">Controls Grain overlays (can be strong).</p>
                    </div>

                    <div>
                      <span className="mb-2 block text-sm font-bold text-slate-900">Texture Overlays</span>
                      <div className="grid grid-cols-4 gap-3">
                        {TEXTURES.map(tex => (
                          <div key={tex.id} className="flex flex-col">
                            <button
                              onClick={() => {
                                setSelectedTextures(prev => 
                                  prev.includes(tex.id) 
                                    ? prev.filter(id => id !== tex.id)
                                    : [...prev, tex.id]
                                );
                              }}
                              className={`relative aspect-square overflow-hidden rounded-lg border-2 transition ${
                                selectedTextures.includes(tex.id) ? 'border-accent shadow-md' : 'border-slate-200 grayscale hover:grayscale-0'
                              }`}
                            >
                              <img src={tex.url} alt={tex.name} className="h-full w-full object-cover" />
                              {selectedTextures.includes(tex.id) && (
                                <div className="absolute inset-0 flex items-center justify-center bg-accent/20">
                                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </button>
                            <span className="mt-1.5 text-center text-xs font-medium text-slate-600">{tex.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateEdit}
                    disabled={!originalUrl || isLoading}
                    className="w-full rounded-xl bg-accent py-4 text-lg font-bold text-white shadow-lg transition hover:scale-[1.02] hover:bg-accent/90 disabled:bg-slate-300 disabled:scale-100"
                  >
                    Next Step →
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-slate-900">2. Add Your Message</h3>
                      <button onClick={() => setStep(1)} className="text-xs text-accent font-bold">← Change Styles</button>
                    </div>
                    <p className="text-sm text-slate-600">Type what you want the post to say.</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Headline (Optional)</label>
                      <textarea 
                        rows={2}
                        value={headline} 
                        onChange={(e) => setHeadline(e.target.value)}
                        placeholder="Leave empty to hide..."
                        className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-accent focus:ring-accent resize-y"
                      />
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <select 
                          value={headlineFont} 
                          onChange={(e) => setHeadlineFont(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                        >
                          {FONTS.map(f => (
                            <option key={f.id} value={f.family}>{f.name}</option>
                          ))}
                        </select>
                        <select 
                          value={headlinePosition} 
                          onChange={(e) => setHeadlinePosition(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                        >
                          {TEXT_POSITIONS.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Details (Optional)</label>
                      <textarea 
                        rows={2}
                        value={details} 
                        onChange={(e) => setDetails(e.target.value)}
                        placeholder="Leave empty to hide..."
                        className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-accent focus:ring-accent resize-y"
                      />
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <select 
                          value={detailsFont} 
                          onChange={(e) => setDetailsFont(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                        >
                          {FONTS.map(f => (
                            <option key={f.id} value={f.family}>{f.name}</option>
                          ))}
                        </select>
                        <select 
                          value={detailsPosition} 
                          onChange={(e) => setDetailsPosition(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                        >
                          {TEXT_POSITIONS.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Call to Action (Optional)</label>
                      <textarea 
                        rows={2}
                        value={cta} 
                        onChange={(e) => setCta(e.target.value)}
                        placeholder="Leave empty to hide..."
                        className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-accent focus:ring-accent resize-y"
                      />
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <select 
                          value={ctaFont} 
                          onChange={(e) => setCtaFont(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                        >
                          {FONTS.map(f => (
                            <option key={f.id} value={f.family}>{f.name}</option>
                          ))}
                        </select>
                        <select 
                          value={ctaPosition} 
                          onChange={(e) => setCtaPosition(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                        >
                          {TEXT_POSITIONS.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Text Color</label>
                      <div className="flex flex-wrap gap-2">
                        {['#FFFFFF', '#000000', '#73A633', '#FFD700', '#FF69B4', '#FF1493'].map(c => (
                          <button 
                            key={c}
                            onClick={() => setTextColor(c)}
                            className={`h-10 w-10 rounded-full border-2 transition ${textColor === c ? 'border-accent ring-2 ring-accent/20 scale-110' : 'border-white shadow-sm hover:scale-105'}`}
                            style={{ backgroundColor: c }}
                            title={c === '#FF69B4' || c === '#FF1493' ? 'Pink' : c === '#FFFFFF' ? 'White' : c === '#000000' ? 'Black' : c === '#73A633' ? 'Green' : c === '#FFD700' ? 'Yellow' : c}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleExport}
                    disabled={isLoading}
                    className="w-full rounded-xl bg-green-600 py-4 text-lg font-bold text-white shadow-lg transition hover:scale-[1.02] hover:bg-green-700"
                  >
                    Save & Download! ✨
                  </button>
                </div>
              )}
            </div>
            
            <div className="mt-6 rounded-2xl bg-[#73A63310] p-6 text-sm text-slate-700 border border-[#73A63320]">
              <p className="font-bold text-[#73A633] mb-1">Pro Tip! 💡</p>
              {step === 1 ? "Pick a noise texture to make your photo look like a vintage film camera!" : "Try using the 'Elaina Script' font for a more personal, hand-written look."}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
