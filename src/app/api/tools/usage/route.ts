import { NextResponse } from "next/server";
import { getUsageStats, checkUsageLimit } from "@/lib/usage/tracker";

export async function GET() {
  try {
    const stats = await getUsageStats();
    const limitCheck = await checkUsageLimit();

    return NextResponse.json({
      currentCost: stats.currentMonth.totalCost,
      limit: limitCheck.limit,
      percentUsed: stats.percentUsed,
      requestCount: stats.currentMonth.requestCount,
      isWarning: stats.isWarning,
      isOverLimit: stats.isOverLimit,
      remainingCost: limitCheck.remainingCost,
      allowed: limitCheck.allowed,
    });
  } catch (error: any) {
    console.error("Error fetching usage stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage statistics" },
      { status: 500 }
    );
  }
}
