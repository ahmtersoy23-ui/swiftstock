// Scanner hook for camera-based barcode scanning
import { useState, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, LensFacing, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Html5Qrcode } from 'html5-qrcode';
import { SCANNER_STARTUP_DELAY, MAX_RETRY } from '../utils/helpers';

const isNative = Capacitor.isNativePlatform();

interface UseScannerOptions {
  onScan: (barcode: string, source: 'hid' | 'camera') => void;
  onError: (message: string) => void;
  translations: {
    errorCameraPermissionDenied: string;
    errorCameraStartFailed: string;
    errorCameraOpenFailed: string;
  };
}

export function useScanner({ onScan, onError, translations }: UseScannerOptions) {
  const [cameraActive, setCameraActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const listenerRef = useRef<any>(null);
  const scannerActiveRef = useRef(false);
  const scannerReadyRef = useRef(false);
  const scannerRetryCount = useRef(0);

  const startNativeScanner = useCallback(async () => {
    if (scannerActiveRef.current) return;

    setCameraActive(true);
    scannerReadyRef.current = false;

    try {
      const { camera } = await BarcodeScanner.checkPermissions();
      if (camera !== 'granted') {
        const { camera: newStatus } = await BarcodeScanner.requestPermissions();
        if (newStatus !== 'granted') {
          onError(translations.errorCameraPermissionDenied);
          setCameraActive(false);
          return;
        }
      }

      try {
        await BarcodeScanner.stopScan();
        await BarcodeScanner.removeAllListeners();
      } catch (e) {}

      await BarcodeScanner.addListener('scanError', (event) => {
        console.error('Scanner error:', event);
      });

      listenerRef.current = await BarcodeScanner.addListener('barcodesScanned', async (event) => {
        console.log('[SCANNER] Barcodes received:', event.barcodes?.length || 0);

        if (!scannerReadyRef.current) {
          console.log('[SCANNER] Scanner not ready yet, ignoring');
          return;
        }

        if (event.barcodes && event.barcodes.length > 0) {
          const barcode = event.barcodes[0].rawValue;
          const format = event.barcodes[0].format;
          console.log('[SCANNER] Barcode detected:', barcode, 'Format:', format);

          if (barcode) {
            try {
              await onScan(barcode, 'camera');
              scannerRetryCount.current = 0;
            } catch (err) {
              console.error('[SCANNER] Scan processing error:', err);
            }
          }
        }
      });

      await BarcodeScanner.startScan({
        lensFacing: LensFacing.Back,
        formats: [
          BarcodeFormat.QrCode,
          BarcodeFormat.Code128,
          BarcodeFormat.Code39,
          BarcodeFormat.Code93,
          BarcodeFormat.Ean13,
          BarcodeFormat.Ean8,
          BarcodeFormat.UpcA,
          BarcodeFormat.UpcE,
          BarcodeFormat.Codabar,
        ],
      });

      scannerActiveRef.current = true;
      scannerRetryCount.current = 0;

      setTimeout(() => {
        scannerReadyRef.current = true;
      }, SCANNER_STARTUP_DELAY);
    } catch (err: any) {
      scannerActiveRef.current = false;
      scannerReadyRef.current = false;

      if (scannerRetryCount.current < MAX_RETRY) {
        scannerRetryCount.current++;
        setTimeout(() => startNativeScanner(), 500);
      } else {
        onError(translations.errorCameraStartFailed);
        setCameraActive(false);
        scannerRetryCount.current = 0;
      }
    }
  }, [onScan, onError, translations]);

  const stopNativeScanner = useCallback(async () => {
    scannerActiveRef.current = false;
    scannerReadyRef.current = false;
    try {
      await BarcodeScanner.stopScan();
    } catch (err) {}
    try {
      await BarcodeScanner.removeAllListeners();
    } catch (err) {}
    listenerRef.current = null;
    setCameraActive(false);
  }, []);

  const startWebCamera = useCallback(async () => {
    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          onScan(decodedText, 'camera');
        },
        () => {}
      );
      setCameraActive(true);
    } catch (err) {
      onError(translations.errorCameraOpenFailed);
    }
  }, [onScan, onError, translations]);

  const stopCamera = useCallback(async () => {
    if (isNative) {
      await stopNativeScanner();
    } else if (scannerRef.current && cameraActive) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {}
    }
    setCameraActive(false);
  }, [cameraActive, stopNativeScanner]);

  const toggleCamera = useCallback(async () => {
    if (cameraActive) {
      await stopCamera();
    } else {
      if (isNative) {
        await startNativeScanner();
      } else {
        await startWebCamera();
      }
    }
  }, [cameraActive, stopCamera, startNativeScanner, startWebCamera]);

  return {
    cameraActive,
    isNative,
    toggleCamera,
    stopCamera,
  };
}
