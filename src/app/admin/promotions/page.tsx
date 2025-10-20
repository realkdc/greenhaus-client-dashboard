import type { Metadata } from "next";
import AdminPromoTable from "./table-client";

export const metadata: Metadata = {
  title: "Promo Library | GreenHaus Admin",
  description: "Read-only list of all GreenHaus promotions.",
};

export default function AdminPromotionsPage(): JSX.Element {
  return (
    <section className="flex min-h-screen justify-center px-6 py-16">
      <div className="w-full max-w-5xl space-y-6">
        <div className="space-y-2">
          <span className="accent-pill">Admin</span>
          <h1 className="text-3xl font-semibold text-slate-900">
            Promotions overview
          </h1>
          <p className="text-sm text-slate-600">
            Review recent promos, their target stores, and active windows. This
            view is read-only.
          </p>
        </div>

        <AdminPromoTable />
      </div>
    </section>
  );
}
