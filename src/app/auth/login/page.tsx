'use client';

import { useEffect, useMemo, useState } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";

export default function LoginPage(): JSX.Element {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const redirectPath = useMemo(() => {
    const redirectParam = searchParams?.get("redirect");
    if (redirectParam && redirectParam.startsWith("/")) {
      return redirectParam;
    }
    return "/promotions";
  }, [searchParams]);

  useEffect(() => {
    if (!loading && user) {
      router.replace(redirectPath);
    }
  }, [user, loading, router, redirectPath]);

  const handleGoogleSignIn = async () => {
    if (!auth) {
      setErrorMessage(
        "Firebase is not configured. Double-check your environment variables."
      );
      return;
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    setErrorMessage(null);
    setSubmitting(true);

    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      const firebaseError = error as { code?: string; message?: string } | undefined;

      if (
        firebaseError?.code === "auth/popup-blocked" ||
        firebaseError?.code === "auth/popup-closed-by-user"
      ) {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError) {
          const message =
            redirectError instanceof Error
              ? redirectError.message
              : "Unable to sign in with redirect. Please try again.";
          setErrorMessage(message);
        }
      } else {
        const message =
          firebaseError?.message ??
          (error instanceof Error
            ? error.message
            : "Unable to sign in with Google at this time.");
        setErrorMessage(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white px-8 py-12 text-center shadow-xl shadow-slate-200/40">
        <span className="accent-pill mb-5">Welcome back</span>
        <h1 className="text-3xl font-semibold text-slate-900">
          Sign in to GreenHaus Admin
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Use your GreenHaus Google account to access admin dashboards, manage
          stores, and launch promotions.
        </p>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={submitting}
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
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
          {submitting ? "Signing in…" : "Continue with Google"}
        </button>

        {errorMessage && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <p className="mt-6 text-xs text-slate-400">
          Having trouble? Contact{" "}
          <Link
            href="mailto:support@greenhaus.app"
            className="text-accent underline-offset-4 hover:underline"
          >
            support@greenhaus.app
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
