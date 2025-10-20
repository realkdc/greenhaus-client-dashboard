import { NextRequest, NextResponse } from "next/server";

export function getAdminKey(): string | null {
  return process.env.NEXT_PUBLIC_VITE_ADMIN_API_KEY?.trim() ?? null;
}

export function requireAdmin(request: NextRequest): NextResponse | null {
  const expectedKey = getAdminKey();
  const suppliedKey = request.headers.get("x-admin-key")?.trim();

  if (!expectedKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "Server misconfiguration: admin key missing.",
      },
      { status: 500 },
    );
  }

  if (!suppliedKey || suppliedKey !== expectedKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  return null;
}
