'use client';

import {
  Timestamp,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  type DocumentData,
  type FirestoreError,
} from "firebase/firestore";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { auth, db } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

type AmbassadorRecord = {
  id: string;
  name: string;
  code: string;
  status: "active" | "paused";
  createdAt: Timestamp | null;
};

type ReferralRecord = {
  id: string;
  code: string;
  landing: string;
  ts: Timestamp | null;
  userAgent?: string;
  ip?: string | null;
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function randomSuffix(length = 4): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * alphabet.length);
    result += alphabet[index] ?? "0";
  }
  return result;
}

function formatTimestamp(ts: Timestamp | null): string {
  if (!ts) return "—";
  try {
    return dateFormatter.format(ts.toDate());
  } catch {
    return "—";
  }
}

export default function CrewPage(): JSX.Element {
  const { user, loading, signOut } = useAuth();

  const [ambassadors, setAmbassadors] = useState<AmbassadorRecord[]>([]);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);

  const [formName, setFormName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [ambassadorsLoading, setAmbassadorsLoading] = useState(true);
  const [referralsLoading, setReferralsLoading] = useState(true);
  const [ambassadorsError, setAmbassadorsError] = useState<string | null>(null);
  const [referralsError, setReferralsError] = useState<string | null>(null);

  const [origin, setOrigin] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (!db) {
      setAmbassadorsLoading(false);
      setReferralsLoading(false);
      setAmbassadorsError(
        "Firestore is not configured. Set NEXT_PUBLIC_FIREBASE_* env vars."
      );
      setReferralsError(
        "Firestore is not configured. Set NEXT_PUBLIC_FIREBASE_* env vars."
      );
      return;
    }

    const ambassadorsQuery = query(
      collection(db, "ambassadors"),
      orderBy("createdAt", "desc")
    );
    const referralsQuery = query(
      collection(db, "referrals"),
      orderBy("ts", "desc"),
      limit(25)
    );

    const unsubscribeAmbassadors = onSnapshot(
      ambassadorsQuery,
      (snapshot) => {
        const next: AmbassadorRecord[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData & Partial<AmbassadorRecord>;

          return {
            id: data.id ?? docSnap.id,
            name: (data.name as string | undefined) ?? "Untitled",
            code: (data.code as string | undefined) ?? docSnap.id,
            status: data.status === "paused" ? "paused" : ("active" as const),
            createdAt:
              data.createdAt instanceof Timestamp ? data.createdAt : null,
          };
        });
        setAmbassadors(next);
        setAmbassadorsLoading(false);
        setAmbassadorsError(null);
      },
      (error: FirestoreError) => {
        console.error("Failed to load ambassadors", error);
        setAmbassadorsError(
          "Unable to load ambassadors. Refresh and try again."
        );
        setAmbassadorsLoading(false);
      }
    );

    const unsubscribeReferrals = onSnapshot(
      referralsQuery,
      (snapshot) => {
        const next: ReferralRecord[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData & Partial<ReferralRecord>;

          return {
            id: docSnap.id,
            code: (data.code as string | undefined) ?? "unknown",
            landing: (data.landing as string | undefined) ?? "/",
            ts: data.ts instanceof Timestamp ? data.ts : null,
            userAgent: data.userAgent as string | undefined,
            ip: data.ip as string | null | undefined,
          };
        });
        setReferrals(next);
        setReferralsLoading(false);
        setReferralsError(null);
      },
      (error: FirestoreError) => {
        console.error("Failed to load referrals", error);
        setReferralsError("Unable to load referrals. Refresh and try again.");
        setReferralsLoading(false);
      }
    );

    return () => {
      unsubscribeAmbassadors();
      unsubscribeReferrals();
    };
  }, [db]);

  useEffect(() => {
    if (!formSuccess) return;
    const timer = setTimeout(() => {
      setFormSuccess(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [formSuccess]);

  const handleGoogleSignIn = useCallback(async () => {
    if (!auth) {
      setFormError(
        "Firebase Auth is not configured. Check your environment variables."
      );
      return;
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    setFormError(null);

    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to sign in with Google right now.";
      setFormError(message);
    }
  }, []);

  const generateUniqueCode = useCallback(
    async (name: string) => {
      if (!db) {
        throw new Error("Firestore not configured");
      }
      const base = slugify(name);
      const prefix = base || "crew";

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const candidate = `${prefix}-${randomSuffix(4)}`;
        const docRef = doc(collection(db, "ambassadors"), candidate);
        const existing = await getDoc(docRef);
        if (!existing.exists()) {
          return { code: candidate, docRef };
        }
      }

      throw new Error("Unable to generate a unique code. Try again.");
    },
    [db]
  );

  const handleCreateAmbassador = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!db) {
        setFormError(
          "Firestore is not configured. Populate NEXT_PUBLIC_FIREBASE_* env vars."
        );
        return;
      }

      const trimmedName = formName.trim();
      if (!trimmedName) {
        setFormError("Add the ambassador name before saving.");
        return;
      }

      setFormError(null);
      setFormSuccess(null);
      setCreating(true);

      try {
        const { code, docRef } = await generateUniqueCode(trimmedName);
        await setDoc(docRef, {
          id: docRef.id,
          name: trimmedName,
          code,
          status: "active",
          createdAt: Timestamp.now(),
        });
        setFormName("");
        setFormSuccess(`Created ${trimmedName} — share ${code}.`);
      } catch (error) {
        console.error("Failed to create ambassador", error);
        const message =
          error instanceof Error
            ? error.message
            : "Unable to create ambassador. Try again.";
        setFormError(message);
      } finally {
        setCreating(false);
      }
    },
    [db, formName, generateUniqueCode]
  );

  const handleCopy = useCallback(
    async (code: string) => {
      const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
      const link = `${base.replace(/\/$/, "")}/r/${code}`;

      try {
        if (typeof navigator === "undefined" || !navigator.clipboard) {
          throw new Error("Clipboard API unavailable");
        }
        await navigator.clipboard.writeText(link);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
      } catch (error) {
        console.error("Failed to copy referral link", error);
        setFormError("Unable to copy link. Copy manually instead.");
      }
    },
    [origin]
  );

  const canAccess = Boolean(user);

  if (loading) {
    return (
      <section className="flex min-h-[360px] items-center justify-center px-6 py-16">
        <div className="flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2 text-sm text-slate-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          Loading your session…
        </div>
      </section>
    );
  }

  if (!canAccess) {
    return (
      <section className="flex min-h-[420px] items-center justify-center px-6 py-20">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white px-8 py-12 text-center shadow-xl shadow-slate-200/40">
          <span className="accent-pill mb-5">Crew</span>
          <h1 className="text-3xl font-semibold text-slate-900">
            Sign in to manage referrals
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Log in with your GreenHaus Google account to view ambassadors and
            referral activity.
          </p>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="inline-block h-5 w-5">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.92h5.43c-.24 1.26-.98 2.33-2.08 3.05l3.37 2.62c1.97-1.82 3.11-4.49 3.11-7.65 0-.74-.07-1.45-.2-2.14H12z"
                />
                <path
                  fill="#34A853"
                  d="M5.27 14.281A7.787 7.787 0 0 1 4.68 12c0-.792.135-1.554.38-2.268L1.62 6.576A11.781 11.781 0 0 0 0 12c0 1.921.462 3.735 1.281 5.424z"
                />
                <path
                  fill="#FBBC05"
                  d="M12 4.75c1.72 0 3.26.593 4.48 1.758l3.36-3.36C17.87 1.81 15.28.75 12 .75 7.32.75 3.29 3.4 1.62 6.576L5.06 9.732C5.84 7.357 8.02 5.6 12 5.6z"
                />
                <path
                  fill="#4285F4"
                  d="M1.282 17.424 5.06 14.268C5.96 16.883 8.27 18.75 12 18.75c2.28 0 4.19-.75 5.6-2.03l-3.17-2.55c-.88.6-2 1.02-3.43 1.02-2.63 0-4.86-1.77-5.67-4.21z"
                />
              </svg>
            </span>
            Sign in with Google
          </button>
          {formError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 py-16">
      <div className="mx-auto w-full max-w-6xl space-y-10">
        <header className="flex flex-col gap-2">
          <span className="accent-pill w-fit">Crew</span>
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">
              Referral crew dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Create ambassadors, grab their referral links, and keep an eye on
              the latest clicks.
            </p>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <form
              onSubmit={handleCreateAmbassador}
              className="rounded-3xl border border-slate-200/80 bg-white px-6 py-6 shadow-sm shadow-slate-200/60 sm:px-8 sm:py-8"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Create ambassador
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    We&apos;ll generate a referral code you can share instantly.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <label
                  htmlFor="ambassador-name"
                  className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Ambassador name
                </label>
                <input
                  id="ambassador-name"
                  type="text"
                  value={formName}
                  onChange={(event) => setFormName(event.target.value)}
                  placeholder="e.g. Jordan Smith"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                  disabled={creating}
                />
              </div>

              {formError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  {formSuccess}
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-accent/60"
                >
                  {creating && (
                    <span className="h-2 w-2 animate-ping rounded-full bg-white" />
                  )}
                  Create ambassador
                </button>
              </div>
            </form>

            <div className="rounded-3xl border border-slate-200/80 bg-white px-6 py-6 shadow-sm shadow-slate-200/60 sm:px-8 sm:py-8">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  Ambassadors
                </h2>
                <span className="text-xs text-slate-400">
                  {ambassadors.length} total
                </span>
              </div>

              {ambassadorsError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {ambassadorsError}
                </div>
              )}

              {ambassadorsLoading ? (
                <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                  Loading ambassadors…
                </div>
              ) : ambassadors.length === 0 ? (
                <p className="mt-6 text-sm text-slate-500">
                  No ambassadors yet. Create the first one to get started.
                </p>
              ) : (
                <ul className="mt-6 space-y-4">
                  {ambassadors.map((ambassador) => (
                    <li
                      key={ambassador.id}
                      className="flex flex-col gap-3 rounded-2xl border border-slate-200 px-4 py-4 shadow-sm shadow-slate-200/40 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {ambassador.name}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-[11px] uppercase tracking-wide text-slate-600">
                            {ambassador.code}
                          </span>
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                              ambassador.status === "active"
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {ambassador.status}
                          </span>
                          <span className="text-[11px]">
                            Added {formatTimestamp(ambassador.createdAt)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(ambassador.code)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        {copiedCode === ambassador.code ? (
                          <>
                            <span className="inline-block h-4 w-4">
                              <svg
                                viewBox="0 0 20 20"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                aria-hidden="true"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 10.5 8.5 14 15 6"
                                />
                              </svg>
                            </span>
                            Copied
                          </>
                        ) : (
                          <>
                            <span className="inline-block h-4 w-4">
                              <svg
                                viewBox="0 0 20 20"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                aria-hidden="true"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M7 5h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"
                                />
                              </svg>
                            </span>
                            Copy link
                          </>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white px-6 py-6 shadow-sm shadow-slate-200/60 sm:px-8 sm:py-8">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">
                Recent referrals
              </h2>
              <span className="text-xs text-slate-400">Last 25 clicks</span>
            </div>

            {referralsError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {referralsError}
              </div>
            )}

            {referralsLoading ? (
              <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                Loading referrals…
              </div>
            ) : referrals.length === 0 ? (
              <p className="mt-6 text-sm text-slate-500">
                No clicks recorded yet. Share a link to see activity here.
              </p>
            ) : (
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-400">
                      <th scope="col" className="pb-3 pr-6 font-semibold">
                        Code
                      </th>
                      <th scope="col" className="pb-3 pr-6 font-semibold">
                        Landing
                      </th>
                      <th scope="col" className="pb-3 pr-6 font-semibold">
                        Time
                      </th>
                      <th scope="col" className="pb-3 font-semibold">
                        Source
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {referrals.map((referral) => (
                      <tr key={referral.id} className="align-top">
                        <td className="py-3 pr-6 font-mono text-xs uppercase tracking-wide text-slate-600">
                          {referral.code}
                        </td>
                        <td className="py-3 pr-6 text-xs text-slate-600">
                          {referral.landing}
                        </td>
                        <td className="py-3 pr-6 text-xs text-slate-600">
                          {formatTimestamp(referral.ts)}
                        </td>
                        <td className="py-3 text-xs text-slate-500">
                          {referral.userAgent
                            ? referral.userAgent.slice(0, 72)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={async () => {
              try {
                await signOut();
              } catch (error) {
                console.error("Failed to sign out", error);
              }
            }}
            className="text-xs font-semibold text-slate-500 underline-offset-4 transition hover:text-accent hover:underline"
          >
            Sign out
          </button>
        </div>
      </div>
    </section>
  );
}
