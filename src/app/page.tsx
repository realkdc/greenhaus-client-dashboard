import Link from "next/link";
import RequireAuth from "@/components/require-auth";

export default function Home(): JSX.Element {
  return (
    <RequireAuth>
      <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-12 px-6 py-16">
      <section className="flex flex-col items-center gap-4 text-center sm:items-start sm:text-left">
        <span className="accent-pill">GreenHaus Admin</span>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          Guide every guest toward a greener stay.
        </h1>
        <p className="max-w-2xl text-lg text-slate-600">
          Launch promotions, monitor performance, activate stores, and support
          GreenHaus ambassadors from one streamlined dashboard.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {[
          {
            name: "Promotions Dashboard",
            href: "/promotions",
            description: "Plan and send targeted push promos built to convert.",
          },
          {
            name: "Analytics Dashboard",
            href: "/analytics",
            description:
              "Keep tabs on adoption, retention, and engagement across the app.",
          },
          {
            name: "Stores Dashboard",
            href: "/stores",
            description:
              "Curate pickup spots and manage availability in every city.",
          },
          {
            name: "Ambassadors Dashboard",
            href: "/ambassadors",
            description:
              "Empower GreenHaus crew members with transparent performance data.",
          },
          {
            name: "Tools Dashboard",
            href: "/tools",
            description:
              "Access custom tools and automation software to streamline your workflow.",
          },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm transition hover:-translate-y-1 hover:border-accent hover:shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {item.name}
              </h2>
              <span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent transition group-hover:bg-accent group-hover:text-white">
                Open
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-600">{item.description}</p>
          </Link>
        ))}
      </section>
    </div>
    </RequireAuth>
  );
}
