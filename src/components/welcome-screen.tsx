"use client";

import { useEffect, useState } from "react";

interface WelcomeScreenProps {
  onEnter: () => void;
}

export default function WelcomeScreen({ onEnter }: WelcomeScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Hide header and footer when welcome screen is showing
    const header = document.querySelector("header");
    const footer = document.querySelector("footer");
    
    if (header) header.style.display = "none";
    if (footer) footer.style.display = "none";

    return () => {
      // Restore header and footer when component unmounts
      if (header) header.style.display = "";
      if (footer) footer.style.display = "";
    };
  }, []);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Enter" && isVisible) {
        handleEnter();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isVisible]);

  const handleEnter = () => {
    setIsVisible(false);
    // Small delay for fade out animation
    setTimeout(() => {
      onEnter();
    }, 400);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-white via-white to-[#73A6330d] backdrop-blur-sm">
      <div
        className={`flex flex-col items-center justify-center gap-8 px-6 text-center transition-all duration-500 ${
          mounted
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4"
        }`}
      >
        {/* Animated Plant/Leaf Icon */}
        <div
          className={`mb-4 transition-all duration-700 delay-100 ${
            mounted ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-75 rotate-12"
          }`}
        >
          <div className="relative inline-block">
            <svg
              className="h-20 w-20 text-accent drop-shadow-lg"
              fill="currentColor"
              viewBox="0 0 24 24"
              style={{
                animation: "float 3s ease-in-out infinite",
              }}
            >
              {/* Plant sprout with two leaves - clearly a plant */}
              {/* Stem */}
              <rect x="11" y="16" width="2" height="6" rx="1" />
              {/* Left leaf - oval/leaf shape */}
              <ellipse cx="7" cy="12" rx="4" ry="6" transform="rotate(-25 7 12)" />
              {/* Right leaf - oval/leaf shape */}
              <ellipse cx="17" cy="12" rx="4" ry="6" transform="rotate(25 17 12)" />
              {/* Small top leaf */}
              <ellipse cx="12" cy="8" rx="2.5" ry="4" transform="rotate(0 12 8)" />
              {/* Veins on left leaf */}
              <line x1="7" y1="12" x2="5" y2="9" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
              <line x1="7" y1="12" x2="5" y2="15" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
              {/* Veins on right leaf */}
              <line x1="17" y1="12" x2="19" y2="9" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
              <line x1="17" y1="12" x2="19" y2="15" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
            </svg>
            {/* Subtle glow effect */}
            <div className="absolute inset-0 h-20 w-20 bg-accent/20 rounded-full blur-xl animate-pulse" />
          </div>
        </div>

        {/* Welcome Message - More Personal */}
        <div
          className={`space-y-6 transition-all duration-700 delay-200 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="inline-flex items-center gap-2.5 rounded-full border border-accent/20 bg-accent/10 px-5 py-2.5 text-sm font-medium text-accent backdrop-blur-sm">
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
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <span>Content & analytics at your fingertips</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-5xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
              <span
                className={`inline-block transition-all duration-700 delay-300 ${
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
              >
                Welcome back
              </span>
              <br />
              <span
                className={`inline-block text-accent transition-all duration-700 delay-400 ${
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
              >
                to GreenHaus
              </span>
            </h1>
            <p
              className={`mx-auto max-w-xl text-lg text-slate-600 transition-all duration-700 delay-500 ${
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              Everything you need to create content, monitor performance, and track
              ambassador activity is waiting for you.
            </p>
          </div>
        </div>

        {/* Enter Button */}
        <div
          className={`transition-all duration-700 delay-600 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <button
            onClick={handleEnter}
            className="group mt-4 inline-flex items-center gap-3 rounded-full border-2 border-accent bg-accent px-8 py-4 text-base font-semibold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent active:scale-95"
          >
            <span>Enter Dashboard</span>
            <svg
              className="h-5 w-5 transition-transform group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </button>
        </div>

        {/* Keyboard Hint */}
        <p
          className={`mt-3 text-xs text-slate-400 transition-all duration-700 delay-700 ${
            mounted ? "opacity-100" : "opacity-0"
          }`}
        >
          Press <kbd className="rounded border border-slate-300 bg-slate-50 px-2 py-1 font-mono text-xs shadow-sm">Enter</kbd> to continue
        </p>
      </div>
    </div>
  );
}

