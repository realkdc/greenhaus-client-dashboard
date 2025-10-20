import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | GreenHaus",
};

export default function TermsOfService(): JSX.Element {
  return (
    <article className="space-y-10 bg-white">
      <header className="space-y-4">
        <h1 className="text-4xl font-semibold text-slate-900">Terms of Service</h1>
        <p className="text-slate-600">
          Use this placeholder to outline the agreement that governs access to
          the GreenHaus platform. Replace with finalized terms when ready.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-slate-900">1. Acceptance</h2>
        <p className="text-slate-600">
          Summarize the conditions for using the GreenHaus mobile app and admin
          tools, including user responsibilities.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-slate-900">
          2. Permitted Use
        </h2>
        <p className="text-slate-600">
          Highlight acceptable behaviors, prohibited actions, and rules for
          managing stores, campaigns, and staff data.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-slate-900">
          3. Service Updates
        </h2>
        <p className="text-slate-600">
          Explain how GreenHaus may update features, enforce policies, or
          terminate accounts to protect the community.
        </p>
      </section>
    </article>
  );
}
