"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { upload } from '@vercel/blob/client';
import toast from "react-hot-toast";

export default function CaptionGeneratorPage(): JSX.Element {
  const [files, setFiles] = useState<FileList | null>(null);
  const [googleDriveLinks, setGoogleDriveLinks] = useState("");
  const [contentName, setContentName] = useState("");
  const [contentType, setContentType] = useState("Single Post");
  const [platform, setPlatform] = useState("Instagram");
  const [generatedCaption, setGeneratedCaption] = useState("");
  const [imageAnalysis, setImageAnalysis] = useState<string | undefined>(undefined);
  const [videoAnalyses, setVideoAnalyses] = useState<Array<{ fileName: string; analysis: string; source: string }>>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [usageWarning, setUsageWarning] = useState("");
  const [usageInfo, setUsageInfo] = useState<{
    percentUsed: number;
    remainingCost: string;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [progressLog, setProgressLog] = useState<Array<{ message: string; timestamp: Date; type: 'info' | 'success' | 'error' | 'warning' }>>([]);
  const progressLogRef = useRef<HTMLDivElement>(null);

  // Auto-scroll progress log to bottom when new entries are added
  useEffect(() => {
    if (progressLogRef.current) {
      progressLogRef.current.scrollTop = progressLogRef.current.scrollHeight;
    }
  }, [progressLog]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // Append new files to existing files instead of replacing
      if (files && files.length > 0) {
        const newFiles = Array.from(e.target.files);
        const existingFiles = Array.from(files);
        const combined = [...existingFiles, ...newFiles];

        // Convert back to FileList-like object
        const dataTransfer = new DataTransfer();
        combined.forEach(file => dataTransfer.items.add(file));
        setFiles(dataTransfer.files);
      } else {
        setFiles(e.target.files);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      // Append dropped files to existing files instead of replacing
      if (files && files.length > 0) {
        const newFiles = Array.from(droppedFiles);
        const existingFiles = Array.from(files);
        const combined = [...existingFiles, ...newFiles];

        // Convert back to FileList-like object
        const dataTransfer = new DataTransfer();
        combined.forEach(file => dataTransfer.items.add(file));
        setFiles(dataTransfer.files);
      } else {
        setFiles(droppedFiles);
      }
    }
  };

  const addProgressLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setProgressLog(prev => [...prev, { message, timestamp: new Date(), type }]);
  };

  const handleGenerateCaption = async () => {
    setIsGenerating(true);
    setError("");
    setGeneratedCaption("");
    setUploadProgress(0);
    setProgressLog([]);
    addProgressLog("Starting caption generation...", "info");

    try {
      const imageUrls: string[] = [];

      // Upload files to Vercel Blob (Client-Side Upload - bypasses payload limit)
      if (files && files.length > 0) {
        const imageFiles = Array.from(files).filter(
          (file) => file.type.startsWith("image/") || file.type.startsWith("video/")
        );

        if (imageFiles.length > 0) {
          addProgressLog(`Uploading ${imageFiles.length} file(s) to storage...`, "info");
          const totalFiles = imageFiles.length;
          let processedFiles = 0;

          // Client-side direct upload to Vercel Blob - bypasses ALL payload limits
          // Files upload directly from browser to Blob storage, no serverless function involved
          for (const file of imageFiles) {
            try {
              setUploadProgress(Math.round((processedFiles / totalFiles) * 50));
              addProgressLog(`Uploading ${file.name}...`, "info");
              
              // Use consistent filename - overwrite is handled server-side in token generation
              const fileName = `caption-images/${file.name}`;
              
              // Direct upload from browser to Vercel Blob - no size limits!
              const newBlob = await upload(fileName, file, {
                access: 'public',
                handleUploadUrl: '/api/tools/upload-token',
                // allowOverwrite is set server-side in the token generation
              });

              imageUrls.push(newBlob.url);
              processedFiles++;
              setUploadProgress(Math.round((processedFiles / totalFiles) * 90));
              addProgressLog(`✓ Uploaded ${file.name}`, "success");
            } catch (uploadError: any) {
              console.error("Error uploading file:", uploadError);
              addProgressLog(`✗ Failed to upload ${file.name}: ${uploadError?.message || 'Unknown error'}`, "error");
              
              // Check if it's a token error
              if (uploadError?.message?.includes('token') || uploadError?.message?.includes('BLOB_READ_WRITE_TOKEN')) {
                throw new Error(
                  'Blob storage is not configured. Please set BLOB_READ_WRITE_TOKEN in Vercel project settings under Environment Variables.'
                );
              }
              
              throw new Error(`Failed to upload ${file.name}: ${uploadError?.message || 'Unknown error'}`);
            }
          }
          
          setUploadProgress(100);
          addProgressLog(`✓ All files uploaded successfully`, "success");
        }
      }

      // Process Google Drive links
      if (googleDriveLinks.trim()) {
        const links = googleDriveLinks.trim().split(/[\n,]/).filter(l => l.trim());
        if (links.length > 0) {
          addProgressLog(`Processing ${links.length} Google Drive link(s)...`, "info");
        }
      }

      addProgressLog("Sending request to caption generator...", "info");
      const response = await fetch("/api/tools/generate-caption", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrls,
          googleDriveLinks: googleDriveLinks.trim(),
          contentName: contentName.trim(),
          contentType,
          platform,
        }),
      });

      // Check if response is JSON before parsing
      const responseContentType = response.headers.get("content-type");
      if (!responseContentType || !responseContentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        addProgressLog("✗ Server returned invalid response", "error");
        throw new Error("Server error. Please try again later.");
      }

      addProgressLog("Processing response...", "info");
      const data = await response.json();

      if (!response.ok) {
        addProgressLog(`✗ ${data.error || "Failed to generate caption"}`, "error");
        throw new Error(data.error || "Failed to generate caption");
      }

      // Check for video analyses
      if (data.videoAnalyses && data.videoAnalyses.length > 0) {
        addProgressLog(`✓ Analyzed ${data.videoAnalyses.length} video(s) with Gemini`, "success");
        data.videoAnalyses.forEach((analysis: any) => {
          addProgressLog(`  → ${analysis.fileName} (${analysis.source})`, "info");
        });
      }

      addProgressLog("✓ Caption generated successfully!", "success");
      // Handle 21+ placement: Ensure it's after caption text and before hashtags
      let finalCaption = (data.caption || "").trim();
      
      // Look for hashtags at the end
      const hashtagRegex = /(#\w+\s*)+$/;
      const hashtagsMatch = finalCaption.match(hashtagRegex);
      
      if (hashtagsMatch) {
        const hashtags = hashtagsMatch[0].trim();
        let captionBody = finalCaption.replace(hashtagRegex, "").trim();
        
        // Remove 21+ if it exists anywhere to reposition it
        captionBody = captionBody.replace(/21\+/g, "").trim();
        const cleanedHashtags = hashtags.replace(/21\+/g, "").trim();
        
        // Final structure: [Body] 21+\n\n[Hashtags]
        finalCaption = `${captionBody} 21+\n\n${cleanedHashtags}`;
      } else {
        // No hashtags, just ensure 21+ is at the end of the body
        const captionBody = finalCaption.replace(/21\+/g, "").trim();
        finalCaption = `${captionBody} 21+`;
      }

      setGeneratedCaption(finalCaption);
      setImageAnalysis(data.imageAnalysis);
      setVideoAnalyses(data.videoAnalyses || []);

      // Log analyses for debugging
      if (data.imageAnalysis) {
        console.log('[Frontend] Received image analysis from Gemini');
      }
      if (data.videoAnalyses && data.videoAnalyses.length > 0) {
        console.log('[Frontend] Received video analyses from Gemini:', data.videoAnalyses);
      }

      // Clear form fields after successful generation for easy reuse
      setFiles(null);
      setGoogleDriveLinks("");
      setContentName("");
      
      // Reset file input element
      const fileInput = document.getElementById("file-upload") as HTMLInputElement;
      if (fileInput) {
        fileInput.value = "";
      }

      // Handle usage warnings
      if (data.usageWarning) {
        setUsageWarning(data.usageWarning);
        addProgressLog(`⚠ ${data.usageWarning}`, "warning");
      }

      if (data.usageInfo) {
        setUsageInfo(data.usageInfo);
      }
    } catch (err) {
      console.error("Error generating caption:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to generate caption";
      addProgressLog(`✗ ${errorMessage}`, "error");
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
      setUploadProgress(0);
    }
  };

  const handleRegenerateCaption = () => {
    handleGenerateCaption();
  };

  const canGenerate =
    (files && files.length > 0) ||
    googleDriveLinks.trim() !== "" ||
    contentName.trim() !== "";

  return (
    <section className="min-h-full px-6 py-8">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/tools"
              className="inline-flex items-center text-sm text-slate-600 hover:text-accent"
            >
              <svg
                className="mr-1 h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Tools
            </Link>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              Caption Generator
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
              AI Caption Generator
            </h1>
            <p className="mt-2 text-slate-600">
              Upload your content and let AI create on-brand Instagram captions for
              GreenHaus.
            </p>
          </div>

          {/* Main Form */}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="space-y-6">
              {/* File Upload Section */}
              <div>
                <label
                  htmlFor="file-upload"
                  className="block text-sm font-semibold text-slate-900"
                >
                  Upload Content
                </label>
                <p className="mt-1 text-xs text-slate-500">
                  Upload photos, videos, screenshots, or carousel images (multiple files
                  supported)
                </p>
                <div className="mt-3">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 transition ${
                      isDragging
                        ? "border-accent bg-accent/10"
                        : "border-slate-300 bg-slate-50 hover:border-accent hover:bg-accent/5"
                    }`}
                  >
                  <label
                    htmlFor="file-upload"
                    className="flex w-full cursor-pointer items-center justify-center"
                  >
                    <div className="text-center">
                      <svg
                        className="mx-auto h-12 w-12 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      <p className="mt-2 text-sm font-medium text-slate-600">
                        Click to upload or drag and drop
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        PNG, JPG, GIF, MP4, MOV up to 50MB each
                      </p>
                    </div>
                    <input
                      id="file-upload"
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </label>
                  </div>
                  {files && files.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-700">
                          {files.length} file{files.length > 1 ? 's' : ''} selected
                        </span>
                        <button
                          type="button"
                          onClick={() => setFiles(null)}
                          className="text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="space-y-2">
                        {Array.from(files).map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2"
                          >
                            <div className="flex items-center gap-3">
                              <svg
                                className="h-5 w-5 text-accent"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              <span className="text-sm font-medium text-slate-700">
                                {file.name}
                              </span>
                            </div>
                            <span className="text-xs text-slate-500">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-slate-500">OR</span>
                </div>
              </div>

              {/* Google Drive Links */}
              <div>
                <label
                  htmlFor="google-drive"
                  className="block text-sm font-semibold text-slate-900"
                >
                  Google Drive Links
                </label>
                <p className="mt-1 text-xs text-slate-500">
                  Paste Google Drive link(s) to content (separate multiple links with
                  commas or new lines)
                </p>
                <textarea
                  id="google-drive"
                  rows={3}
                  value={googleDriveLinks}
                  onChange={(e) => setGoogleDriveLinks(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>

              {/* Content Type & Platform Selection */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="content-type"
                    className="block text-sm font-semibold text-slate-900"
                  >
                    Content Type
                  </label>
                  <p className="mt-1 text-xs text-slate-500">
                    Select the type of content you're creating
                  </p>
                  <select
                    id="content-type"
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value)}
                    className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="Single Post">Single Post</option>
                    <option value="Carousel">Carousel (2-10 slides)</option>
                    <option value="Reel">Reel / Video</option>
                    <option value="Story">Story</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="platform"
                    className="block text-sm font-semibold text-slate-900"
                  >
                    Platform
                  </label>
                  <p className="mt-1 text-xs text-slate-500">
                    Where will this be posted?
                  </p>
                  <select
                    id="platform"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Twitter">Twitter / X</option>
                    <option value="LinkedIn">LinkedIn</option>
                  </select>
                </div>
              </div>

              {/* Content Name/Idea */}
              <div>
                <label
                  htmlFor="content-name"
                  className="block text-sm font-semibold text-slate-900"
                >
                  Content Name / Idea
                </label>
                <p className="mt-1 text-xs text-slate-500">
                  Describe what the content is about (e.g., "Super Lemon Haze product
                  shot", "Weekend vibes with pre-rolls")
                </p>
                <input
                  id="content-name"
                  type="text"
                  value={contentName}
                  onChange={(e) => setContentName(e.target.value)}
                  placeholder="Enter content description..."
                  className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>

              {/* Generate Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGenerateCaption}
                  disabled={!canGenerate || isGenerating}
                  className="w-full rounded-xl bg-accent px-6 py-4 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isGenerating ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="h-5 w-5 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      {uploadProgress > 0 && uploadProgress < 100 
                        ? `Uploading... ${uploadProgress}%`
                        : "Generating Caption..."}
                    </span>
                  ) : (
                    "Generate Caption"
                  )}
                </button>
              </div>

              {/* Usage Warning */}
              {usageWarning && !error && (
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                  <div className="flex items-start gap-3">
                    <svg
                      className="h-5 w-5 flex-shrink-0 text-yellow-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-yellow-900">Usage Alert</h3>
                      <p className="mt-1 text-sm text-yellow-700">{usageWarning}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <svg
                      className="h-5 w-5 flex-shrink-0 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div>
                      <h3 className="text-sm font-semibold text-red-900">Error</h3>
                      <p className="mt-1 text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Progress Log */}
              {(isGenerating || progressLog.length > 0) && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Progress Log
                    </h3>
                    {isGenerating && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                        <svg
                          className="h-3 w-3 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Processing...
                      </span>
                    )}
                  </div>
                  <div 
                    ref={progressLogRef}
                    className="max-h-64 space-y-2 overflow-y-auto rounded-lg bg-white p-4"
                  >
                    {progressLog.length === 0 ? (
                      <p className="text-sm text-slate-500">Waiting for updates...</p>
                    ) : (
                      progressLog.map((log, index) => {
                        const iconColor = 
                          log.type === 'success' ? 'text-green-600' :
                          log.type === 'error' ? 'text-red-600' :
                          log.type === 'warning' ? 'text-yellow-600' :
                          'text-blue-600';
                        
                        const bgColor = 
                          log.type === 'success' ? 'bg-green-50' :
                          log.type === 'error' ? 'bg-red-50' :
                          log.type === 'warning' ? 'bg-yellow-50' :
                          'bg-blue-50';

                        return (
                          <div
                            key={index}
                            className={`flex items-start gap-2 rounded-lg p-2 ${bgColor} transition`}
                          >
                            <span className={`text-sm ${iconColor}`}>
                              {log.type === 'success' && '✓'}
                              {log.type === 'error' && '✗'}
                              {log.type === 'warning' && '⚠'}
                              {log.type === 'info' && '•'}
                            </span>
                            <span className="flex-1 text-sm text-slate-700">
                              {log.message}
                            </span>
                            <span className="text-xs text-slate-400">
                              {log.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Image Analysis Output (Gemini) */}
              {imageAnalysis && (
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-purple-900">
                      Image Analysis (Gemini)
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                      AI Analysis
                    </span>
                  </div>
                  <div className="rounded-lg bg-white p-4">
                    <p className="whitespace-pre-wrap text-sm text-slate-700">
                      {imageAnalysis}
                    </p>
                  </div>
                </div>
              )}

              {/* Video Analysis Output (Gemini) */}
              {videoAnalyses.length > 0 && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-blue-900">
                      Video Analysis (Gemini)
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                      {videoAnalyses.length} video{videoAnalyses.length > 1 ? 's' : ''} analyzed
                    </span>
                  </div>
                  <div className="space-y-4">
                    {videoAnalyses.map((analysis, index) => (
                      <div key={index} className="rounded-lg bg-white p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-xs font-semibold text-blue-700">
                            {analysis.fileName}
                          </span>
                          <span className="text-xs text-blue-500">
                            ({analysis.source})
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-slate-700">
                          {analysis.analysis}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Generated Caption Output */}
              {generatedCaption && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-green-900">
                      Generated Caption
                    </h3>
                    <button
                      type="button"
                      onClick={handleRegenerateCaption}
                      disabled={isGenerating}
                      className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-green-700 shadow-sm transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Regenerate
                    </button>
                  </div>
                  <div className="rounded-lg bg-white p-4">
                    <p className="whitespace-pre-wrap text-sm text-slate-700">
                      {generatedCaption}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(generatedCaption);
                        toast.success("Caption copied to clipboard!");
                      } catch (error) {
                        toast.error("Failed to copy caption");
                      }
                    }}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-accent/90"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Copy to Clipboard
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Info Boxes */}
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="h-5 w-5 flex-shrink-0 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-blue-900">
                    How it works
                  </h3>
                  <p className="mt-1 text-sm text-blue-700">
                    The AI analyzes your content and generates captions following GreenHaus
                    brand guidelines: fun, playful tone with curated emojis, proper
                    hashtags, and compelling CTAs. Videos are automatically processed with
                    adaptive frame extraction (3-15 frames based on video length).
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="h-5 w-5 flex-shrink-0 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                  />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-purple-900">
                    Google Drive Requirements
                  </h3>
                  <p className="mt-1 text-sm text-purple-700">
                    <strong>Important:</strong> Google Drive links must be set to "Anyone with
                    the link can view." Right-click the file → Share → Change to "Anyone with
                    the link" before pasting the link here.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
  );
}
