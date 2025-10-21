'use client';

import { useEffect, useState } from 'react';

interface Promo {
  id: string;
  title: string;
  body?: string;
  imageUrl?: string;
  ctaUrl?: string;
  startsAt?: string;
  endsAt?: string;
}

export default function DevPromosPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [env, setEnv] = useState('prod');
  const [storeId, setStoreId] = useState('store_123');
  const [limit, setLimit] = useState(5);

  const fetchPromos = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        env,
        storeId,
        limit: limit.toString(),
      });
      
      const response = await fetch(`/api/promotions?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setPromos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch promotions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromos();
  }, [env, storeId, limit]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Promotions API Test</h1>
          <p className="mt-2 text-gray-600">
            Test the /api/promotions endpoint with different parameters
          </p>
        </div>

        {/* Controls */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">Query Parameters</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Environment
              </label>
              <select
                value={env}
                onChange={(e) => setEnv(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="prod">Production</option>
                <option value="staging">Staging</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Store ID
              </label>
              <input
                type="text"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="store_123"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Limit
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 5)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          </div>
          <button
            onClick={fetchPromos}
            className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
          >
            Refresh
          </button>
        </div>

        {/* Results */}
        <div className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold">
              Results ({promos.length} promotions)
            </h2>
          </div>
          
          {loading && (
            <div className="px-6 py-8 text-center text-gray-500">
              Loading promotions...
            </div>
          )}
          
          {error && (
            <div className="px-6 py-8">
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">
                  <strong>Error:</strong> {error}
                </div>
              </div>
            </div>
          )}
          
          {!loading && !error && promos.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500">
              No promotions found matching the criteria.
            </div>
          )}
          
          {!loading && !error && promos.length > 0 && (
            <div className="divide-y divide-gray-200">
              {promos.map((promo) => (
                <div key={promo.id} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900">
                        {promo.title}
                      </h3>
                      {promo.body && (
                        <p className="mt-1 text-gray-600">{promo.body}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-500">
                        {promo.startsAt && (
                          <span>Starts: {new Date(promo.startsAt).toLocaleString()}</span>
                        )}
                        {promo.endsAt && (
                          <span>Ends: {new Date(promo.endsAt).toLocaleString()}</span>
                        )}
                      </div>
                      {promo.imageUrl && (
                        <div className="mt-2">
                          <img
                            src={promo.imageUrl}
                            alt={promo.title}
                            className="h-32 w-32 rounded object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      {promo.ctaUrl && (
                        <div className="mt-2">
                          <a
                            href={promo.ctaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-800"
                          >
                            {promo.ctaUrl}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* API URL */}
        <div className="mt-8 rounded-lg bg-gray-100 p-4">
          <h3 className="text-sm font-medium text-gray-700">API URL:</h3>
          <code className="mt-1 block text-sm text-gray-900">
            /api/promotions?env={env}&storeId={storeId}&limit={limit}
          </code>
        </div>
      </div>
    </div>
  );
}
