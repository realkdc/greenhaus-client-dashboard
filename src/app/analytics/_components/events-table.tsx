'use client';

type Event = {
  id: string;
  timestamp: string;
  eventType: string;
  userId: string | null;
  source: string;
  metadata: Record<string, unknown>;
};

type EventsTableProps = {
  events: Event[];
  loading?: boolean;
};

export default function EventsTable({
  events,
  loading = false,
}: EventsTableProps) {
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatMetadata = (metadata: Record<string, unknown>) => {
    try {
      const str = JSON.stringify(metadata);
      return str.length > 100 ? str.substring(0, 100) + '...' : str;
    } catch {
      return '{}';
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            Loading events...
          </div>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-center text-sm text-slate-500">
          No events found for the selected filters.
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Event Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Source
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Metadata
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {events.map((event) => (
              <tr key={event.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                  {formatTimestamp(event.timestamp)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">
                  {event.eventType}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                  {event.userId ? (
                    <span className="font-mono text-xs">
                      {event.userId.substring(0, 8)}...
                    </span>
                  ) : (
                    <span className="text-slate-400">Anonymous</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                  {event.source}
                </td>
                <td className="px-6 py-4 text-xs text-slate-600">
                  <code className="rounded bg-slate-100 px-2 py-1 font-mono">
                    {formatMetadata(event.metadata)}
                  </code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

