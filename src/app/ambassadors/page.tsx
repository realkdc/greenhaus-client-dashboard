'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, orderBy, query, where, doc, getDoc, setDoc, updateDoc, Timestamp, FieldValue } from 'firebase/firestore';
import QRCode from 'qrcode';
import RequireAuth from '@/components/require-auth';

type AmbassadorRecord = {
  id: string;
  name: string;
  code: string;
  codeLower: string;
  storeId: string;
  createdAt: Timestamp | null;
  uses: number;
};

type QRModalProps = {
  ambassador: AmbassadorRecord;
  isOpen: boolean;
  onClose: () => void;
};

function QRModal({ ambassador, isOpen, onClose }: QRModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && ambassador) {
      generateQR();
    }
  }, [isOpen, ambassador]);

  const generateQR = async () => {
    setLoading(true);
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const useUrl = `${baseUrl}/use?code=${encodeURIComponent(ambassador.code)}`;
      const qrDataUrl = await QRCode.toDataURL(useUrl, {
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
      link.download = `ambassador-${ambassador.code}-qr.png`;
      link.href = qrDataUrl;
      link.click();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">QR Code</h3>
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
              <button
                onClick={downloadQR}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
              >
                Download QR
              </button>
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

export default function AmbassadorsPage() {
  const { user, loading } = useAuth();
  const [ambassadors, setAmbassadors] = useState<AmbassadorRecord[]>([]);
  const [ambassadorsLoading, setAmbassadorsLoading] = useState(true);
  const [ambassadorsError, setAmbassadorsError] = useState<string | null>(null);
  const [selectedAmbassador, setSelectedAmbassador] = useState<AmbassadorRecord | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [exporting, setExporting] = useState(false);

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
            name: data.name || 'Untitled',
            code: data.code || docSnap.id,
            codeLower: data.codeLower || (data.code || docSnap.id).toLowerCase(),
            storeId: data.storeId || 'store_123',
            createdAt: data.createdAt || null,
            uses: data.uses || 0,
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

  const handleShowQR = (ambassador: AmbassadorRecord) => {
    setSelectedAmbassador(ambassador);
    setShowQRModal(true);
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const response = await fetch('/api/ambassadors/export.csv');
      if (!response.ok) {
        throw new Error('Failed to export CSV');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ambassadors.csv';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export CSV. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const formatTimestamp = (ts: Timestamp | null): string => {
    if (!ts) return '—';
    try {
      return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(ts.toDate());
    } catch {
      return '—';
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
                  Track ambassador code usage and generate QR codes for easy access.
                </p>
              </div>
              <div className="flex gap-2">
                <a
                  href="/ambassadors/scan"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  Scan QR
                </a>
                <button
                  onClick={handleExportCSV}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
                >
                  {exporting ? (
                    <>
                      <span className="h-2 w-2 animate-ping rounded-full bg-accent" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export CSV
                    </>
                  )}
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
                        Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Store
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Uses
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
                    {ambassadors.map((ambassador) => (
                      <tr key={ambassador.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900">
                            {ambassador.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                            {ambassador.code}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {ambassador.storeId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {ambassador.uses}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {formatTimestamp(ambassador.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleShowQR(ambassador)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            QR
                          </button>
                        </td>
                      </tr>
                    ))}
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
        />
      </section>
    </RequireAuth>
  );
}