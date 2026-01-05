import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to:
  // - Root path (/) - shows deprecation screen
  // - Legal pages (privacy, terms)
  // - Auth/login pages (in case they need to see the login page)
  // - API routes (may be needed for some functionality)
  // - Static files (favicon, etc.)
  const allowedPaths = [
    "/",
    "/legal",
    "/auth",
    "/api",
    "/favicon.ico",
    "/_next",
    "/r/",
    "/s/",
  ];

  const isAllowed = allowedPaths.some((path) => {
    if (path === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(path);
  });

  // If not allowed, redirect to home page (deprecation screen)
  if (!isAllowed) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
