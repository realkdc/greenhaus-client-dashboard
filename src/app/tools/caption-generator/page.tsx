"use client";

import { useState } from "react";
import RequireAuth from "@/components/require-auth";
import Link from "next/link";

export default function CaptionGeneratorPage(): JSX.Element {
  const [files, setFiles] = useState<FileList | null>(null);
  const [googleDriveLinks, setGoogleDriveLinks] = useState("");
  const [contentName, setContentName] = useState("");
  const [generatedCaption, setGeneratedCaption] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [usageWarning, setUsageWarning] = useState("");
  const [usageInfo, setUsageInfo] = useState<{
    percentUsed: number;
    remainingCost: string;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(e.target.files);
    }
  };

  const handleGenerateCaption = async () => {
    setIsGenerating(true);
    setError("");
    setGeneratedCaption("");

    try {
      const formData = new FormData();

      // Add files to form data
      if (files) {
        Array.from(files).forEach((file) => {
          formData.append("files", file);
        });
      }

      // Add other data
      if (googleDriveLinks.trim()) {
        formData.append("googleDriveLinks", googleDriveLinks.trim());
      }

      formData.append("contentName", contentName.trim());

      const response = await fetch("/api/tools/generate-caption", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate caption");
      }

      setGeneratedCaption(data.caption);

      // Handle usage warnings
      if (data.usageWarning) {
        setUsageWarning(data.usageWarning);
      }

      if (data.usageInfo) {
        setUsageInfo(data.usageInfo);
      }
    } catch (err) {
      console.error("Error generating caption:", err);
      setError(err instanceof Error ? err.message : "Failed to generate caption");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateCaption = () => {
    handleGenerateCaption();
  };

  const canGenerate = (files && files.length > 0) || googleDriveLinks.trim() !== "";

  return (
    <RequireAuth>
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
                  <label
                    htmlFor="file-upload"
                    className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 transition hover:border-accent hover:bg-accent/5"
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
                  {files && files.length > 0 && (
                    <div className="mt-3 space-y-2">
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
                      Generating Caption...
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
                      {usageInfo && (
                        <p className="mt-2 text-xs text-yellow-600">
                          {usageInfo.percentUsed}% used • ${usageInfo.remainingCost} remaining this month
                        </p>
                      )}
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
                    onClick={() => {
                      navigator.clipboard.writeText(generatedCaption);
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

            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="h-5 w-5 flex-shrink-0 text-green-600"
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
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-green-900">
                    Usage Limit
                  </h3>
                  <p className="mt-1 text-sm text-green-700">
                    This tool has a $5 monthly usage limit to control costs. You'll see warnings
                    at 80% usage and the tool will pause at 100% until next month. Average cost
                    per caption: ~$0.02
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </RequireAuth>
  );
}
