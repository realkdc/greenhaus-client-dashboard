import type { Metadata } from "next";
import RequireAuth from "@/components/require-auth";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Tools Dashboard | GreenHaus Admin",
  description: "Access custom tools and software for GreenHaus operations.",
};

export default function ToolsPage(): JSX.Element {
  return (
    <RequireAuth>
      <section className="min-h-full px-6 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              GreenHaus Admin
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
              Tools Dashboard
            </h1>
            <p className="mt-2 text-slate-600">
              Access custom tools and automation software to streamline your workflow.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Caption Generator Tool Card */}
            <Link
              href="/tools/caption-generator"
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-accent hover:shadow-lg"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-xl bg-accent/10 p-3">
                  <svg
                    className="h-6 w-6 text-accent"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </div>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  OPEN
                </span>
              </div>
              <h3 className="text-xl font-semibold text-slate-900">
                Caption Generator
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Generate on-brand Instagram captions using AI. Upload photos, videos, or
                Google Drive links and get perfect captions instantly.
              </p>
              <div className="mt-4 flex items-center text-sm font-medium text-accent">
                <span>Open Tool</span>
                <svg
                  className="ml-1 h-4 w-4 transition group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>

            {/* Placeholder for future tools */}
            <div className="relative overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="rounded-xl bg-slate-200 p-3">
                  <svg
                    className="h-6 w-6 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <h3 className="mt-4 text-sm font-medium text-slate-600">
                  More tools coming soon
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Additional automation tools will be added here
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </RequireAuth>
  );
}
