'use client';

import { useMemo, useState } from "react";
import {
  Timestamp,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { STORES, type StoreId } from "@/lib/stores";

const DEFAULT_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

const toInputValue = (date: Date): string =>
  date.toISOString().slice(0, 16);

type PromoFormProps = {
  canPublish: boolean;
  userEmail: string;
  onSuccess: () => void;
  onError: (message?: string) => void;
};

export default function PromoForm({
  canPublish,
  userEmail,
  onSuccess,
  onError,
}: PromoFormProps): JSX.Element {
  const initialStart = useMemo(() => toInputValue(new Date()), []);
  const initialEnd = useMemo(
    () => toInputValue(new Date(Date.now() + DEFAULT_DURATION_MS)),
    []
  );

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [storeId, setStoreId] = useState<StoreId>(STORES[0].id);
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [scheduledStart, setScheduledStart] = useState(initialStart);
  const [endsAt, setEndsAt] = useState(initialEnd);
  const [deepLinkUrl, setDeepLinkUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const saveDisabled = isSubmitting || !canPublish;

  const resetForm = () => {
    const freshStart = toInputValue(new Date());
    const freshEnd = toInputValue(
      new Date(Date.now() + DEFAULT_DURATION_MS)
    );

    setTitle("");
    setBody("");
    setStoreId(STORES[0].id);
    setMode("now");
    setScheduledStart(freshStart);
    setEndsAt(freshEnd);
    setDeepLinkUrl("");
    setFormError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!canPublish) {
      const message = "Ask admin to add your email.";
      setFormError(message);
      onError(message);
      return;
    }

    if (!db) {
      const message =
        "Firestore is not configured. Check your environment variables.";
      setFormError(message);
      onError(message);
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (!trimmedTitle || !trimmedBody) {
      const message = "Title and body are required.";
      setFormError(message);
      onError(message);
      return;
    }

    let startDate = new Date();
    if (mode === "schedule") {
      if (!scheduledStart) {
        const message = "Select a start time when scheduling a promo.";
        setFormError(message);
        onError(message);
        return;
      }

      const parsed = new Date(scheduledStart);
      if (Number.isNaN(parsed.getTime())) {
        const message = "Start time is invalid.";
        setFormError(message);
        onError(message);
        return;
      }
      startDate = parsed;
    }

    if (!endsAt) {
      const message = "Provide an end time for the promo.";
      setFormError(message);
      onError(message);
      return;
    }

    const endDate = new Date(endsAt);
    if (Number.isNaN(endDate.getTime())) {
      const message = "End time is invalid.";
      setFormError(message);
      onError(message);
      return;
    }

    if (endDate.getTime() <= startDate.getTime()) {
      const message = "End time must be after the start time.";
      setFormError(message);
      onError(message);
      return;
    }

    setIsSubmitting(true);

    try {
      const cleanedDeepLink = deepLinkUrl.trim();

      const payload: Record<string, unknown> = {
        title: trimmedTitle,
        body: trimmedBody,
        storeId,
        status: "live",
        createdBy: userEmail,
        createdAt: serverTimestamp(),
        startsAt:
          mode === "schedule"
            ? Timestamp.fromDate(startDate)
            : serverTimestamp(),
        endsAt: Timestamp.fromDate(endDate),
      };

      if (cleanedDeepLink) {
        payload.deepLinkUrl = cleanedDeepLink;
      }

      await addDoc(collection(db, "promotions"), payload);

      resetForm();
      onSuccess();
    } catch (error) {
      console.error("Failed to publish promo", error);
      const message =
        error instanceof Error
          ? error.message
          : "Unable to publish promo right now.";
      setFormError(message);
      onError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-8 shadow-lg shadow-accent/5 sm:p-12">
      <div className="space-y-3 text-center sm:text-left">
        <span className="accent-pill">Promotions</span>
        <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
          Compose a new promo
        </h1>
        <p className="text-sm text-slate-600">
          Draft announcements for GreenHaus guests and publish or schedule them
          for later.
        </p>
        {!canPublish && (
          <p className="text-sm font-medium text-red-600">
            Ask admin to add your email.
          </p>
        )}
        {formError && canPublish && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-6 text-left"
        autoComplete="off"
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
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
              maxLength={60}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <p className="text-xs text-slate-400">
              {title.length}/60 characters
            </p>
          </div>

          <div className="space-y-2">
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
            htmlFor="promo-deep-link"
            className="text-sm font-semibold text-slate-700"
          >
            Deep link URL (optional)
          </label>
          <input
            id="promo-deep-link"
            type="url"
            value={deepLinkUrl}
            onChange={(event) => setDeepLinkUrl(event.target.value)}
            placeholder="https://greenhaus.app/product/..."
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
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
            maxLength={200}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <p className="text-xs text-slate-400">{body.length}/200 characters</p>
        </div>

        <fieldset className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-4">
          <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Delivery
          </legend>
          <label className="flex items-start gap-3 text-sm text-slate-600">
            <input
              type="radio"
              name="promo-delivery"
              value="now"
              checked={mode === "now"}
              onChange={() => setMode("now")}
              className="mt-1 h-4 w-4 text-accent focus:ring-accent"
            />
            <span>
              <strong className="text-slate-900">Send now</strong>
              <span className="block text-xs text-slate-500">
                Publishes immediately after saving.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-slate-600">
            <input
              type="radio"
              name="promo-delivery"
              value="schedule"
              checked={mode === "schedule"}
              onChange={() => setMode("schedule")}
              className="mt-1 h-4 w-4 text-accent focus:ring-accent"
            />
            <span>
              <strong className="text-slate-900">Schedule for later</strong>
              <span className="block text-xs text-slate-500">
                Choose a date and time to publish automatically.
              </span>
            </span>
          </label>
        </fieldset>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="promo-starts-at"
              className="text-sm font-semibold text-slate-700"
            >
              Starts
            </label>
            <input
              id="promo-starts-at"
              type="datetime-local"
              value={mode === "schedule" ? scheduledStart : ""}
              onChange={(event) => setScheduledStart(event.target.value)}
              disabled={mode === "now"}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:bg-slate-50"
            />
            <p className="text-xs text-slate-400">
              {mode === "now"
                ? "Starts immediately when saved."
                : "Promo begins at the scheduled time."}
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="promo-ends-at"
              className="text-sm font-semibold text-slate-700"
            >
              Ends
            </label>
            <input
              id="promo-ends-at"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <p className="text-xs text-slate-400">
              Promo automatically ends at this time.
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">
            Promos publish to Firestore on save. Scheduled promos include the
            selected timestamp.
          </p>
          <button
            type="submit"
            disabled={saveDisabled}
            className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-accent/60"
          >
            {isSubmitting ? "Saving…" : "Publish promo"}
          </button>
        </div>
      </form>
    </div>
  );
}
