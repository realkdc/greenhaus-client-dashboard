import type { Metadata } from "next";
import RequireAuth from "@/components/require-auth";

export const metadata: Metadata = {
  title: "Analytics Dashboard | GreenHaus Admin",
};

export default function AnalyticsPage(): JSX.Element {
  return (
    <RequireAuth>
      <section className="flex min-h-full items-center justify-center px-6 py-24">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-200/80 bg-white/90 p-12 text-center shadow-lg shadow-accent/5">
        <span className="accent-pill mb-4">Insights</span>
        <h1 className="text-4xl font-semibold text-slate-900">
          Analytics Dashboard
        </h1>
        <p className="mt-4 text-base text-slate-600">
          Monitor the health of GreenHaus across acquisition, retention, and
          engagement.
        </p>
      </div>
    </section>
    </RequireAuth>
  );
}
