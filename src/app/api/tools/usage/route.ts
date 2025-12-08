import { NextResponse } from "next/server";
import { getUsageStats } from "@/lib/usage/tracker";

export async function GET() {
  try {
    const stats = await getUsageStats();

    return NextResponse.json({
      currentCost: stats.currentMonth.totalCost,
      limit: 5.0,
      percentUsed: stats.percentUsed,
      requestCount: stats.currentMonth.requestCount,
      isWarning: stats.isWarning,
      isOverLimit: stats.isOverLimit,
      remainingCost: 5.0 - stats.currentMonth.totalCost,
    });
  } catch (error: any) {
    console.error("Error fetching usage stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage statistics" },
      { status: 500 }
    );
  }
}
