"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Campaign {
  title: string;
  body: string;
  env: string;
  storeId: string;
  timestamp: number;
}

interface BroadcastResult {
  queued: number;
  success: number;
  failed: number;
}

export default function BroadcastPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: "",
    body: "",
    env: "prod",
    storeId: "store_123",
  });
  const [testToken, setTestToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [campaignHistory, setCampaignHistory] = useState<Campaign[]>([]);

  // Load campaign history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("broadcast-campaigns");
    if (saved) {
      try {
        setCampaignHistory(JSON.parse(saved));
      } catch (e) {
        console.warn("Failed to parse campaign history from localStorage");
      }
    }
  }, []);

  // Save campaign to history
  const saveCampaignToHistory = (campaign: Campaign) => {
    const newHistory = [campaign, ...campaignHistory].slice(0, 10);
    setCampaignHistory(newHistory);
    localStorage.setItem("broadcast-campaigns", JSON.stringify(newHistory));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      setError("Title is required");
      return false;
    }
    if (!formData.body.trim()) {
      setError("Body is required");
      return false;
    }
    return true;
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setResult(null);

    try {
      const response = await fetch("/api/push/broadcast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": process.env.NEXT_PUBLIC_VITE_ADMIN_API_KEY || "",
        },
        body: JSON.stringify({
          title: formData.title,
          body: formData.body,
          segment: {
            env: formData.env,
            storeId: formData.storeId,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send broadcast");
      }

      if (data.ok) {
        setResult({
          queued: data.queued || 0,
          success: data.success || 0,
          failed: data.failed || 0,
        });
        setSuccess(`Broadcast sent successfully! Queued: ${data.queued || 0}`);
        
        // Save to history
        saveCampaignToHistory({
          title: formData.title,
          body: formData.body,
          env: formData.env,
          storeId: formData.storeId,
          timestamp: Date.now(),
        });
      } else {
        throw new Error(data.error || "Unknown error occurred");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send broadcast");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testToken.trim()) {
      setError("Test token is required");
      return;
    }
    if (!formData.title.trim() || !formData.body.trim()) {
      setError("Title and body are required for test send");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": process.env.NEXT_PUBLIC_VITE_ADMIN_API_KEY || "",
        },
        body: JSON.stringify({
          to: testToken,
          title: formData.title,
          body: formData.body,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send test notification");
      }

      if (data.ok) {
        setSuccess("Test notification sent successfully!");
      } else {
        throw new Error(data.error || "Unknown error occurred");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send test notification");
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Broadcast Push Notifications</h1>
        <p className="mt-2 text-slate-600">
          Send push notifications to your users with segment targeting.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Main Form */}
        <div className="space-y-6">
          <form onSubmit={handleBroadcast} className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-slate-700">
                Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="Notification title"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="body" className="block text-sm font-medium text-slate-700">
                Body *
              </label>
              <textarea
                id="body"
                name="body"
                value={formData.body}
                onChange={handleInputChange}
                rows={4}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="Notification message"
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="env" className="block text-sm font-medium text-slate-700">
                  Environment
                </label>
                <select
                  id="env"
                  name="env"
                  value={formData.env}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  disabled={isLoading}
                >
                  <option value="prod">Production</option>
                  <option value="staging">Staging</option>
                </select>
              </div>

              <div>
                <label htmlFor="storeId" className="block text-sm font-medium text-slate-700">
                  Store ID
                </label>
                <input
                  type="text"
                  id="storeId"
                  name="storeId"
                  value={formData.storeId}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="store_123"
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Sending..." : "Send Broadcast"}
            </button>
          </form>

          {/* Test Token Form */}
          <div className="border-t border-slate-200 pt-6">
            <h3 className="text-sm font-medium text-slate-700 mb-3">Send Test to Token</h3>
            <form onSubmit={handleTestSend} className="space-y-3">
              <div>
                <input
                  type="text"
                  value={testToken}
                  onChange={(e) => setTestToken(e.target.value)}
                  className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="Expo push token"
                  disabled={isLoading}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Sending..." : "Send Test"}
              </button>
            </form>
          </div>
        </div>

        {/* Results and History */}
        <div className="space-y-6">
          {/* Result Summary */}
          {result && (
            <div className="rounded-md bg-green-50 p-4">
              <h3 className="text-sm font-medium text-green-800 mb-2">Broadcast Results</h3>
              <div className="space-y-1 text-sm text-green-700">
                <div>Queued: {result.queued}</div>
                <div>Success: {result.success}</div>
                <div>Failed: {result.failed}</div>
              </div>
            </div>
          )}

          {/* Success/Error Messages */}
          {success && (
            <div className="rounded-md bg-green-50 p-4">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Campaign History */}
          {campaignHistory.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-3">Recent Campaigns</h3>
              <div className="space-y-2">
                {campaignHistory.map((campaign, index) => (
                  <div key={index} className="rounded-md border border-slate-200 p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-900">{campaign.title}</div>
                        <div className="text-xs text-slate-500 mt-1">{campaign.body}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          {campaign.env} • {campaign.storeId}
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 ml-2">
                        {formatTimestamp(campaign.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 border-t border-slate-200 pt-6">
        <div className="flex justify-center space-x-4 text-xs text-slate-500">
          <a href="/legal/privacy" className="hover:text-slate-700">
            Privacy Policy
          </a>
          <span>•</span>
          <a href="/legal/terms" className="hover:text-slate-700">
            Terms of Service
          </a>
        </div>
      </div>
    </div>
  );
}
