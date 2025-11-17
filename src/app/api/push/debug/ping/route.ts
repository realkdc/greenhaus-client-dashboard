import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminKey } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  const keyInfo = getAdminKey();
  return NextResponse.json({
    ok: true,
    keyVarUsed: keyInfo?.source || "none"
  });
}
