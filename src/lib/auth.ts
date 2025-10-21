import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

// Debug logging to show which env vars are loaded (values not shown for security)
const adminKeyLoaded = !!process.env.ADMIN_API_KEY;
const viteAdminKeyLoaded = !!process.env.NEXT_PUBLIC_VITE_ADMIN_API_KEY;
console.log("[auth] Environment variables loaded:", {
  ADMIN_API_KEY: adminKeyLoaded ? "✓" : "✗",
  NEXT_PUBLIC_VITE_ADMIN_API_KEY: viteAdminKeyLoaded ? "✓" : "✗"
});

export function getAdminKey(): { key: string; source: string } | null {
  const adminKey = process.env.ADMIN_API_KEY?.trim();
  const viteAdminKey = process.env.NEXT_PUBLIC_VITE_ADMIN_API_KEY?.trim();
  
  if (adminKey) {
    return { key: adminKey, source: "ADMIN_API_KEY" };
  }
  if (viteAdminKey) {
    return { key: viteAdminKey, source: "NEXT_PUBLIC_VITE_ADMIN_API_KEY" };
  }
  return null;
}

export function requireAdmin(request: NextRequest): NextResponse | null {
  const keyInfo = getAdminKey();
  const suppliedKey = request.headers.get("x-admin-key")?.trim();

  if (!keyInfo) {
    return NextResponse.json(
      {
        ok: false,
        error: "Server misconfiguration: admin key missing.",
      },
      { status: 500 },
    );
  }

  if (!suppliedKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  // Timing-safe comparison
  const expectedBuffer = Buffer.from(keyInfo.key, 'utf8');
  const suppliedBuffer = Buffer.from(suppliedKey, 'utf8');
  
  if (expectedBuffer.length !== suppliedBuffer.length || 
      !timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  // Log which key was used (name only, not value)
  console.log(`[auth] Admin key matched: ${keyInfo.source}`);
  return null;
}
