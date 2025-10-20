'use client';

import { useState } from "react";
import PromoTable from "@/app/promotions/_components/promo-table";

export default function AdminPromoTable(): JSX.Element {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <PromoTable onError={(message) => setError(message ?? null)} />
    </div>
  );
}
