import type { Metadata } from "next";
import RequireAuth from "@/components/require-auth";
import AnalyticsDashboard from "./_components/analytics-dashboard";

export const metadata: Metadata = {
  title: "Analytics Dashboard | GreenHaus Admin",
};

export default function AnalyticsPage(): JSX.Element {
  return (
    <RequireAuth>
      <section className="min-h-full px-6 py-8">
        <div className="mx-auto max-w-7xl">
          <AnalyticsDashboard />
        </div>
      </section>
    </RequireAuth>
  );
}
