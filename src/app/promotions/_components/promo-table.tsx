'use client';

import { useEffect, useState } from "react";
import {
  Timestamp,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  doc,
  updateDoc,
  serverTimestamp,
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
  const [updating, setUpdating] = useState<string | null>(null);

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
            data.storeId === "greenhaus-tn-cookeville" || data.storeId === "greenhaus-tn-crossville"
              ? data.storeId
              : "greenhaus-tn-cookeville";
          const createdBy =
            typeof data.createdBy === "string" ? data.createdBy : "unknown";
          // Map new schema to old status field
          let status: Promo["status"] = "draft";
          if (data.enabled === true) {
            const now = new Date();
            const startsAt = data.startsAt?.toDate();
            const endsAt = data.endsAt?.toDate();
            
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

  const togglePromoStatus = async (promoId: string, currentEnabled: boolean) => {
    console.log(`Toggling promo ${promoId} from ${currentEnabled ? 'enabled' : 'disabled'} to ${!currentEnabled ? 'enabled' : 'disabled'}`);
    
    if (!db) {
      onError("Firestore is not configured.");
      return;
    }

    setUpdating(promoId);
    try {
      const promoRef = doc(db, "promotions", promoId);
      await updateDoc(promoRef, {
        enabled: !currentEnabled,
        updatedAt: serverTimestamp(),
      });
      console.log(`Successfully updated promo ${promoId}`);
    } catch (error) {
      console.error("Failed to update promo status:", error);
      onError("Failed to update promotion status.");
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
              const windowLabel = windowFormatter(promo.startsAt, promo.endsAt);
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
                    <button
                      onClick={() => togglePromoStatus(promo.id, isEnabled)}
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
