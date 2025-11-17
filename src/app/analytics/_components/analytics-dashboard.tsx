'use client';

import { useEffect, useState, useCallback } from 'react';
import SummaryCards from './summary-cards';
import EventCharts from './event-charts';
import EventsTable from './events-table';
import AnalyticsFilters from './analytics-filters';

type AnalyticsData = {
  summary: {
    totalUsers: number;
    newUsers30d: number;
    totalSessions30d: number;
    totalOrderClicks30d: number;
    totalCrewClicks30d: number;
  };
  dailyAppOpens: Array<{ date: string; count: number }>;
  dailyOrderClicks: Array<{ date: string; count: number }>;
  recentEvents: Array<{
    id: string;
    timestamp: string;
    eventType: string;
    userId: string | null;
    source: string;
    metadata: Record<string, unknown>;
  }>;
};

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    eventType: '',
  });

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
      });

      if (filters.eventType) {
        params.append('eventType', filters.eventType);
      }

      const response = await fetch(`/api/analytics?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load analytics data'
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleFilterChange = useCallback(
    (newFilters: typeof filters) => {
      setFilters(newFilters);
    },
    []
  );

  if (loading && !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2 text-sm text-slate-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          Loading analytics...
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <p className="font-medium">Error loading analytics</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Analytics Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">
          Monitor app usage, engagement, and key user actions
        </p>
      </div>

      <AnalyticsFilters onFilterChange={handleFilterChange} />

      <SummaryCards
        totalUsers={data.summary.totalUsers}
        newUsers30d={data.summary.newUsers30d}
        totalSessions30d={data.summary.totalSessions30d}
        totalOrderClicks30d={data.summary.totalOrderClicks30d}
        totalCrewClicks30d={data.summary.totalCrewClicks30d}
      />

      <EventCharts
        dailyAppOpens={data.dailyAppOpens}
        dailyOrderClicks={data.dailyOrderClicks}
      />

      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Recent Events
        </h2>
        <EventsTable events={data.recentEvents} loading={loading} />
      </div>
    </div>
  );
}

