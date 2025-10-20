import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | GreenHaus",
};

export default function PrivacyPolicy(): JSX.Element {
  return (
    <article className="space-y-10 bg-white">
      <header className="space-y-4">
        <h1 className="text-4xl font-semibold text-slate-900">Privacy Policy</h1>
        <p className="text-slate-600">
          This placeholder copy explains how GreenHaus collects, uses, and
          protects guest information. Replace with the finalized policy text.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-slate-900">
          1. Information We Collect
        </h2>
        <p className="text-slate-600">
          Outline the types of data gathered through the GreenHaus platform,
          including personal details, usage analytics, and voluntary feedback.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-slate-900">
          2. How We Use Information
        </h2>
        <p className="text-slate-600">
          Describe how data supports personalized experiences, service
          improvements, and compliant communications with our community.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-slate-900">
          3. Contact Us
        </h2>
        <p className="text-slate-600">
          Share the best way to reach the GreenHaus team with privacy questions
          or requests.
        </p>
      </section>
    </article>
  );
}
