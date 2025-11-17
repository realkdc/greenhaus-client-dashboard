'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type DailyEventCount = {
  date: string;
  count: number;
};

type EventChartsProps = {
  dailyAppOpens: DailyEventCount[];
  dailyOrderClicks: DailyEventCount[];
};

export default function EventCharts({
  dailyAppOpens,
  dailyOrderClicks,
}: EventChartsProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-700">
          App Opens Per Day (30d)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dailyAppOpens}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#64748b"
              fontSize={12}
            />
            <YAxis stroke="#64748b" fontSize={12} />
            <Tooltip
              labelFormatter={(label) => formatDate(label as string)}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#3b82f6"
              strokeWidth={2}
              name="App Opens"
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-700">
          Order Clicks Per Day (30d)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dailyOrderClicks}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#64748b"
              fontSize={12}
            />
            <YAxis stroke="#64748b" fontSize={12} />
            <Tooltip
              labelFormatter={(label) => formatDate(label as string)}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#10b981"
              strokeWidth={2}
              name="Order Clicks"
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

