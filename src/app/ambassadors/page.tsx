'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, orderBy, query, doc, deleteDoc } from 'firebase/firestore';
import QRCode from 'qrcode';
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
  qrUrl: string;
  qrType: "public" | "staff";
  qrUrlPublic: string;
  qrUrlStaff?: string;
  scanCount: number;
  scanCountPublic?: number;
  scanCountStaff?: number;
  orders?: number;
  points?: number;
  createdAt: any;
  createdBy: string;
};

type QRModalProps = {
  ambassador: AmbassadorRecord;
  isOpen: boolean;
  onClose: () => void;
  qrType: "public" | "staff";
};

function QRModal({ ambassador, isOpen, onClose, qrType }: QRModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && ambassador) {
      generateQR();
    }
  }, [isOpen, ambassador, qrType]);

  const generateQR = async () => {
    setLoading(true);
    try {
      const url = qrType === "staff" ? ambassador.qrUrlStaff : ambassador.qrUrlPublic;
      if (!url) {
        throw new Error('QR URL not available');
      }
      
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      setQrDataUrl(qrDataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = () => {
    if (qrDataUrl) {
      const link = document.createElement('a');
      link.download = `ambassador-${ambassador.code}-${qrType}-qr.png`;
      link.href = qrDataUrl;
      link.click();
    }
  };

  const copyLink = async () => {
    try {
      const url = qrType === "staff" ? ambassador.qrUrlStaff : ambassador.qrUrlPublic;
      if (url) {
        await navigator.clipboard.writeText(url);
      }
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {qrType === "staff" ? "Staff QR Code" : "Public QR Code"}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-4">
            Code: <span className="font-mono font-semibold">{ambassador.code}</span>
          </p>
          
          {loading ? (
            <div className="w-64 h-64 mx-auto flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : qrDataUrl ? (
            <div className="space-y-4">
              <img src={qrDataUrl} alt="QR Code" className="mx-auto" />
              <div className="flex gap-2">
                <button
                  onClick={downloadQR}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                >
                  Download
                </button>
                <button
                  onClick={copyLink}
                  className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700"
                >
                  Copy Link
                </button>
              </div>
            </div>
          ) : (
            <div className="w-64 h-64 mx-auto flex items-center justify-center text-gray-500">
              Failed to generate QR code
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type AddAmbassadorModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    firstName: string;
    lastName: string;
    email?: string;
    handle?: string;
    tier: AmbassadorTier;
    qrType: "public" | "staff"
  }) => Promise<void>;
};

function AddAmbassadorModal({ isOpen, onClose, onSubmit }: AddAmbassadorModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [handle, setHandle] = useState('');
  const [tier, setTier] = useState<AmbassadorTier>("seed");
  const [qrType, setQrType] = useState<"public" | "staff">("public");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || undefined,
        handle: handle.trim() || undefined,
        tier,
        qrType,
      });
      setFirstName('');
      setLastName('');
      setEmail('');
      setHandle('');
      setTier('seed');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ambassador');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Add Ambassador</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
              First Name *
            </label>
            <input
              type="text"
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
              Last Name *
            </label>
            <input
              type="text"
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email (optional)
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="ambassador@email.com"
            />
          </div>

          <div>
            <label htmlFor="handle" className="block text-sm font-medium text-gray-700 mb-1">
              Instagram Handle (optional)
            </label>
            <input
              type="text"
              id="handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="@username"
            />
          </div>

          <div>
            <label htmlFor="tier" className="block text-sm font-medium text-gray-700 mb-1">
              Tier *
            </label>
            <select
              id="tier"
              value={tier}
              onChange={(e) => setTier(e.target.value as AmbassadorTier)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="seed">🌱 Seed</option>
              <option value="sprout">🌿 Sprout</option>
              <option value="bloom">🌸 Bloom</option>
              <option value="evergreen">🌲 Evergreen</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              QR Type
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="qrType"
                  value="public"
                  checked={qrType === "public"}
                  onChange={(e) => setQrType(e.target.value as "public" | "staff")}
                  className="mr-2"
                />
                <span className="text-sm">Public (anyone can scan)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="qrType"
                  value="staff"
                  checked={qrType === "staff"}
                  onChange={(e) => setQrType(e.target.value as "public" | "staff")}
                  className="mr-2"
                />
                <span className="text-sm">Staff (store Wi-Fi or PIN required)</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600">{error}</div>
          )}

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Ambassador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type EditAmbassadorModalProps = {
  ambassador: AmbassadorRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string, data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    handle?: string;
    tier?: AmbassadorTier;
    orders?: number;
    points?: number;
  }) => Promise<void>;
};

function EditAmbassadorModal({ ambassador, isOpen, onClose, onSubmit }: EditAmbassadorModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [handle, setHandle] = useState('');
  const [tier, setTier] = useState<AmbassadorTier>('seed');
  const [orders, setOrders] = useState(0);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ambassador) {
      setFirstName(ambassador.firstName || '');
      setLastName(ambassador.lastName || '');
      setEmail(ambassador.email || '');
      setHandle(ambassador.handle || '');
      setTier(ambassador.tier || 'seed');
      setOrders(ambassador.orders || 0);
      setPoints(ambassador.points || 0);
    }
  }, [ambassador]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ambassador) return;

    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit(ambassador.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || undefined,
        handle: handle.trim() || undefined,
        tier,
        orders,
        points,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update ambassador');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !ambassador) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Edit {ambassador.firstName} {ambassador.lastName}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-firstName" className="block text-sm font-medium text-gray-700 mb-1">
                First Name *
              </label>
              <input
                type="text"
                id="edit-firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="edit-lastName" className="block text-sm font-medium text-gray-700 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                id="edit-lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="edit-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email (optional)
            </label>
            <input
              type="email"
              id="edit-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="ambassador@email.com"
            />
          </div>

          <div>
            <label htmlFor="edit-handle" className="block text-sm font-medium text-gray-700 mb-1">
              Instagram Handle (optional)
            </label>
            <input
              type="text"
              id="edit-handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="@username"
            />
          </div>

          <div>
            <label htmlFor="edit-tier" className="block text-sm font-medium text-gray-700 mb-1">
              Tier *
            </label>
            <select
              id="edit-tier"
              value={tier}
              onChange={(e) => setTier(e.target.value as AmbassadorTier)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="seed">🌱 Seed</option>
              <option value="sprout">🌿 Sprout</option>
              <option value="bloom">🌸 Bloom</option>
              <option value="evergreen">🌲 Evergreen</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-orders" className="block text-sm font-medium text-gray-700 mb-1">
                Orders
              </label>
              <input
                type="number"
                id="edit-orders"
                value={orders}
                onChange={(e) => setOrders(parseInt(e.target.value) || 0)}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="edit-points" className="block text-sm font-medium text-gray-700 mb-1">
                Points
              </label>
              <input
                type="number"
                id="edit-points"
                value={points}
                onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600">{error}</div>
          )}

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AmbassadorsPage() {
  const { user, loading } = useAuth();
  const [ambassadors, setAmbassadors] = useState<AmbassadorRecord[]>([]);
  const [ambassadorsLoading, setAmbassadorsLoading] = useState(true);
  const [ambassadorsError, setAmbassadorsError] = useState<string | null>(null);
  const [selectedAmbassador, setSelectedAmbassador] = useState<AmbassadorRecord | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedQRType, setSelectedQRType] = useState<"public" | "staff">("public");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAmbassador, setEditingAmbassador] = useState<AmbassadorRecord | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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
            qrUrl: data.qrUrl || '',
            qrType: data.qrType || "public",
            qrUrlPublic: data.qrUrlPublic || data.qrUrl || '',
            qrUrlStaff: data.qrUrlStaff || undefined,
            scanCount: data.scanCount || 0,
            scanCountPublic: data.scanCountPublic || 0,
            scanCountStaff: data.scanCountStaff || 0,
            orders: data.orders || 0,
            points: data.points || 0,
            createdAt: data.createdAt || null,
            createdBy: data.createdBy || '',
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

  const handleShowQR = (ambassador: AmbassadorRecord, qrType: "public" | "staff") => {
    setSelectedAmbassador(ambassador);
    setSelectedQRType(qrType);
    setShowQRModal(true);
  };

  const handleEditAmbassador = (ambassador: AmbassadorRecord) => {
    setEditingAmbassador(ambassador);
    setShowEditModal(true);
  };

  const handleUpdateAmbassador = async (id: string, data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    handle?: string;
    tier?: AmbassadorTier;
    orders?: number;
    points?: number;
  }) => {
    const response = await fetch(`/api/ambassadors/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update ambassador');
    }
  };

  const handleAddAmbassador = async (data: { firstName: string; lastName: string; email?: string; handle?: string; tier: AmbassadorTier; qrType: "public" | "staff" }) => {
    const response = await fetch('/api/ambassadors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        createdBy: user?.email || 'unknown',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create ambassador');
    }
  };

  const handleDeleteAmbassador = async (id: string) => {
    if (!confirm('Are you sure you want to delete this ambassador?')) {
      return;
    }

    if (!db) {
      alert('Database not available. Please refresh and try again.');
      return;
    }

    try {
      await deleteDoc(doc(db, 'ambassadors', id));
    } catch (error) {
      console.error('Failed to delete ambassador:', error);
      alert('Failed to delete ambassador. Please try again.');
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const formatTimestamp = (ts: any): string => {
    if (!ts) return '—';
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(date);
    } catch {
      return '—';
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
          <span className="accent-pill mb-5">Ambassadors</span>
          <h1 className="text-3xl font-semibold text-slate-900">
            Sign in to manage ambassadors
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Log in with your GreenHaus Google account to view and manage ambassador tracking.
          </p>
        </div>
      </section>
    );
  }

  return (
    <RequireAuth>
      <section className="px-6 py-16">
        <div className="mx-auto w-full max-w-6xl space-y-10">
          <header className="flex flex-col gap-2">
            <span className="accent-pill w-fit">Ambassadors</span>
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-semibold text-slate-900">
                  Ambassador Tracking
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">
                  Track ambassador QR code scans and generate QR codes for easy access.
                </p>
              </div>
              <div className="flex gap-3">
                <Link
                  href="/ambassadors/leaderboard"
                  className="inline-flex items-center gap-2 rounded-full bg-slate-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Leaderboard
                </Link>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Ambassador
                </button>
              </div>
            </div>
          </header>

          <div className="rounded-3xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/60">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Ambassadors</h2>
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
            ) : ambassadors.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-slate-500">No ambassadors found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Tier
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        QR Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        QR Codes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Scans (Public)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Scans (Staff)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Orders
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Points
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {ambassadors.map((ambassador) => {
                      const tierDisplay = getTierDisplay(ambassador.tier);
                      return (
                      <tr key={ambassador.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900">
                            {ambassador.firstName} {ambassador.lastName}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-900">
                            {ambassador.email && (
                              <div className="text-xs text-slate-600">{ambassador.email}</div>
                            )}
                            {ambassador.handle && (
                              <div className="text-xs text-slate-500">@{ambassador.handle}</div>
                            )}
                            {!ambassador.email && !ambassador.handle && (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tierDisplay.color}`}>
                            {tierDisplay.emoji} {tierDisplay.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                              {ambassador.code}
                            </span>
                            <button
                              onClick={() => handleCopyCode(ambassador.code)}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              {copiedCode === ambassador.code ? (
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            ambassador.qrType === "staff" 
                              ? "bg-orange-100 text-orange-800" 
                              : "bg-green-100 text-green-800"
                          }`}>
                            {ambassador.qrType === "staff" ? "Staff" : "Public"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleShowQR(ambassador, "public")}
                              className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                            >
                              Public QR
                            </button>
                            {ambassador.qrType === "staff" && (
                              <button
                                onClick={() => handleShowQR(ambassador, "staff")}
                                className="text-orange-600 hover:text-orange-900 text-sm font-medium"
                              >
                                Staff QR
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {ambassador.scanCountPublic || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {ambassador.scanCountStaff || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {ambassador.orders || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {ambassador.points || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {formatTimestamp(ambassador.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditAmbassador(ambassador)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteAmbassador(ambassador.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </div>
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

        <QRModal
          ambassador={selectedAmbassador!}
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
          qrType={selectedQRType}
        />

        <AddAmbassadorModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddAmbassador}
        />

        <EditAmbassadorModal
          ambassador={editingAmbassador}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleUpdateAmbassador}
        />
      </section>
    </RequireAuth>
  );
}