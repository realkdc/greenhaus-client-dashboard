import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

type AnalyticsEvent = {
  eventType: string;
  source: string;
  userId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Timestamp;
};

type DailyEventCount = {
  date: string;
  count: number;
};

type AnalyticsResponse = {
  summary: {
    totalUsers: number;
    newUsers30d: number;
    totalSessions30d: number;
    totalOrderClicks30d: number;
    totalCrewClicks30d: number;
  };
  dailyAppOpens: DailyEventCount[];
  dailyOrderClicks: DailyEventCount[];
  dailyUsers: DailyEventCount[];
  recentEvents: Array<{
    id: string;
    timestamp: string;
    eventType: string;
    userId: string | null;
    source: string;
    metadata: Record<string, unknown>;
  }>;
};

/**
 * Get unique user count from analytics events
 */
async function getUniqueUserCount(
  startDate: Date,
  endDate: Date
): Promise<number> {
  try {
    const snapshot = await adminDb
      .collection("analytics_events")
      .where("createdAt", ">=", Timestamp.fromDate(startDate))
      .where("createdAt", "<=", Timestamp.fromDate(endDate))
      .where("userId", "!=", null)
      .get();

    const userIds = new Set<string>();
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.userId) {
        userIds.add(data.userId);
      }
    });

    return userIds.size;
  } catch (error) {
    console.error("[analytics] Error getting unique user count:", error);
    return 0;
  }
}

/**
 * Get event count for a specific event type in date range
 * Fetches by date range and filters client-side to avoid composite index requirements
 */
async function getEventCount(
  eventType: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  try {
    // Fetch events in date range (without eventType filter to avoid composite index)
    const snapshot = await adminDb
      .collection("analytics_events")
      .where("createdAt", ">=", Timestamp.fromDate(startDate))
      .where("createdAt", "<=", Timestamp.fromDate(endDate))
      .get();

    // Filter by eventType client-side
    let count = 0;
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.eventType === eventType) {
        count++;
      }
    });

    return count;
  } catch (error) {
    console.error(`[analytics] Error getting ${eventType} count:`, error);
    return 0;
  }
}

/**
 * Get daily event counts for a specific event type
 * Fetches by date range and filters client-side to avoid composite index requirements
 */
async function getDailyEventCounts(
  eventType: string,
  startDate: Date,
  endDate: Date
): Promise<DailyEventCount[]> {
  try {
    // Fetch events in date range (without eventType filter to avoid composite index)
    const snapshot = await adminDb
      .collection("analytics_events")
      .where("createdAt", ">=", Timestamp.fromDate(startDate))
      .where("createdAt", "<=", Timestamp.fromDate(endDate))
      .get();

    // Group by date, filtering by eventType client-side
    const dailyCounts = new Map<string, number>();
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.eventType === eventType) {
        const createdAt = data.createdAt as Timestamp;
        if (createdAt) {
          const date = createdAt.toDate().toISOString().split("T")[0];
          dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
        }
      }
    });

    // Fill in missing dates with 0
    const result: DailyEventCount[] = [];
    const currentDate = new Date(startDate);
    // Set time to start of day to avoid timezone issues
    currentDate.setHours(0, 0, 0, 0);
    const endDateCopy = new Date(endDate);
    endDateCopy.setHours(23, 59, 59, 999);
    
    while (currentDate <= endDateCopy) {
      const dateStr = currentDate.toISOString().split("T")[0];
      result.push({
        date: dateStr,
        count: dailyCounts.get(dateStr) || 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  } catch (error) {
    console.error(`[analytics] Error getting daily ${eventType} counts:`, error);
    return [];
  }
}

/**
 * Get recent events for the table
 * Note: If eventType filter is provided, we fetch more and filter client-side
 * to avoid Firestore composite index requirements
 */
async function getRecentEvents(
  limit: number = 50,
  eventType?: string
): Promise<
  Array<{
    id: string;
    timestamp: string;
    eventType: string;
    userId: string | null;
    source: string;
    metadata: Record<string, unknown>;
  }>
> {
  try {
    // Fetch more events if filtering by type (we'll filter client-side)
    const fetchLimit = eventType ? limit * 3 : limit;

    let query = adminDb
      .collection("analytics_events")
      .orderBy("createdAt", "desc")
      .limit(fetchLimit);

    const snapshot = await query.get();

    let events = snapshot.docs.map((doc) => {
      const data = doc.data() as AnalyticsEvent;
      return {
        id: doc.id,
        timestamp: data.createdAt
          ? data.createdAt.toDate().toISOString()
          : new Date().toISOString(),
        eventType: data.eventType,
        userId: data.userId,
        source: data.source,
        metadata: data.metadata || {},
      };
    });

    // Filter by eventType if specified
    if (eventType) {
      events = events.filter((e) => e.eventType === eventType);
    }

    // Return only the requested limit
    return events.slice(0, limit);
  } catch (error) {
    console.error("[analytics] Error getting recent events:", error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const eventTypeFilter = searchParams.get("eventType");

    // Default to last 7 days for faster loading (changed from 30)
    const endDate = endDateParam
      ? new Date(endDateParam)
      : new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Changed to 7 days
    startDate.setHours(0, 0, 0, 0);

    console.log(`[analytics] Fetching events from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // OPTIMIZATION: Fetch all events in date range ONCE
    const snapshot = await adminDb
      .collection("analytics_events")
      .where("createdAt", ">=", Timestamp.fromDate(startDate))
      .where("createdAt", "<=", Timestamp.fromDate(endDate))
      .limit(10000) // Add limit to prevent massive queries
      .get();

    console.log(`[analytics] Retrieved ${snapshot.docs.length} events`);

    // Process all metrics from the single query
    const userIds = new Set<string>();
    const dailyAppOpens = new Map<string, number>();
    const dailyCrewClicks = new Map<string, number>();
    const dailyUsers = new Map<string, Set<string>>(); // Track unique users per day
    let totalSessions = 0;
    let totalOrderClicks = 0;
    let totalCrewClicks = 0;

    const allEvents = snapshot.docs.map(doc => {
      const data = doc.data() as AnalyticsEvent;
      const date = data.createdAt.toDate().toISOString().split("T")[0];

      // Track unique users
      if (data.userId) {
        userIds.add(data.userId);

        // Track unique users per day
        if (!dailyUsers.has(date)) {
          dailyUsers.set(date, new Set<string>());
        }
        dailyUsers.get(date)!.add(data.userId);
      }

      // Count events by type
      if (data.eventType === "APP_OPEN") {
        totalSessions++;
        dailyAppOpens.set(date, (dailyAppOpens.get(date) || 0) + 1);
      } else if (data.eventType === "START_ORDER_CLICK") {
        totalOrderClicks++;
      } else if (data.eventType === "JOIN_CREW_CLICK") {
        totalCrewClicks++;
        dailyCrewClicks.set(date, (dailyCrewClicks.get(date) || 0) + 1);
      }

      return {
        id: doc.id,
        timestamp: data.createdAt.toDate().toISOString(),
        eventType: data.eventType,
        userId: data.userId,
        source: data.source,
        metadata: data.metadata || {},
      };
    });

    // Get recent events (limited to 50)
    let recentEvents = allEvents
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 50);

    if (eventTypeFilter) {
      recentEvents = recentEvents.filter(e => e.eventType === eventTypeFilter);
    }

    // Fill in missing dates with 0
    const dailyAppOpensArray: DailyEventCount[] = [];
    const dailyCrewClicksArray: DailyEventCount[] = [];
    const dailyUsersArray: DailyEventCount[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split("T")[0];
      dailyAppOpensArray.push({
        date: dateStr,
        count: dailyAppOpens.get(dateStr) || 0,
      });
      dailyCrewClicksArray.push({
        date: dateStr,
        count: dailyCrewClicks.get(dateStr) || 0,
      });
      dailyUsersArray.push({
        date: dateStr,
        count: dailyUsers.get(dateStr)?.size || 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const response: AnalyticsResponse = {
      summary: {
        totalUsers: userIds.size,
        newUsers30d: userIds.size, // Simplified - same as total for the period
        totalSessions30d: totalSessions,
        totalOrderClicks30d: totalOrderClicks,
        totalCrewClicks30d: totalCrewClicks,
      },
      dailyAppOpens: dailyAppOpensArray,
      dailyOrderClicks: dailyCrewClicksArray,
      dailyUsers: dailyUsersArray,
      recentEvents,
    };

    console.log(`[analytics] Returning ${recentEvents.length} recent events`);
    return NextResponse.json(response);
  } catch (error) {
    console.error("[analytics] Error in analytics API:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

