import type { Metadata } from "next";
import AnalyticsDashboard from "./_components/analytics-dashboard";

export const metadata: Metadata = {
  title: "Analytics Dashboard | GreenHaus",
};

export default function AnalyticsPage(): JSX.Element {
  return (
    <section className="min-h-full px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <AnalyticsDashboard />
      </div>
    </section>
  );
}
