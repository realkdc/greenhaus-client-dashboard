'use client';

import { useEffect, useState } from "react";
import {
  Timestamp,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { STORES } from "@/lib/stores";
import {
  coerceCanonicalStoreId,
  resolveStoreAliases,
} from "@/lib/promotions/storeIds";
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

const windowFormatter = (start: Date | null, end: Date | null) => {
  if (!start || !end) return "—";
  const startLabel = dateFormatter.format(start);
  const endLabel = dateFormatter.format(end);
  return `${startLabel} → ${endLabel}`;
};

export default function PromoTable({ onError }: PromoTableProps): JSX.Element {
  const [rows, setRows] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchPromos = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/promotions/admin?limit=20");

      if (!response.ok) {
        throw new Error(`Failed to fetch promotions: ${response.statusText}`);
      }

      const data = await response.json();

      const nextRows: Promo[] = data.map((item: any) => {
        const title = typeof item.title === "string" ? item.title : "(Untitled)";
        const { canonical: storeId } =
          resolveStoreAliases(item.storeId) ?? {
            canonical: coerceCanonicalStoreId(item.storeId),
          };
        const createdBy =
          typeof item.createdBy === "string" ? item.createdBy : "unknown";

        // Map new schema to old status field
        let status: Promo["status"] = "draft";
        if (item.enabled === true) {
          const now = new Date();
          const startsAt = item.startsAt ? new Date(item.startsAt) : null;
          const endsAt = item.endsAt ? new Date(item.endsAt) : null;

          if (startsAt && startsAt > now) {
            status = "scheduled";
          } else if (endsAt && endsAt <= now) {
            status = "ended";
          } else {
            status = "live";
          }
        } else {
          status = "draft";
        }

        const createdAt = item.createdAt ? new Date(item.createdAt) : null;
        const startsAt = item.startsAt ? new Date(item.startsAt) : null;
        const endsAt = item.endsAt ? new Date(item.endsAt) : null;

        const promo: Promo = {
          id: item.id,
          title,
          body: typeof item.body === "string" ? item.body : "",
          storeId,
          ...(typeof item.deepLinkUrl === "string" && item.deepLinkUrl.length
            ? { deepLinkUrl: item.deepLinkUrl }
            : {}),
          startsAt: startsAt ? Timestamp.fromDate(startsAt) : null,
          endsAt: endsAt ? Timestamp.fromDate(endsAt) : null,
          status,
          createdBy,
          createdAt: createdAt ? Timestamp.fromDate(createdAt) : null,
        };

        return promo;
      });

      setRows(nextRows);
      setFetchError(null);
    } catch (error) {
      console.error("Failed to read promos", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch promotions";
      setFetchError(errorMessage);
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromos();

    // Poll for updates every 5 seconds
    const intervalId = setInterval(fetchPromos, 5000);

    return () => clearInterval(intervalId);
  }, [onError]);

  const togglePromoStatus = async (promoId: string, currentEnabled: boolean, promo?: Promo) => {
    console.log(`Toggling promo ${promoId} from ${currentEnabled ? 'enabled' : 'disabled'} to ${!currentEnabled ? 'enabled' : 'disabled'}`);

    if (!db) {
      onError("Firestore is not configured.");
      return;
    }

    setUpdating(promoId);
    try {
      const promoRef = doc(db, "promotions", promoId);
      const updateData: Record<string, unknown> = {
        enabled: !currentEnabled,
        updatedAt: serverTimestamp(),
      };

      // If we're enabling a promotion and it's currently ended (endsAt is in the past),
      // extend the end date by 7 days from now
      if (!currentEnabled && promo?.endsAt) {
        const endsAtDate = promo.endsAt.toDate();
        const now = new Date();
        if (endsAtDate <= now) {
          // Extend end date by 7 days
          const newEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          updateData.endsAt = Timestamp.fromDate(newEndDate);
          console.log(`Extending end date for ended promotion to ${newEndDate.toISOString()}`);
        }
      }

      await updateDoc(promoRef, updateData);
      console.log(`Successfully updated promo ${promoId}`);

      // Refetch the data after update
      await fetchPromos();
    } catch (error) {
      console.error("Failed to update promo status:", error);
      onError("Failed to update promotion status.");
    } finally {
      setUpdating(null);
    }
  };

  const deletePromo = async (promoId: string, promoTitle: string) => {
    if (!db) {
      onError("Firestore is not configured.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${promoTitle}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setUpdating(promoId);
    try {
      const promoRef = doc(db, "promotions", promoId);
      await deleteDoc(promoRef);
      console.log(`Successfully deleted promo ${promoId}`);

      // Refetch the data after delete
      await fetchPromos();
    } catch (error) {
      console.error("Failed to delete promo:", error);
      onError("Failed to delete promotion.");
    } finally {
      setUpdating(null);
    }
  };

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
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-600" style={{ minWidth: '800px' }}>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Store</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Window</th>
              <th className="px-4 py-3 font-medium">Created By</th>
              <th className="px-4 py-3 font-medium text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm">
                  Loading promos…
                </td>
              </tr>
            )}

            {!loading && fetchError && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-red-600">
                  {fetchError}
                </td>
              </tr>
            )}

            {!loading && !fetchError && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm">
                  No promotions yet. Create one above to get started.
                </td>
              </tr>
            )}

            {rows.map((promo) => {
              const storeLabel = STORE_LABEL_LOOKUP[promo.storeId] ?? promo.storeId;
              const windowLabel = windowFormatter(
                promo.startsAt ? promo.startsAt.toDate() : null,
                promo.endsAt ? promo.endsAt.toDate() : null
              );
              const isUpdating = updating === promo.id;
              const isEnabled = promo.status === "live" || promo.status === "scheduled";

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
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => togglePromoStatus(promo.id, isEnabled, promo)}
                        disabled={isUpdating}
                        className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors border ${
                          isEnabled
                            ? "bg-red-100 text-red-700 hover:bg-red-200 border-red-200"
                            : "bg-green-100 text-green-700 hover:bg-green-200 border-green-200"
                        } ${isUpdating ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {isUpdating ? (
                          <span className="flex items-center gap-1">
                            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                                fill="none"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                            Updating...
                          </span>
                        ) : isEnabled ? (
                          "Disable"
                        ) : (
                          "Enable"
                        )}
                      </button>
                      <button
                        onClick={() => deletePromo(promo.id, promo.title)}
                        disabled={isUpdating}
                        className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors border bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Permanently delete this promotion"
                      >
                        Delete
                      </button>
                    </div>
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
