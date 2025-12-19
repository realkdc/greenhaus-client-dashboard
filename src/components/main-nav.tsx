"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { name: "Home", href: "/" },
  { name: "Analytics", href: "/analytics" },
  { name: "Ambassadors", href: "/ambassadors" },
  { name: "Tools", href: "/tools" },
];

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MainNav(): JSX.Element {
  const pathname = usePathname();

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
    </div>
  );
}
