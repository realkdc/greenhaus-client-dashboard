'use client';

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";

export default function RequireAuth({
  children,
}: {
  children: ReactNode;
}): JSX.Element | null {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      const search = new URLSearchParams({
        redirect: pathname || "/",
      });
      router.replace(`/auth/login?${search.toString()}`);
    }
  }, [loading, user, pathname, router]);

  if (loading || (!user && typeof window !== "undefined")) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2 text-sm text-slate-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          Checking access…
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
