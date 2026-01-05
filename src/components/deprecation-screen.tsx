"use client";

import { useState } from "react";

interface DeprecationScreenProps {
  newWebsiteUrl?: string;
  email?: string;
  password?: string;
}

export default function DeprecationScreen({
  newWebsiteUrl = "https://app.greenloop.dev/",
  email = "greenhauscc@gmail.com",
  password = "GreenHaus420!",
}: DeprecationScreenProps) {
  const [showPassword, setShowPassword] = useState(false);

  const handleRedirect = () => {
    window.location.href = newWebsiteUrl;
  };

  return (
    <div className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-gradient-to-br from-white via-white to-[#73A6330d] p-6">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mb-4 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
            <svg
              className="mr-2 h-5 w-5"
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
            Dashboard Deprecated
          </div>
          <h1 className="mb-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Dashboard Has Moved
          </h1>
          <p className="text-lg text-slate-600">
            This dashboard has been deprecated. Please use our new website to access your dashboard.
          </p>
        </div>

        <div className="mb-6 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-6">
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
              New Dashboard URL
            </h2>
            <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white p-3">
              <svg
                className="h-5 w-5 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              <span className="flex-1 font-mono text-sm text-slate-900">
                {newWebsiteUrl}
              </span>
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
              Your Login Credentials
            </h2>
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-300 bg-white p-3">
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Email
                </label>
                <div className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                    />
                  </svg>
                  <span className="font-mono text-sm text-slate-900">{email}</span>
                </div>
              </div>
              <div className="rounded-lg border border-slate-300 bg-white p-3">
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Password
                </label>
                <div className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  <span className="flex-1 font-mono text-sm text-slate-900">
                    {showPassword ? password : "•".repeat(password.length)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> You can change your password after logging in if needed.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            onClick={handleRedirect}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#73A633] px-6 py-3 font-semibold text-white transition hover:bg-[#5d8528] focus:outline-none focus:ring-2 focus:ring-[#73A633] focus:ring-offset-2"
          >
            <span>Go to New Dashboard</span>
            <svg
              className="h-5 w-5"
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
      </div>
    </div>
  );
}
