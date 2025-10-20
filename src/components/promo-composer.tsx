'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Timestamp,
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type FirestoreError,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { STORES, type StoreId } from "@/lib/stores";

type Promo = {
  id: string;
  title: string;
  body: string;
  storeId: StoreId | string | null;
  createdAt: Timestamp | null;
  scheduledAt: Timestamp | null;
};

type ToastState = {
  type: "success" | "error";
  message: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const STORE_LABEL_LOOKUP = STORES.reduce<Record<string, string>>(
  (acc, store) => {
    acc[store.id] = store.label;
    return acc;
  },
  {}
);

type PromoComposerProps = {
  canPublish: boolean;
};

export default function PromoComposer({
  canPublish,
}: PromoComposerProps): JSX.Element {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [storeId, setStoreId] = useState<StoreId>(STORES[0].id);
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!db) {
      setFetchError(
        "Firestore is not configured. Please verify your Firebase environment variables."
      );
      setLoadingPromos(false);
      return;
    }

    const promosQuery = query(
      collection(db, "promotions"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      promosQuery,
      (snapshot) => {
        const nextPromos: Promo[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: typeof data.title === "string" ? data.title : "(Untitled)",
            body: typeof data.body === "string" ? data.body : "",
            storeId:
              typeof data.storeId === "string" ? data.storeId : null,
            createdAt:
              data.createdAt instanceof Timestamp ? data.createdAt : null,
            scheduledAt:
              data.scheduledAt instanceof Timestamp ? data.scheduledAt : null,
          };
        });

        setPromos(nextPromos);
        setFetchError(null);
        setLoadingPromos(false);
      },
      (error: FirestoreError) => {
        setFetchError(error.message);
        setLoadingPromos(false);
      }
    );

    return unsubscribe;
  }, [db]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const showToast = useCallback((nextToast: ToastState | null) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToast(nextToast);

    if (nextToast) {
      toastTimeoutRef.current = setTimeout(() => {
        setToast(null);
      }, 3500);
    }
  }, []);

  const handlePublish = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!db) {
      showToast({
        type: "error",
        message:
          "Firestore is not configured. Update your Firebase keys to publish promos.",
      });
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (!trimmedTitle || !trimmedBody) {
      showToast({
        type: "error",
        message: "Please add both a title and body before publishing.",
      });
      return;
    }

    setIsPublishing(true);

    try {
      let scheduledTimestamp: Timestamp | null = null;
      if (scheduledAt) {
        const scheduledDate = new Date(scheduledAt);
        if (!Number.isNaN(scheduledDate.getTime())) {
          scheduledTimestamp = Timestamp.fromDate(scheduledDate);
        }
      }

      await addDoc(collection(db, "promotions"), {
        title: trimmedTitle,
        body: trimmedBody,
        storeId,
        createdAt: serverTimestamp(),
        scheduledAt: scheduledTimestamp,
      });

      setTitle("");
      setBody("");
      setStoreId(STORES[0].id);
      setScheduledAt("");
      showToast({ type: "success", message: "Promo Published ✅" });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to publish promo right now.";
      showToast({ type: "error", message });
    } finally {
      setIsPublishing(false);
    }
  };

  const renderPromos = useMemo(() => {
    if (loadingPromos) {
      return (
        <div className="space-y-4">
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="animate-pulse rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5"
            >
              <div className="h-5 w-1/3 rounded bg-slate-200" />
              <div className="mt-3 h-4 w-full rounded bg-slate-200" />
              <div className="mt-2 h-4 w-5/6 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      );
    }

    if (fetchError) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load promos: {fetchError}
        </div>
      );
    }

    if (promos.length === 0) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500">
          No promos yet. Create your first announcement above.
        </div>
      );
    }

    return (
      <ul className="space-y-4">
        {promos.map((promo) => {
          const createdDate = promo.createdAt?.toDate();
          const scheduledDate = promo.scheduledAt?.toDate();
          const storeLabel = promo.storeId
            ? STORE_LABEL_LOOKUP[promo.storeId] ?? promo.storeId
            : "Unassigned store";

          return (
            <li
              key={promo.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {promo.title}
                    </h3>
                    <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
                      {storeLabel}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm text-slate-600">
                    {promo.body}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-slate-400">
                  <div>
                    Published:
                    <br />
                    <strong className="font-medium text-slate-500">
                      {createdDate
                        ? dateFormatter.format(createdDate)
                        : "Pending…"}
                    </strong>
                  </div>
                  {scheduledDate && (
                    <div className="mt-2 text-[11px] text-slate-400">
                      Scheduled:
                      <br />
                      <strong className="font-medium text-slate-500">
                        {dateFormatter.format(scheduledDate)}
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }, [fetchError, loadingPromos, promos]);

  return (
    <section className="flex min-h-full justify-center px-6 py-16">
      <div className="w-full max-w-4xl space-y-8">
        {toast && (
          <div
            className={`rounded-full border px-4 py-2 text-sm font-medium shadow-sm sm:inline-flex ${
              toast.type === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {toast.message}
          </div>
        )}

        <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-8 shadow-lg shadow-accent/5 sm:p-12">
          <div className="space-y-3 text-center sm:text-left">
            <span className="accent-pill">Promotions</span>
            <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
              Promo Composer
            </h1>
            <p className="text-sm text-slate-600">
              Draft announcements for GreenHaus guests and publish them to the
              promotions feed.
            </p>
          </div>

          {canPublish ? (
            <form
              onSubmit={handlePublish}
              className="mt-8 space-y-6 text-left"
              autoComplete="off"
            >
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-1">
                  <label
                    htmlFor="promo-title"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Title
                  </label>
                  <input
                    id="promo-title"
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Earth Day flash sale"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                </div>

                <div className="space-y-2 sm:col-span-1">
                  <label
                    htmlFor="promo-store"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Store
                  </label>
                  <select
                    id="promo-store"
                    value={storeId}
                    onChange={(event) => setStoreId(event.target.value as StoreId)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                  >
                    {STORES.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="promo-body"
                  className="text-sm font-semibold text-slate-700"
                >
                  Body
                </label>
                <textarea
                  id="promo-body"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Share the details your guests need to take action."
                  rows={6}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
                <p className="text-xs text-slate-400">
                  Include key details, dates, or links your guests need to know.
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="promo-scheduled-at"
                  className="text-sm font-semibold text-slate-700"
                >
                  Scheduled send (optional)
                </label>
                <input
                  id="promo-scheduled-at"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
                <p className="text-xs text-slate-400">
                  Leave blank to send immediately.
                </p>
              </div>

              <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-400">
                  Promos publish instantly to the Firestore collection.
                </p>
                <button
                  type="submit"
                  disabled={isPublishing}
                  className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-accent/60"
                >
                  {isPublishing ? "Publishing…" : "Publish Promo"}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/80 px-6 py-5 text-sm text-slate-600">
              You have read-only access. Contact a GreenHaus admin if you need
              permission to publish promos.
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-8 shadow-lg shadow-accent/5 sm:p-10">
          <div className="flex flex-col gap-2 text-left sm:flex-row sm:items-baseline sm:justify-between">
            <h2 className="text-xl font-semibold text-slate-900">
              Recent promos
            </h2>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Live feed
            </span>
          </div>

          <div className="mt-6">{renderPromos}</div>
        </div>
      </div>
    </section>
  );
}
