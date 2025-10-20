import type { Metadata } from "next";
import PushCenter from "./push-center";

export const metadata: Metadata = {
  title: "Push Center | GreenHaus Admin",
  description:
    "Send broadcast push notifications to GreenHaus audiences across environments.",
};

export default function PushCenterPage(): JSX.Element {
  return (
    <section className="flex min-h-screen justify-center px-6 py-16">
      <div className="w-full max-w-3xl space-y-8">
        <div className="space-y-2">
          <span className="accent-pill">Admin</span>
          <h1 className="text-3xl font-semibold text-slate-900">Push Center</h1>
          <p className="text-sm text-slate-600">
            Craft and dispatch push notifications to specific environments or
            stores.
          </p>
        </div>

        <PushCenter />
      </div>
    </section>
  );
}

