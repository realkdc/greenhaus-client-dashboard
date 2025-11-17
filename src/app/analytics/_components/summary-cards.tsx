'use client';

type SummaryCardsProps = {
  totalUsers: number;
  newUsers30d: number;
  totalSessions30d: number;
  totalOrderClicks30d: number;
  totalCrewClicks30d: number;
};

export default function SummaryCards({
  totalUsers,
  newUsers30d,
  totalSessions30d,
  totalOrderClicks30d,
  totalCrewClicks30d,
}: SummaryCardsProps) {
  const cards = [
    {
      title: 'Total App Users',
      value: totalUsers.toLocaleString(),
      description: 'All time unique users',
    },
    {
      title: 'New Users (30d)',
      value: newUsers30d.toLocaleString(),
      description: 'New users in last 30 days',
    },
    {
      title: 'App Sessions (30d)',
      value: totalSessions30d.toLocaleString(),
      description: 'APP_OPEN events',
    },
    {
      title: 'Order Clicks (30d)',
      value: totalOrderClicks30d.toLocaleString(),
      description: 'START_ORDER_CLICK events',
    },
    {
      title: 'Crew Clicks (30d)',
      value: totalCrewClicks30d.toLocaleString(),
      description: 'JOIN_CREW_CLICK events',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {card.title}
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {card.value}
          </div>
          <div className="mt-1 text-xs text-slate-600">{card.description}</div>
        </div>
      ))}
    </div>
  );
}

