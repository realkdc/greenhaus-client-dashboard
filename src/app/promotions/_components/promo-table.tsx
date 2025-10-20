'use client';

import { useEffect, useState } from "react";
import {
  Timestamp,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type FirestoreError,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { STORES } from "@/lib/stores";
import type { Promo } from "../../../../types/promo";

type PromoTableProps = {
  onError: (message?: string) => void;
};

const STORE_LABEL_LOOKUP = STORES.reduce<Record<string, string>>(
  (acc, store) => {
    acc[store.id] = store.label;
    return acc;
  },
  {}
);

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const windowFormatter = (start: Timestamp | null, end: Timestamp | null) => {
  if (!start || !end) return "—";
  const startLabel = dateFormatter.format(start.toDate());
  const endLabel = dateFormatter.format(end.toDate());
  return `${startLabel} → ${endLabel}`;
};

export default function PromoTable({ onError }: PromoTableProps): JSX.Element {
  const [rows, setRows] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      const message = "Firestore is not configured.";
      setFetchError(message);
      onError(message);
      setLoading(false);
      return;
    }

    const promosQuery = query(
      collection(db, "promotions"),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(
      promosQuery,
      (snapshot) => {
        const nextRows: Promo[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();

          const title = typeof data.title === "string" ? data.title : "(Untitled)";
          const storeId =
            data.storeId === "cookeville" || data.storeId === "crossville"
              ? data.storeId
              : "cookeville";
          const createdBy =
            typeof data.createdBy === "string" ? data.createdBy : "unknown";
          const status: Promo["status"] =
            data.status === "draft" ||
            data.status === "scheduled" ||
            data.status === "live" ||
            data.status === "ended"
              ? data.status
              : "draft";

          const createdAt =
            data.createdAt instanceof Timestamp ? data.createdAt : null;
          const startsAt =
            data.startsAt instanceof Timestamp ? data.startsAt : null;
          const endsAt =
            data.endsAt instanceof Timestamp ? data.endsAt : null;

          const promo: Promo = {
            id: docSnap.id,
            title,
            body: typeof data.body === "string" ? data.body : "",
            storeId,
            ...(typeof data.deepLinkUrl === "string" && data.deepLinkUrl.length
              ? { deepLinkUrl: data.deepLinkUrl }
              : {}),
            startsAt,
            endsAt,
            status,
            createdBy,
            createdAt,
          };

          return promo;
        });

        setRows(nextRows);
        setFetchError(null);
        setLoading(false);
      },
      (error: FirestoreError) => {
        console.error("Failed to read promos", error);
        setFetchError(error.message);
        onError(error.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [onError]);

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-lg shadow-accent/5 sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-xl font-semibold text-slate-900">
          Recent promotions
        </h2>
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Showing latest 20
        </span>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Store</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Window</th>
              <th className="px-4 py-3 font-medium">Created By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm">
                  Loading promos…
                </td>
              </tr>
            )}

            {!loading && fetchError && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-red-600">
                  {fetchError}
                </td>
              </tr>
            )}

            {!loading && !fetchError && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm">
                  No promotions yet. Create one above to get started.
                </td>
              </tr>
            )}

            {rows.map((promo) => {
              const storeLabel = STORE_LABEL_LOOKUP[promo.storeId] ?? promo.storeId;
              const windowLabel = windowFormatter(promo.startsAt, promo.endsAt);

              return (
                <tr key={promo.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {promo.title}
                  </td>
                  <td className="px-4 py-3">{storeLabel}</td>
                  <td className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500">
                    {promo.status}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {windowLabel}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {promo.createdBy}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
