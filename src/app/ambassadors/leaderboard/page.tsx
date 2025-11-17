'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import Link from 'next/link';
import RequireAuth from '@/components/require-auth';

type AmbassadorTier = "seed" | "sprout" | "bloom" | "evergreen";

type AmbassadorRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  handle?: string;
  tier: AmbassadorTier;
  code: string;
  scanCountPublic?: number;
  scanCountStaff?: number;
  orders?: number;
  points?: number;
  createdAt: any;
};

type SortField = 'orders' | 'points' | 'scans';

export default function LeaderboardPage() {
  const { user, loading } = useAuth();
  const [ambassadors, setAmbassadors] = useState<AmbassadorRecord[]>([]);
  const [ambassadorsLoading, setAmbassadorsLoading] = useState(true);
  const [ambassadorsError, setAmbassadorsError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortField>('orders');

  useEffect(() => {
    if (!db) {
      setAmbassadorsLoading(false);
      setAmbassadorsError('Firestore is not configured. Set NEXT_PUBLIC_FIREBASE_* env vars.');
      return;
    }

    const ambassadorsQuery = query(
      collection(db, 'ambassadors'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      ambassadorsQuery,
      (snapshot) => {
        const next: AmbassadorRecord[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || undefined,
            handle: data.handle || undefined,
            tier: data.tier || 'seed',
            code: data.code || '',
            scanCountPublic: data.scanCountPublic || 0,
            scanCountStaff: data.scanCountStaff || 0,
            orders: data.orders || 0,
            points: data.points || 0,
            createdAt: data.createdAt || null,
          };
        });
        setAmbassadors(next);
        setAmbassadorsLoading(false);
        setAmbassadorsError(null);
      },
      (error) => {
        console.error('Failed to load ambassadors', error);
        setAmbassadorsError('Unable to load ambassadors. Refresh and try again.');
        setAmbassadorsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const getSortedAmbassadors = () => {
    const sorted = [...ambassadors];
    switch (sortBy) {
      case 'orders':
        return sorted.sort((a, b) => (b.orders || 0) - (a.orders || 0));
      case 'points':
        return sorted.sort((a, b) => (b.points || 0) - (a.points || 0));
      case 'scans':
        return sorted.sort((a, b) => {
          const aScans = (a.scanCountPublic || 0) + (a.scanCountStaff || 0);
          const bScans = (b.scanCountPublic || 0) + (b.scanCountStaff || 0);
          return bScans - aScans;
        });
      default:
        return sorted;
    }
  };

  const getTierDisplay = (tier: AmbassadorTier): { emoji: string; label: string; color: string } => {
    const tierConfig = {
      seed: { emoji: '🌱', label: 'Seed', color: 'bg-green-100 text-green-800' },
      sprout: { emoji: '🌿', label: 'Sprout', color: 'bg-emerald-100 text-emerald-800' },
      bloom: { emoji: '🌸', label: 'Bloom', color: 'bg-pink-100 text-pink-800' },
      evergreen: { emoji: '🌲', label: 'Evergreen', color: 'bg-teal-100 text-teal-800' },
    };
    return tierConfig[tier] || tierConfig.seed;
  };

  const getMedalEmoji = (rank: number): string => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  if (loading) {
    return (
      <section className="flex min-h-[360px] items-center justify-center px-6 py-16">
        <div className="flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2 text-sm text-slate-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          Loading your session…
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="flex min-h-[420px] items-center justify-center px-6 py-20">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white px-8 py-12 text-center shadow-xl shadow-slate-200/40">
          <span className="accent-pill mb-5">Leaderboard</span>
          <h1 className="text-3xl font-semibold text-slate-900">
            Sign in to view leaderboard
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Log in with your GreenHaus Google account to view the ambassador leaderboard.
          </p>
        </div>
      </section>
    );
  }

  const sortedAmbassadors = getSortedAmbassadors();

  return (
    <RequireAuth>
      <section className="px-6 py-16">
        <div className="mx-auto w-full max-w-6xl space-y-10">
          <header className="flex flex-col gap-2">
            <span className="accent-pill w-fit">Leaderboard</span>
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-semibold text-slate-900">
                  Ambassador Leaderboard
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">
                  Top performing ambassadors ranked by orders, points, and scans.
                </p>
              </div>
              <Link
                href="/ambassadors"
                className="inline-flex items-center gap-2 rounded-full bg-slate-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Ambassadors
              </Link>
            </div>
          </header>

          <div className="rounded-3xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/60">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900">Rankings</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setSortBy('orders')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                    sortBy === 'orders'
                      ? 'bg-accent text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Sort by Orders
                </button>
                <button
                  onClick={() => setSortBy('points')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                    sortBy === 'points'
                      ? 'bg-accent text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Sort by Points
                </button>
                <button
                  onClick={() => setSortBy('scans')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                    sortBy === 'scans'
                      ? 'bg-accent text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Sort by Scans
                </button>
              </div>
            </div>

            {ambassadorsError && (
              <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {ambassadorsError}
              </div>
            )}

            {ambassadorsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                  Loading ambassadors…
                </div>
              </div>
            ) : sortedAmbassadors.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-slate-500">No ambassadors found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Rank
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Tier
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Orders
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Points
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Total Scans
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {sortedAmbassadors.map((ambassador, index) => {
                      const tierDisplay = getTierDisplay(ambassador.tier);
                      const rank = index + 1;
                      const totalScans = (ambassador.scanCountPublic || 0) + (ambassador.scanCountStaff || 0);

                      return (
                        <tr key={ambassador.id} className={`hover:bg-slate-50 ${rank <= 3 ? 'bg-yellow-50/30' : ''}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-2xl font-bold">
                              {getMedalEmoji(rank)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-slate-900">
                              {ambassador.firstName} {ambassador.lastName}
                            </div>
                            {ambassador.handle && (
                              <div className="text-xs text-slate-500">@{ambassador.handle}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tierDisplay.color}`}>
                              {tierDisplay.emoji} {tierDisplay.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                              {ambassador.code}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">
                            {ambassador.orders || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">
                            {ambassador.points || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                            {totalScans}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
    </RequireAuth>
  );
}
