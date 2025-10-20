"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ReferralRedirectProps = {
  code: string;
  landing: string;
};

export default function ReferralRedirect({
  code,
  landing,
}: ReferralRedirectProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"pending" | "error">("pending");

  useEffect(() => {
    let cancelled = false;

    const logReferral = async () => {
      try {
        await fetch("/api/referrals", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code, landing }),
          cache: "no-store",
        });

        if (!cancelled) {
          // A micro-task delay helps ensure the response resolves in Next routing.
          setTimeout(() => router.replace(landing), 75);
        }
      } catch (error) {
        console.error("Failed to log referral", error);
        if (!cancelled) {
          setStatus("error");
          setTimeout(() => router.replace(landing), 200);
        }
      }
    };

    logReferral();
    return () => {
      cancelled = true;
    };
  }, [code, landing, router]);

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="text-sm font-medium text-slate-600">
        Taking you to GreenHaus…
      </span>
      <span className="text-xs text-slate-400">
        {status === "pending"
          ? "Recording your referral and redirecting."
          : "Redirecting now. If you are not redirected, tap the button below."}
      </span>
      {status === "error" && (
        <button
          type="button"
          onClick={() => router.replace(landing)}
          className="mt-2 rounded-full border border-accent px-3 py-1 text-xs font-semibold text-accent transition hover:bg-accent hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Continue
        </button>
      )}
    </div>
  );
}
