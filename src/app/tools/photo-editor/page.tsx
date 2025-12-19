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
  
  // Text State
  const [headline, setHeadline] = useState("Your Headline Here");
  const [details, setDetails] = useState("Enter your details");
  const [cta, setCta] = useState("Shop Now");
  const [selectedFont, setSelectedFont] = useState(FONTS[0].family);
  const [textColor, setTextColor] = useState("#FFFFFF");
  
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
        const maxWidth = 800;
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        // Draw base image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Apply warm filter effect (simplified client-side version)
        if (applyWarm) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            // Increase red/orange tones (warm effect)
            data[i] = Math.min(255, data[i] * 1.05);     // R
            data[i + 1] = Math.min(255, data[i + 1] * 1.02); // G
            data[i + 2] = Math.min(255, data[i + 2] * 0.95); // B
          }
          ctx.putImageData(imageData, 0, 0);
        }
        
        // Apply texture overlays
        const texturePromises = selectedTextures.map(textureId => {
          const texture = TEXTURES.find(t => t.id === textureId);
          if (!texture) return Promise.resolve();
          
          return new Promise<void>((resolve) => {
            const texImg = new Image();
            texImg.crossOrigin = "anonymous";
            texImg.src = texture.url;
            
            texImg.onload = () => {
              // Blend texture with screen mode
              ctx.globalCompositeOperation = "screen";
              ctx.globalAlpha = 0.6;
              ctx.drawImage(texImg, 0, 0, canvas.width, canvas.height);
              ctx.globalCompositeOperation = "source-over";
              ctx.globalAlpha = 1.0;
              resolve();
            };
            texImg.onerror = () => {
              console.warn(`Failed to load texture: ${texture.url}`);
              resolve();
            };
          });
        });
        
        await Promise.all(texturePromises);
      };
      
      img.onerror = () => {
        console.error("Failed to load image for preview");
      };
    }
  }, [step, originalUrl, applyWarm, selectedTextures]);

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
        // Match canvas size to image aspect ratio (max 800px)
        const maxWidth = 800;
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Draw Text
        ctx.fillStyle = textColor;
        ctx.textAlign = "center";
        
        // Headline
        ctx.font = `bold ${Math.round(canvas.width * 0.08)}px "${selectedFont}"`;
        ctx.fillText(headline, canvas.width / 2, canvas.height * 0.4);
        
        // Details
        ctx.font = `${Math.round(canvas.width * 0.04)}px "${selectedFont}"`;
        ctx.fillText(details, canvas.width / 2, canvas.height * 0.5);
        
        // CTA
        ctx.font = `bold ${Math.round(canvas.width * 0.05)}px "${selectedFont}"`;
        ctx.fillText(cta, canvas.width / 2, canvas.height * 0.7);
      };
    }
  }, [step, editedUrl, headline, details, cta, selectedFont, textColor]);

  // Step 2: Export Final
  const handleExport = async () => {
    if (!editedUrl) return;
    setIsLoading(true);
    
    try {
      // For high quality, we'll use the API
      const response = await fetch("/api/tools/add-text-overlay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: editedUrl,
          textFields: [
            { text: headline, font: selectedFont, fontSize: 80, color: textColor, x: 540, y: 400 },
            { text: details, font: selectedFont, fontSize: 40, color: textColor, x: 540, y: 550 },
            { text: cta, font: selectedFont, fontSize: 50, color: textColor, x: 540, y: 750 },
          ],
        }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      setFinalUrl(data.finalImageUrl);
      toast.success("Ready to download!");
      
      // Auto-download
      const link = document.createElement('a');
      link.href = data.finalImageUrl;
      link.download = `greenhaus-post-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (err: any) {
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
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Headline</label>
                      <input 
                        type="text" 
                        value={headline} 
                        onChange={(e) => setHeadline(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-accent focus:ring-accent"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Details</label>
                      <textarea 
                        rows={2}
                        value={details} 
                        onChange={(e) => setDetails(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-accent focus:ring-accent"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Call to Action</label>
                      <input 
                        type="text" 
                        value={cta} 
                        onChange={(e) => setCta(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-accent focus:ring-accent"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Font Style</label>
                        <select 
                          value={selectedFont} 
                          onChange={(e) => setSelectedFont(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                        >
                          {FONTS.map(f => (
                            <option key={f.id} value={f.family}>{f.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Text Color</label>
                        <div className="mt-1 flex gap-2">
                          {['#FFFFFF', '#000000', '#73A633', '#FFD700'].map(c => (
                            <button 
                              key={c}
                              onClick={() => setTextColor(c)}
                              className={`h-8 w-8 rounded-full border-2 ${textColor === c ? 'border-accent ring-2 ring-accent/20' : 'border-white shadow-sm'}`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
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
