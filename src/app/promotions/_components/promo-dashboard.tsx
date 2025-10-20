'use client';

import { useCallback, useEffect, useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { isAdmin } from "@/lib/auth";
import PromoForm from "./promo-form";
import PromoTable from "./promo-table";
import SignInCard from "./sign-in-card";

type ToastState = {
  type: "success" | "error";
  message: string;
};

export default function PromoDashboard(): JSX.Element {
  const { user, loading, signOut } = useAuth();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (toast) {
      timer = setTimeout(() => {
        setToast(null);
      }, 3500);
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [toast]);

  const showToast = useCallback((nextToast: ToastState) => {
    setToast(nextToast);
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    if (!auth) {
      setSignInError(
        "Firebase Auth is not configured. Check your environment variables."
      );
      return;
    }

    setSignInError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to sign in with Google right now.";
      console.error("Failed to sign in", error);
      setSignInError(message);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      showToast({ type: "success", message: "Signed out" });
    } catch (error) {
      console.error("Failed to sign out", error);
      showToast({
        type: "error",
        message: "We couldn't sign you out. Try again.",
      });
    }
  }, [showToast, signOut]);

  if (loading) {
    return (
      <section className="flex min-h-[360px] items-center justify-center px-6 py-16">
        <div className="flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2 text-sm text-slate-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          Checking access…
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="flex min-h-[480px] items-center justify-center px-6 py-20">
        <SignInCard
          onSignIn={handleGoogleSignIn}
          errorMessage={signInError}
        />
      </section>
    );
  }

  const canPublish = isAdmin(user.email);

  return (
    <section className="flex min-h-full justify-center px-6 py-16">
      <div className="w-full max-w-5xl space-y-8">
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

        <div className="flex items-center justify-between text-sm text-slate-500">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Signed in as
            </span>
            <span className="font-medium text-slate-900">{user.email}</span>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-xs font-semibold text-slate-500 underline-offset-4 transition hover:text-accent hover:underline"
          >
            Sign out
          </button>
        </div>

        <PromoForm
          canPublish={canPublish}
          userEmail={user.email ?? "unknown@greenhaus.app"}
          onSuccess={() =>
            showToast({ type: "success", message: "Promo saved" })
          }
          onError={(message) =>
            showToast({ type: "error", message: message || "Something failed" })
          }
        />

        <PromoTable
          onError={(message) =>
            showToast({ type: "error", message: message || "Something failed" })
          }
        />
      </div>
    </section>
  );
}
