'use client';

import { useState } from 'react';

type AnalyticsFiltersProps = {
  onFilterChange: (filters: {
    startDate: string;
    endDate: string;
    eventType: string;
  }) => void;
};

const EVENT_TYPES = [
  { value: '', label: 'All Events' },
  { value: 'APP_OPEN', label: 'App Opens' },
  { value: 'VIEW_TAB', label: 'View Tab' },
  { value: 'START_ORDER_CLICK', label: 'Start Order Clicks' },
  { value: 'JOIN_CREW_CLICK', label: 'Join Crew Clicks' },
  { value: 'PUSH_OPEN', label: 'Push Opens' },
  { value: 'REFERRAL_LINK_CLICK', label: 'Referral Link Clicks' },
];

export default function AnalyticsFilters({
  onFilterChange,
}: AnalyticsFiltersProps) {
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [startDate, setStartDate] = useState(
    sevenDaysAgo.toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const [eventType, setEventType] = useState('');

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartDate = e.target.value;
    setStartDate(newStartDate);
    onFilterChange({ startDate: newStartDate, endDate, eventType });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEndDate = e.target.value;
    setEndDate(newEndDate);
    onFilterChange({ startDate, endDate: newEndDate, eventType });
  };

  const handleEventTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newEventType = e.target.value;
    setEventType(newEventType);
    onFilterChange({ startDate, endDate, eventType: newEventType });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor="start-date"
            className="block text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            Start Date
          </label>
          <input
            type="date"
            id="start-date"
            value={startDate}
            onChange={handleStartDateChange}
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label
            htmlFor="end-date"
            className="block text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            End Date
          </label>
          <input
            type="date"
            id="end-date"
            value={endDate}
            onChange={handleEndDateChange}
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label
            htmlFor="event-type"
            className="block text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            Event Type
          </label>
          <select
            id="event-type"
            value={eventType}
            onChange={handleEventTypeChange}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {EVENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

