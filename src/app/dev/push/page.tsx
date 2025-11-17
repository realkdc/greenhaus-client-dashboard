'use client';

import { useState } from 'react';

interface SummaryData {
  ok: boolean;
  env: string;
  storeId: string;
  counts: {
    total: number;
    ios: number;
    android: number;
  };
  sample: string[];
  queryUsed: {
    env: string;
    storeId: string;
  };
}

interface DryRunData {
  ok: boolean;
  dryRun: boolean;
  env: string;
  storeId: string;
  counts: {
    total: number;
    ios: number;
    android: number;
  };
  sample: string[];
  queryUsed: {
    env: string;
    storeId: string;
  };
  payload: {
    title: string;
    body: string;
    data?: any;
  };
}

export default function DevPushPage() {
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [dryRunData, setDryRunData] = useState<DryRunData | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    body: '',
    storeId: 'greenhaus-tn-crossville'
  });

  const fetchSummary = async (storeId: string) => {
    setLoading(`summary-${storeId}`);
    setError(null);
    
    try {
      const adminKey = process.env.NEXT_PUBLIC_VITE_ADMIN_API_KEY;
      const response = await fetch(`/api/push/debug/summary?env=prod&storeId=${storeId}&dryRun=true`, {
        headers: {
          'x-admin-key': adminKey || '',
        },
      });
      const data = await response.json();
      
      if (data.ok) {
        setSummaryData(data);
      } else {
        setError(data.error || 'Failed to fetch summary');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(null);
    }
  };

  const runDryRunBroadcast = async () => {
    setLoading('dryrun');
    setError(null);
    
    try {
      const adminKey = process.env.NEXT_PUBLIC_VITE_ADMIN_API_KEY;
      const response = await fetch(`/api/push/broadcast?dryRun=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey || '',
        },
        body: JSON.stringify({
          title: broadcastForm.title,
          body: broadcastForm.body,
          segment: {
            env: 'prod',
            storeId: broadcastForm.storeId
          }
        })
      });
      
      const data = await response.json();
      
      if (data.ok) {
        setDryRunData(data);
      } else {
        setError(data.error || 'Failed to run dry run');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Push Notification Dev Tools</h1>
        
        {/* Summary Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Store Summary</h2>
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => fetchSummary('greenhaus-tn-crossville')}
              disabled={loading === 'summary-greenhaus-tn-crossville'}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading === 'summary-greenhaus-tn-crossville' ? 'Loading...' : 'Summary: Crossville'}
            </button>
            <button
              onClick={() => fetchSummary('greenhaus-tn-cookeville')}
              disabled={loading === 'summary-greenhaus-tn-cookeville'}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading === 'summary-greenhaus-tn-cookeville' ? 'Loading...' : 'Summary: Cookeville'}
            </button>
          </div>
          
          {summaryData && (
            <div className="bg-gray-50 rounded p-4">
              <h3 className="font-semibold mb-2">Summary Results</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Store:</strong> {summaryData.storeId}
                </div>
                <div>
                  <strong>Environment:</strong> {summaryData.env}
                </div>
                <div>
                  <strong>Total Tokens:</strong> {summaryData.counts.total}
                </div>
                <div>
                  <strong>iOS:</strong> {summaryData.counts.ios}
                </div>
                <div>
                  <strong>Android:</strong> {summaryData.counts.android}
                </div>
              </div>
              {summaryData.sample.length > 0 && (
                <div className="mt-4">
                  <strong>Sample Tokens:</strong>
                  <ul className="list-disc list-inside text-xs text-gray-600">
                    {summaryData.sample.map((token, i) => (
                      <li key={i}>{token}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dry Run Broadcast Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Dry Run Broadcast</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={broadcastForm.title}
                onChange={(e) => setBroadcastForm({...broadcastForm, title: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Notification title"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Body
              </label>
              <textarea
                value={broadcastForm.body}
                onChange={(e) => setBroadcastForm({...broadcastForm, body: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Notification body"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Store
              </label>
              <select
                value={broadcastForm.storeId}
                onChange={(e) => setBroadcastForm({...broadcastForm, storeId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="greenhaus-tn-crossville">Crossville</option>
                <option value="greenhaus-tn-cookeville">Cookeville</option>
              </select>
            </div>
            
            <button
              onClick={runDryRunBroadcast}
              disabled={loading === 'dryrun' || !broadcastForm.title || !broadcastForm.body}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loading === 'dryrun' ? 'Running...' : 'Run Dry Run Broadcast'}
            </button>
          </div>
          
          {dryRunData && (
            <div className="mt-6 bg-gray-50 rounded p-4">
              <h3 className="font-semibold mb-2">Dry Run Results</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Store:</strong> {dryRunData.storeId}
                </div>
                <div>
                  <strong>Environment:</strong> {dryRunData.env}
                </div>
                <div>
                  <strong>Total Tokens:</strong> {dryRunData.counts.total}
                </div>
                <div>
                  <strong>iOS:</strong> {dryRunData.counts.ios}
                </div>
                <div>
                  <strong>Android:</strong> {dryRunData.counts.android}
                </div>
              </div>
              <div className="mt-4">
                <strong>Payload:</strong>
                <pre className="text-xs bg-white p-2 rounded mt-1 overflow-x-auto">
                  {JSON.stringify(dryRunData.payload, null, 2)}
                </pre>
              </div>
              {dryRunData.sample.length > 0 && (
                <div className="mt-4">
                  <strong>Sample Tokens:</strong>
                  <ul className="list-disc list-inside text-xs text-gray-600">
                    {dryRunData.sample.map((token, i) => (
                      <li key={i}>{token}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded p-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
