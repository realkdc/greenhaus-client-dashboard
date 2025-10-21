'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useRouter } from 'next/navigation';

export default function ScanPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const router = useRouter();

  useEffect(() => {
    const startScanning = async () => {
      try {
        const scanner = new Html5QrcodeScanner(
          'qr-reader',
          {
            qrbox: { width: 250, height: 250 },
            fps: 5,
          },
          false
        );

        scanner.render(
          (decodedText) => {
            handleScanResult(decodedText);
          },
          (error) => {
            // Ignore common scanning errors
            if (error && !error.includes('NotFoundException')) {
              console.log('QR Code scan error:', error);
            }
          }
        );

        scannerRef.current = scanner;
        setIsScanning(true);
      } catch (err) {
        console.error('Error starting scanner:', err);
        setError('Failed to start camera. Please check permissions.');
      }
    };

    startScanning();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    };
  }, []);

  const handleScanResult = (decodedText: string) => {
    try {
      // Check if it's a URL with code parameter
      const url = new URL(decodedText);
      const code = url.searchParams.get('code');
      
      if (code) {
        // Navigate to use page with the code
        router.push(`/use?code=${encodeURIComponent(code)}`);
        return;
      }
    } catch {
      // Not a URL, might be a raw code
    }

    // If it's not a URL, treat it as a raw code
    router.push(`/use?code=${encodeURIComponent(decodedText)}`);
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="flex-1 flex flex-col">
        <div className="bg-white p-4 flex justify-between items-center">
          <h1 className="text-lg font-semibold text-gray-900">Scan QR Code</h1>
          <button
            onClick={handleCancel}
            className="text-gray-600 hover:text-gray-800"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center">
          {error ? (
            <div className="text-center p-8">
              <div className="text-red-500 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Camera Error</h2>
              <p className="text-gray-300 mb-4">{error}</p>
              <button
                onClick={handleCancel}
                className="bg-white text-black px-6 py-2 rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <div id="qr-reader" className="w-full max-w-md"></div>
              <div className="mt-8 text-center">
                <p className="text-white text-lg mb-2">Point your camera at a QR code</p>
                <p className="text-gray-300 text-sm">The code will be automatically detected</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
