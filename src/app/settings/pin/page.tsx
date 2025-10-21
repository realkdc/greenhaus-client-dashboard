'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';
import RequireAuth from '@/components/require-auth';

type PinStatus = {
  hasPin: boolean;
  updatedAt?: string;
  updatedBy?: string;
};

export default function PinSettingsPage() {
  const { user } = useAuth();
  const [pinStatus, setPinStatus] = useState<PinStatus | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadPinStatus();
  }, []);

  const loadPinStatus = async () => {
    try {
      setStatusLoading(true);
      const response = await fetch('/api/settings/pin', {
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_VITE_ADMIN_API_KEY!,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load PIN status');
      }

      const status = await response.json();
      setPinStatus(status);
    } catch (err) {
      console.error('Error loading PIN status:', err);
      setError('Failed to load PIN status');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Validation
    if (newPin !== confirmPin) {
      setError('PINs do not match');
      setLoading(false);
      return;
    }

    if (newPin.length < 3 || newPin.length > 6) {
      setError('PIN must be 3-6 digits');
      setLoading(false);
      return;
    }

    if (!/^\d+$/.test(newPin)) {
      setError('PIN must contain only digits');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/settings/pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_VITE_ADMIN_API_KEY!,
        },
        body: JSON.stringify({
          newPin,
          actorEmail: user?.email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update PIN');
      }

      setSuccess('Staff PIN updated successfully');
      setNewPin('');
      setConfirmPin('');
      await loadPinStatus();
    } catch (err) {
      console.error('Error updating PIN:', err);
      setError(err instanceof Error ? err.message : 'Failed to update PIN');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(dateString));
    } catch {
      return dateString;
    }
  };

  return (
    <RequireAuth>
      <section className="px-6 py-16">
        <div className="mx-auto w-full max-w-2xl space-y-8">
          <header className="flex flex-col gap-2">
            <span className="accent-pill w-fit">Settings</span>
            <h1 className="text-3xl font-semibold text-slate-900">
              Change Staff PIN
            </h1>
            <p className="text-sm text-slate-600">
              Set or update the store's staff PIN used for ambassador verification at the counter.
            </p>
          </header>

          {/* Current Status */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Current Status
            </h2>
            
            {statusLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                Loading PIN status...
              </div>
            ) : pinStatus?.hasPin ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-700">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">PIN is set</span>
                </div>
                {pinStatus.updatedAt && (
                  <p className="text-sm text-slate-600">
                    Updated {formatDate(pinStatus.updatedAt)}
                    {pinStatus.updatedBy && ` by ${pinStatus.updatedBy}`}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-700">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">No PIN set</span>
              </div>
            )}
          </div>

          {/* Update Form */}
          <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-6">
              Update Staff PIN
            </h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="newPin" className="block text-sm font-medium text-slate-700 mb-1">
                  New PIN
                </label>
                <input
                  type="password"
                  id="newPin"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 3-6 digit PIN"
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                  required
                />
                <p className="mt-1 text-xs text-slate-500">
                  Enter 3-6 digits only
                </p>
              </div>

              <div>
                <label htmlFor="confirmPin" className="block text-sm font-medium text-slate-700 mb-1">
                  Confirm PIN
                </label>
                <input
                  type="password"
                  id="confirmPin"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Confirm PIN"
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {success}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={loading || newPin.length < 3 || newPin !== confirmPin}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-accent/60"
              >
                {loading && (
                  <span className="h-2 w-2 animate-ping rounded-full bg-white" />
                )}
                Update PIN
              </button>
            </div>
          </form>
        </div>
      </section>
    </RequireAuth>
  );
}
