"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

const links = [
  { name: "Promotions", href: "/promotions" },
  { name: "Analytics", href: "/analytics" },
  { name: "Stores", href: "/stores" },
  { name: "Ambassadors", href: "/ambassadors" },
  { name: "Crew", href: "/crew" },
  { name: "Broadcast", href: "/broadcast" },
  { name: "Push Center", href: "/admin/push" },
  { name: "Settings", href: "/settings" },
];

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MainNav(): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    const next = pathname && pathname !== "/auth/login" ? pathname : "/promotions";
    router.push(`/auth/login?redirect=${encodeURIComponent(next)}`);
  };

  return (
    <div className="flex items-center gap-6">
      <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
        {links.map((link) => {
          const active = isActivePath(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`relative py-3 transition ${
                active
                  ? "font-semibold text-accent after:absolute after:bottom-1 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-accent after:content-['']"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {link.name}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3">
        {user ? (
          <>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {user.email}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Sign Out
            </button>
          </>
        ) : loading ? (
          <span className="text-xs text-slate-400">Loading…</span>
        ) : (
          <Link
            href="/auth/login"
            className="rounded-full border border-accent px-3 py-1 text-xs font-semibold text-accent transition hover:bg-accent hover:text-white"
          >
            Sign In
          </Link>
        )}
      </div>
    </div>
  );
}
