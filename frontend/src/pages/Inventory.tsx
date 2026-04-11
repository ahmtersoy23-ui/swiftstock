import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Html5Qrcode } from 'html5-qrcode';
import { useStore } from '../stores/appStore';
import { apiClient } from '../lib/api';
import { translations } from '../i18n/translations';

const isNative = Capacitor.isNativePlatform();

type QueryMode = 'SKU' | 'LOCATION' | 'SERIAL' | 'CONTAINER';

interface LocationInventoryItem {
  sku_code: string;
  product_name: string;
  quantity_each: number;
  quantity_box: number;
  quantity_pallet: number;
}

interface SKUInventoryItem {
  location_code: string;
  zone: string;
  quantity_each: number;
  quantity_box: number;
  quantity_pallet: number;
}

interface SerialHistoryEvent {
  history_id: number;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  from_location: string | null;
  to_location: string | null;
  from_warehouse: string | null;
  to_warehouse: string | null;
  performed_by: string | null;
  session_mode: string | null;
  notes: string | null;
  created_at: string;
}

interface SerialInfo {
  serial_id: number;
  full_barcode: string;
  sku_code: string;
  serial_no: string;
  product_name: string;
  status: string;
  created_at: string;
  last_scanned_at: string | null;
}

interface SerialHistoryData {
  serial: SerialInfo;
  history: SerialHistoryEvent[];
  scan_operations: Array<{ operation_id: number; operation_type: string; scanned_at: string }>;
}

interface ContainerContent {
  sku_code: string;
  product_name: string;
  product_barcode: string;
  quantity: number;
}

interface ContainerData {
  container: {
    container_id: number;
    barcode: string;
    container_type: 'BOX' | 'PALLET';
    warehouse_id: number;
    location_id: number | null;
    status: string;
    created_by: string;
    created_at: string;
    opened_at: string | null;
    notes: string | null;
  };
  contents: ContainerContent[];
}

const zoneTagClasses: Record<string, string> = {
  picking: 'bg-primary-100 text-primary-700',
  storage: 'bg-success-100 text-success-700',
  receiving: 'bg-warning-100 text-warning-700',
  shipping: 'bg-info-100 text-info-700',
};

const serialStatusClasses: Record<string, string> = {
  AVAILABLE: 'bg-primary-100 text-primary-700',
  IN_STOCK: 'bg-success-100 text-success-700',
  SHIPPED: 'bg-info-100 text-info-700',
  USED: 'bg-error-100 text-error-700',
};

const containerStatusClasses: Record<string, string> = {
  active: 'bg-success-500',
  opened: 'bg-primary-500',
  closed: 'bg-slate-500',
};

function Inventory() {
  const navigate = useNavigate();
  const { currentWarehouse, language } = useStore();
  const t = translations[language];
  const [queryMode, setQueryMode] = useState<QueryMode>('SKU');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [isNativeScanning, setIsNativeScanning] = useState(false);

  // SKU Query Results
  const [skuResults, setSkuResults] = useState<SKUInventoryItem[]>([]);
  const [skuInfo, setSkuInfo] = useState<{ sku_code: string; product_name: string; barcode?: string } | null>(null);

  // Location Query Results
  const [locationResults, setLocationResults] = useState<LocationInventoryItem[]>([]);
  const [locationInfo, setLocationInfo] = useState<{ location_id: number; location_code: string; zone?: string } | null>(null);

  // Serial History Results
  const [serialHistory, setSerialHistory] = useState<SerialHistoryData | null>(null);

  // Container Results
  const [containerData, setContainerData] = useState<ContainerData | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [queryMode]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setSkuResults([]);
    setLocationResults([]);
    setSkuInfo(null);
    setLocationInfo(null);
    setSerialHistory(null);
    setContainerData(null);
    setShowCamera(false);

    try {
      if (queryMode === 'SKU') {
        // Search by SKU
        const response = await apiClient.getInventoryBySku(query, currentWarehouse);
        if (response.success && response.data) {
          setSkuInfo(response.data.product);
          setSkuResults(response.data.locations || []);
        }
      } else if (queryMode === 'LOCATION') {
        // Search by Location
        const locationResponse = await fetch(
          `/api/locations/code/${query}`
        );
        const locationData = await locationResponse.json();

        if (locationData.success) {
          setLocationInfo(locationData.data);

          // Get inventory for this location
          const inventoryResponse = await fetch(
            `/api/locations/${locationData.data.location_id}/inventory`
          );
          const inventoryData = await inventoryResponse.json();

          if (inventoryData.success) {
            setLocationResults(inventoryData.data || []);
          }
        }
      } else if (queryMode === 'SERIAL') {
        // Search by Serial Number
        const response = await apiClient.getSerialHistory(query);
        if (response.success && response.data) {
          setSerialHistory(response.data as SerialHistoryData);
        } else {
          setError(language === 'tr' ? 'Seri numara bulunamadı' : 'Serial number not found');
        }
      } else if (queryMode === 'CONTAINER') {
        // Search by Container Barcode (KOL-XXXXX or PAL-XXXXX)
        const response = await apiClient.getContainerByBarcode(query);
        if (response.success && response.data) {
          setContainerData(response.data as ContainerData);
        } else {
          setError(language === 'tr' ? 'Koli/Palet bulunamadı' : 'Container not found');
        }
      }
    } catch {
      if (queryMode === 'SERIAL') {
        setError(language === 'tr' ? 'Seri numara bulunamadı' : 'Serial number not found');
      } else if (queryMode === 'CONTAINER') {
        setError(language === 'tr' ? 'Koli/Palet bulunamadı' : 'Container not found');
      } else {
        setError(
          queryMode === 'SKU'
            ? t.productNotFound
            : t.locationNotFound
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch(searchInput);
    }
  };

  const startWebCamera = async () => {
    try {
      setShowCamera(true);
      await new Promise(resolve => setTimeout(resolve, 100));

      const html5QrCode = new Html5Qrcode('inventory-qr-reader');
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 100 } },
        (decodedText) => {
          setSearchInput(decodedText);
          stopCamera();
          handleSearch(decodedText);
        },
        () => {}
      );
    } catch (err) {
      console.error('Web camera error:', err);
      setShowCamera(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch { /* ignore stop errors */ }
      html5QrCodeRef.current = null;
    }
    setShowCamera(false);
  };

  const startNativeScan = async () => {
    try {
      setIsNativeScanning(true);
      const { barcodes } = await BarcodeScanner.scan({
        formats: [BarcodeFormat.QrCode, BarcodeFormat.Code128, BarcodeFormat.Ean13, BarcodeFormat.Ean8],
      });
      if (barcodes.length > 0) {
        const barcode = barcodes[0].rawValue || '';
        setSearchInput(barcode);
        handleSearch(barcode);
      }
    } catch (err) {
      console.error('Native scan error:', err);
    } finally {
      setIsNativeScanning(false);
    }
  };

  const toggleCamera = () => {
    if (showCamera) {
      stopCamera();
    } else if (isNative) {
      startNativeScan();
    } else {
      startWebCamera();
    }
  };

  const getTotalByType = (items: Array<{ quantity_each?: number; quantity_box?: number; quantity_pallet?: number }>, type: 'EACH' | 'BOX' | 'PALLET') => {
    const key = type === 'EACH' ? 'quantity_each' : type === 'BOX' ? 'quantity_box' : 'quantity_pallet';
    return items.reduce((sum, item) => sum + (item[key] || 0), 0);
  };

  const clearResults = () => {
    setSearchInput('');
    setSkuInfo(null);
    setLocationInfo(null);
    setSerialHistory(null);
    setContainerData(null);
    setSkuResults([]);
    setLocationResults([]);
    setError(null);
    inputRef.current?.focus();
  };

  const getEventTypeLabel = (eventType: string): string => {
    const labels: Record<string, string> = {
      'CREATED': language === 'tr' ? 'Oluşturuldu' : 'Created',
      'RECEIVED': language === 'tr' ? 'Mal Kabul' : 'Received',
      'TRANSFERRED': language === 'tr' ? 'Transfer' : 'Transferred',
      'PICKED': language === 'tr' ? 'Toplama' : 'Picked',
      'SHIPPED': language === 'tr' ? 'Sevk' : 'Shipped',
      'STATUS_CHANGE': language === 'tr' ? 'Durum Değişikliği' : 'Status Change',
      'COUNTED': language === 'tr' ? 'Sayım' : 'Counted',
    };
    return labels[eventType] || eventType;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-[calc(100vh-120px)] bg-slate-100 p-4 max-sm:p-2">
      <div className="max-w-[800px] mx-auto bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden max-sm:rounded-xl">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 bg-linear-to-br from-primary-500 to-primary-700 text-white">
          <button
            className="bg-white/20 border-none text-white w-9 h-9 rounded-lg text-lg cursor-pointer flex items-center justify-center duration-200 hover:bg-white/30"
            onClick={() => navigate('/')}
          >
            ←
          </button>
          <h2 className="m-0 text-xl font-bold text-white flex-1 leading-9 h-9 flex items-center">{t.inventoryQuery}</h2>
          <button onClick={() => {
            const data = queryMode === 'SKU' ? skuResults : queryMode === 'LOCATION' ? locationResults : [];
            if (data.length === 0) return;
            import('../utils/exportXlsx').then(({ exportToXlsx }) => {
              exportToXlsx(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (data as any[]).map((item: Record<string, unknown>) => ({
                  SKU: item.product_sku || item.sku_code || '',
                  Product: item.product_name || '',
                  Location: item.location_code || '',
                  Quantity: item.quantity_each ?? item.quantity ?? 0,
                  Type: item.unit_type || 'EACH',
                })),
                `inventory-${currentWarehouse}-${queryMode}-${new Date().toISOString().slice(0, 10)}`,
                'Inventory',
              );
            });
          }} className="text-xs py-1.5 px-3 bg-white/20 border-2 border-white/30 text-white rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" disabled={(queryMode === 'SKU' ? skuResults : locationResults).length === 0}>
            ↓ XLSX
          </button>
          <div className="py-2 px-3 bg-white/20 text-white rounded-lg font-semibold text-sm">{currentWarehouse}</div>
        </div>

        {/* QUERY CONTENT */}
        <>
        {/* Query Mode Status Bar */}
        <div className="py-3 px-4 text-white flex justify-between items-center bg-linear-to-br from-primary-500 to-primary-700">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-base">
              {queryMode === 'SKU' ? t.searchBySKU : queryMode === 'LOCATION' ? t.searchByLocation : queryMode === 'SERIAL' ? (language === 'tr' ? 'Seri No Geçmişi' : 'Serial History') : (language === 'tr' ? 'Koli/Palet Sorgula' : 'Container Query')}
            </span>
          </div>
        </div>

        {/* Instruction */}
        <div className="text-center px-4 pt-6 pb-3 text-base text-slate-600 font-medium">
          {queryMode === 'SKU'
            ? (language === 'tr' ? 'Ürün barkodunu okutun veya SKU girin' : 'Scan product barcode or enter SKU')
            : queryMode === 'LOCATION'
            ? (language === 'tr' ? 'Lokasyon barkodunu okutun veya kod girin' : 'Scan location barcode or enter code')
            : queryMode === 'SERIAL'
            ? (language === 'tr' ? 'Seri numaralı barkodu okutun' : 'Scan serial number barcode')
            : (language === 'tr' ? 'Koli veya palet barkodunu okutun' : 'Scan container barcode')
          }
        </div>

        {/* Query Mode Buttons */}
        <div className="grid grid-cols-4 gap-2 px-4 pb-4 pt-2">
          <button
            className={`py-3 px-2 border-none rounded-xl font-semibold text-[0.8125rem] cursor-pointer duration-150 shadow-sm hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 max-sm:py-3 max-sm:px-2 max-sm:text-sm ${
              queryMode === 'SKU'
                ? 'bg-success-500 text-white'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
            onClick={() => { setQueryMode('SKU'); clearResults(); }}
          >
            {language === 'tr' ? 'SKU' : 'SKU'}
          </button>
          <button
            className={`py-3 px-2 border-none rounded-xl font-semibold text-[0.8125rem] cursor-pointer duration-150 shadow-sm hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 max-sm:py-3 max-sm:px-2 max-sm:text-sm ${
              queryMode === 'LOCATION'
                ? 'bg-info-500 text-white'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
            onClick={() => { setQueryMode('LOCATION'); clearResults(); }}
          >
            {language === 'tr' ? 'Lokasyon' : 'Location'}
          </button>
          <button
            className={`py-3 px-2 border-none rounded-xl font-semibold text-[0.8125rem] cursor-pointer duration-150 shadow-sm hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 max-sm:py-3 max-sm:px-2 max-sm:text-sm ${
              queryMode === 'SERIAL'
                ? 'bg-warning-500 text-white'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
            onClick={() => { setQueryMode('SERIAL'); clearResults(); }}
          >
            {language === 'tr' ? 'Seri No' : 'Serial'}
          </button>
          <button
            className={`py-3 px-2 border-none rounded-xl font-semibold text-[0.8125rem] cursor-pointer duration-150 shadow-sm hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 max-sm:py-3 max-sm:px-2 max-sm:text-sm ${
              queryMode === 'CONTAINER'
                ? 'bg-error-400 text-white'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
            onClick={() => { setQueryMode('CONTAINER'); clearResults(); }}
          >
            {language === 'tr' ? 'Koli' : 'Container'}
          </button>
        </div>

        {/* HID Input */}
        <div className="px-4 pb-4 pt-2">
          <input
            ref={inputRef}
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              queryMode === 'SKU'
                ? (language === 'tr' ? 'Barkod okutun veya SKU yazın...' : 'Scan barcode or type SKU...')
                : queryMode === 'LOCATION'
                ? (language === 'tr' ? 'Lokasyon kodu veya barkod...' : 'Location code or barcode...')
                : queryMode === 'SERIAL'
                ? (language === 'tr' ? 'Seri numaralı barkod (örn: IWA-001-000001)' : 'Serial barcode (e.g. IWA-001-000001)')
                : (language === 'tr' ? 'Koli/Palet barkodu (örn: KOL-00001)' : 'Container barcode (e.g. KOL-00001)')
            }
            className="w-full py-3 px-4 text-base border-2 border-slate-300 rounded-xl text-center font-mono bg-slate-100 text-slate-800 duration-150 box-border focus:outline-none focus:border-primary-400 focus:bg-white focus:shadow-[0_0_0_4px] focus:shadow-primary-100"
            autoFocus
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 px-4 pb-4 flex-wrap max-sm:gap-1">
          <button
            className={`flex-1 min-w-[80px] py-3 border-none rounded-lg font-medium text-[0.9375rem] cursor-pointer duration-150 flex items-center justify-center gap-1 max-sm:py-3 max-sm:px-2 max-sm:text-[0.8125rem] ${
              showCamera || isNativeScanning
                ? 'bg-error-500 text-white hover:bg-error-600'
                : 'bg-primary-500 text-white hover:bg-primary-600'
            }`}
            onClick={toggleCamera}
          >
            {showCamera || isNativeScanning ? (language === 'tr' ? 'Kapat' : 'Close') : (language === 'tr' ? 'Kamera' : 'Camera')}
          </button>
          <button
            className="flex-1 min-w-[80px] py-3 border-none rounded-lg font-medium text-[0.9375rem] cursor-pointer duration-150 flex items-center justify-center gap-1 bg-success-500 text-white hover:bg-success-600 disabled:opacity-50 disabled:cursor-not-allowed max-sm:py-3 max-sm:px-2 max-sm:text-[0.8125rem]"
            onClick={() => handleSearch(searchInput)}
            disabled={loading || !searchInput.trim()}
          >
            {t.search}
          </button>
          {(skuInfo || locationInfo || serialHistory || containerData) && (
            <button
              className="flex-[0.5] min-w-[80px] py-3 border-none rounded-lg font-medium text-[0.9375rem] cursor-pointer duration-150 flex items-center justify-center gap-1 bg-slate-500 text-white hover:bg-slate-600 max-sm:flex-[0.4] max-sm:py-3 max-sm:px-2 max-sm:text-[0.8125rem]"
              onClick={clearResults}
            >
              {language === 'tr' ? 'Temizle' : 'Clear'}
            </button>
          )}
        </div>

        {/* Camera Section */}
        {showCamera && !isNative && (
          <div className="px-4 pb-4">
            <div id="inventory-qr-reader" style={{ width: '100%', borderRadius: '12px', overflow: 'hidden' }}></div>
          </div>
        )}

        {/* Native Scanning Animation */}
        {isNativeScanning && (
          <div className="px-4 pb-4">
            <div className="bg-slate-900 rounded-xl py-8 px-4 text-center text-white">
              <div className="w-20 h-20 mx-auto mb-4 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
              <p className="m-0 text-[0.9375rem] opacity-80">{language === 'tr' ? 'Barkod taranıyor...' : 'Scanning barcode...'}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && <div className="text-center p-4 text-2xl animate-pulse">🔍</div>}

        {/* Error */}
        {error && (
          <div className="mx-4 mb-4 p-3 bg-error-50 text-error-600 rounded-lg text-center font-medium border border-error-200">
            {error}
          </div>
        )}

        {/* SKU Query Results */}
        {queryMode === 'SKU' && skuInfo && (
          <div className="px-4 pb-4 pt-3">
            <div className="flex justify-between items-center py-3 px-4 bg-primary-50 rounded-lg mb-3">
              <h3 className="m-0 text-base font-semibold text-primary-700">{skuInfo.product_name}</h3>
              <span className="font-mono text-[0.8125rem] bg-primary-100 text-primary-700 py-1 px-3 rounded-lg font-semibold">{skuInfo.sku_code}</span>
            </div>

            <div className="flex gap-2 mb-3">
              <div className="flex-1 flex flex-col items-center gap-1 p-3 bg-success-50 rounded-lg border border-success-200">
                <span className="text-[1.375rem] font-extrabold text-success-600 font-mono">{getTotalByType(skuResults, 'EACH')}</span>
                <span className="text-[0.6875rem] font-semibold text-slate-500 uppercase">{t.each}</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-1 p-3 bg-success-50 rounded-lg border border-success-200">
                <span className="text-[1.375rem] font-extrabold text-success-600 font-mono">{getTotalByType(skuResults, 'BOX')}</span>
                <span className="text-[0.6875rem] font-semibold text-slate-500 uppercase">{t.boxes}</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-1 p-3 bg-success-50 rounded-lg border border-success-200">
                <span className="text-[1.375rem] font-extrabold text-success-600 font-mono">{getTotalByType(skuResults, 'PALLET')}</span>
                <span className="text-[0.6875rem] font-semibold text-slate-500 uppercase">{t.pallets}</span>
              </div>
            </div>

            <div className="bg-slate-100 rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex justify-between items-center py-3 px-4 bg-slate-100 border-b border-slate-200 font-semibold text-slate-600">
                <span>{t.locations}</span>
                <span className="bg-primary-500 text-white py-1 px-3 rounded-full text-[0.8125rem]">{skuResults.length}</span>
              </div>
              {skuResults.length === 0 ? (
                <div className="py-3 px-4 text-center text-[0.8125rem] text-slate-500 bg-slate-100 italic">{t.noStockFound}</div>
              ) : (
                skuResults.map((item, idx) => (
                  <div key={idx} className={`flex items-center justify-between py-3 px-4 bg-white ${idx < skuResults.length - 1 ? 'border-b border-slate-200' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 font-medium text-slate-800 text-[0.9375rem] mb-1">
                        {item.location_code}
                        {item.zone && (
                          <span className={`inline-block py-0.5 px-2 rounded-md text-[0.6875rem] font-semibold uppercase ${zoneTagClasses[item.zone?.toLowerCase()] || 'bg-slate-100 text-slate-600'}`}>
                            {item.zone}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="font-bold text-success-600 text-base font-mono">{item.quantity_each || 0}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Location Query Results */}
        {queryMode === 'LOCATION' && locationInfo && (
          <div className="px-4 pb-4 pt-3">
            <div className="flex justify-between items-center py-3 px-4 bg-primary-50 rounded-lg mb-3">
              <h3 className="m-0 text-base font-semibold text-primary-700">{locationInfo.location_code}</h3>
              {locationInfo.zone && (
                <span className={`inline-block py-0.5 px-2 rounded-md text-[0.6875rem] font-semibold uppercase ${zoneTagClasses[locationInfo.zone?.toLowerCase()] || 'bg-slate-100 text-slate-600'}`}>
                  {locationInfo.zone}
                </span>
              )}
            </div>

            <div className="flex gap-2 mb-3">
              <div className="flex-1 flex flex-col items-center gap-1 p-3 bg-success-50 rounded-lg border border-success-200">
                <span className="text-[1.375rem] font-extrabold text-success-600 font-mono">{locationResults.length}</span>
                <span className="text-[0.6875rem] font-semibold text-slate-500 uppercase">{t.products}</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-1 p-3 bg-success-50 rounded-lg border border-success-200">
                <span className="text-[1.375rem] font-extrabold text-success-600 font-mono">{getTotalByType(locationResults, 'EACH')}</span>
                <span className="text-[0.6875rem] font-semibold text-slate-500 uppercase">{t.each}</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-1 p-3 bg-success-50 rounded-lg border border-success-200">
                <span className="text-[1.375rem] font-extrabold text-success-600 font-mono">{getTotalByType(locationResults, 'BOX')}</span>
                <span className="text-[0.6875rem] font-semibold text-slate-500 uppercase">{t.boxes}</span>
              </div>
            </div>

            <div className="bg-slate-100 rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex justify-between items-center py-3 px-4 bg-slate-100 border-b border-slate-200 font-semibold text-slate-600">
                <span>{t.products}</span>
                <span className="bg-primary-500 text-white py-1 px-3 rounded-full text-[0.8125rem]">{locationResults.length}</span>
              </div>
              {locationResults.length === 0 ? (
                <div className="py-3 px-4 text-center text-[0.8125rem] text-slate-500 bg-slate-100 italic">{t.locationEmpty}</div>
              ) : (
                locationResults.map((item, idx) => (
                  <div key={idx} className={`flex items-center justify-between py-3 px-4 bg-white ${idx < locationResults.length - 1 ? 'border-b border-slate-200' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 font-medium text-slate-800 text-[0.9375rem] mb-1">{item.product_name}</div>
                      <div className="font-mono text-xs text-slate-500">{item.sku_code}</div>
                    </div>
                    <span className="font-bold text-success-600 text-base font-mono">{item.quantity_each || 0}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Serial History Results */}
        {queryMode === 'SERIAL' && serialHistory && (
          <div className="px-4 pb-4 pt-3">
            <div className="flex justify-between items-center py-3 px-4 bg-warning-50 rounded-lg mb-3 border border-warning-200">
              <div>
                <h3 className="m-0 text-base font-semibold text-warning-700">{serialHistory.serial.product_name}</h3>
                <div className="text-[0.85rem] text-slate-500 mt-1 font-mono">
                  {serialHistory.serial.full_barcode}
                </div>
              </div>
              <span className={`inline-block py-2 px-3 rounded-lg text-xs font-bold uppercase ${serialStatusClasses[serialHistory.serial.status] || 'bg-slate-100 text-slate-600'}`}>
                {serialHistory.serial.status}
              </span>
            </div>

            <div className="flex gap-2 mb-3">
              <div className="flex-1 flex flex-col items-center gap-1 p-3 bg-warning-50 rounded-lg border border-warning-200">
                <span className="text-[1.375rem] font-extrabold text-warning-700 font-mono">{serialHistory.serial.serial_no}</span>
                <span className="text-[0.6875rem] font-semibold text-slate-500 uppercase">{language === 'tr' ? 'Seri No' : 'Serial No'}</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-1 p-3 bg-success-50 rounded-lg border border-success-200">
                <span className="text-[1.375rem] font-extrabold text-success-600 font-mono">{serialHistory.history.length}</span>
                <span className="text-[0.6875rem] font-semibold text-slate-500 uppercase">{language === 'tr' ? 'Hareket' : 'Events'}</span>
              </div>
            </div>

            <div className="bg-slate-100 rounded-lg p-3 mb-3 border border-slate-200">
              <div className="flex justify-between py-2 border-b border-slate-200">
                <span className="text-[0.8125rem] text-slate-500">{language === 'tr' ? 'Ürün SKU' : 'Product SKU'}:</span>
                <span className="text-[0.8125rem] font-semibold text-slate-800 font-mono">{serialHistory.serial.sku_code}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-200">
                <span className="text-[0.8125rem] text-slate-500">{language === 'tr' ? 'Oluşturulma' : 'Created'}:</span>
                <span className="text-[0.8125rem] font-semibold text-slate-800 font-mono">{formatDate(serialHistory.serial.created_at)}</span>
              </div>
              {serialHistory.serial.last_scanned_at && (
                <div className="flex justify-between py-2">
                  <span className="text-[0.8125rem] text-slate-500">{language === 'tr' ? 'Son Tarama' : 'Last Scan'}:</span>
                  <span className="text-[0.8125rem] font-semibold text-slate-800 font-mono">{formatDate(serialHistory.serial.last_scanned_at)}</span>
                </div>
              )}
            </div>

            <div className="bg-slate-100 rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex justify-between items-center py-3 px-4 bg-slate-100 border-b border-slate-200 font-semibold text-slate-600">
                <span>{language === 'tr' ? 'Hareket Geçmişi' : 'Event History'}</span>
                <span className="bg-primary-500 text-white py-1 px-3 rounded-full text-[0.8125rem]">{serialHistory.history.length}</span>
              </div>
              {serialHistory.history.length === 0 ? (
                <div className="py-3 px-4 text-center text-[0.8125rem] text-slate-500 bg-slate-100 italic">{language === 'tr' ? 'Henüz hareket kaydı yok' : 'No events recorded yet'}</div>
              ) : (
                serialHistory.history.map((event, idx) => (
                  <div key={idx} className={`flex gap-3 py-3 px-4 bg-white ${idx < serialHistory.history.length - 1 ? 'border-b border-slate-200' : ''}`}>
                    <div className="text-lg shrink-0 w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg">
                      {event.event_type === 'CREATED' && '🆕'}
                      {event.event_type === 'RECEIVED' && '📥'}
                      {event.event_type === 'TRANSFERRED' && '🔄'}
                      {event.event_type === 'PICKED' && '📦'}
                      {event.event_type === 'SHIPPED' && '🚚'}
                      {event.event_type === 'STATUS_CHANGE' && '📝'}
                      {event.event_type === 'COUNTED' && '🔢'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 text-[0.9375rem] mb-1">{getEventTypeLabel(event.event_type)}</div>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                        {event.from_location && event.to_location && (
                          <span>{event.from_location} → {event.to_location}</span>
                        )}
                        {event.to_location && !event.from_location && (
                          <span>→ {event.to_location}</span>
                        )}
                        {event.performed_by && (
                          <span className="bg-info-100 text-info-700 py-0.5 px-2 rounded-md text-[0.6875rem]">{event.performed_by}</span>
                        )}
                      </div>
                      <div className="text-[0.6875rem] text-slate-400 mt-1">{formatDate(event.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Container Query Results */}
        {queryMode === 'CONTAINER' && containerData && (
          <div className="px-4 pb-4 pt-3">
            <div className={`flex justify-between items-center py-3 px-4 rounded-lg mb-3 border ${
              containerData.container.container_type === 'BOX'
                ? 'bg-error-50 border-error-200'
                : 'bg-success-50 border-success-200'
            }`}>
              <div>
                <h3 className={`m-0 text-base font-semibold ${
                  containerData.container.container_type === 'BOX' ? 'text-error-700' : 'text-success-700'
                }`}>
                  {containerData.container.container_type === 'BOX' ? (language === 'tr' ? 'Koli' : 'Box') : (language === 'tr' ? 'Palet' : 'Pallet')}
                </h3>
                <div className="text-[1.1rem] font-bold font-mono mt-1 text-slate-800">
                  {containerData.container.barcode}
                </div>
              </div>
              <span className={`inline-block py-2 px-3 rounded-lg text-xs font-bold uppercase text-white ${containerStatusClasses[containerData.container.status.toLowerCase()] || 'bg-slate-500'}`}>
                {containerData.container.status === 'ACTIVE' ? (language === 'tr' ? 'Aktif' : 'Active') :
                 containerData.container.status === 'OPENED' ? (language === 'tr' ? 'Açık' : 'Opened') : containerData.container.status}
              </span>
            </div>

            <div className="flex gap-2 mb-3">
              <div className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border ${
                containerData.container.container_type === 'BOX'
                  ? 'bg-error-50 border-error-200'
                  : 'bg-success-50 border-success-200'
              }`}>
                <span className={`text-[1.375rem] font-extrabold font-mono ${
                  containerData.container.container_type === 'BOX' ? 'text-error-700' : 'text-success-700'
                }`}>
                  {containerData.contents.length}
                </span>
                <span className="text-[0.6875rem] font-semibold text-slate-500 uppercase">{language === 'tr' ? 'Ürün Çeşidi' : 'Product Types'}</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-1 p-3 bg-success-50 rounded-lg border border-success-200">
                <span className="text-[1.375rem] font-extrabold text-success-600 font-mono">
                  {containerData.contents.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
                <span className="text-[0.6875rem] font-semibold text-slate-500 uppercase">{language === 'tr' ? 'Toplam Adet' : 'Total Qty'}</span>
              </div>
            </div>

            <div className="bg-slate-100 rounded-lg p-3 mb-3 border border-slate-200">
              <div className="flex justify-between py-2 border-b border-slate-200">
                <span className="text-[0.8125rem] text-slate-500">{language === 'tr' ? 'Oluşturan' : 'Created By'}:</span>
                <span className="text-[0.8125rem] font-semibold text-slate-800 font-mono">{containerData.container.created_by}</span>
              </div>
              <div className={`flex justify-between py-2 ${containerData.container.opened_at || containerData.container.notes ? 'border-b border-slate-200' : ''}`}>
                <span className="text-[0.8125rem] text-slate-500">{language === 'tr' ? 'Oluşturulma' : 'Created'}:</span>
                <span className="text-[0.8125rem] font-semibold text-slate-800 font-mono">{formatDate(containerData.container.created_at)}</span>
              </div>
              {containerData.container.opened_at && (
                <div className={`flex justify-between py-2 ${containerData.container.notes ? 'border-b border-slate-200' : ''}`}>
                  <span className="text-[0.8125rem] text-slate-500">{language === 'tr' ? 'Açılma Tarihi' : 'Opened At'}:</span>
                  <span className="text-[0.8125rem] font-semibold text-slate-800 font-mono">{formatDate(containerData.container.opened_at)}</span>
                </div>
              )}
              {containerData.container.notes && (
                <div className="flex justify-between py-2">
                  <span className="text-[0.8125rem] text-slate-500">{language === 'tr' ? 'Notlar' : 'Notes'}:</span>
                  <span className="text-[0.8125rem] font-semibold text-slate-800 font-mono">{containerData.container.notes}</span>
                </div>
              )}
            </div>

            <div className="bg-slate-100 rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex justify-between items-center py-3 px-4 bg-slate-100 border-b border-slate-200 font-semibold text-slate-600">
                <span>{language === 'tr' ? 'İçerik' : 'Contents'}</span>
                <span className="bg-primary-500 text-white py-1 px-3 rounded-full text-[0.8125rem]">{containerData.contents.length}</span>
              </div>
              {containerData.contents.length === 0 ? (
                <div className="py-3 px-4 text-center text-[0.8125rem] text-slate-500 bg-slate-100 italic">{language === 'tr' ? 'Koli boş' : 'Container is empty'}</div>
              ) : (
                containerData.contents.map((item, idx) => (
                  <div key={idx} className={`flex items-center justify-between py-3 px-4 bg-white ${idx < containerData.contents.length - 1 ? 'border-b border-slate-200' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 font-medium text-slate-800 text-[0.9375rem] mb-1">{item.product_name}</div>
                      <div className="font-mono text-xs text-slate-500">{item.sku_code}</div>
                    </div>
                    <span className="font-bold text-success-600 text-base font-mono">{item.quantity}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Initial State */}
        {!loading && !error && !skuInfo && !locationInfo && !serialHistory && !containerData && !showCamera && !isNativeScanning && (
          <div className="text-center py-8 px-6">
            <div className="text-[2.5rem] mb-3">
              {queryMode === 'SKU' ? '🏷️' : queryMode === 'LOCATION' ? '📍' : queryMode === 'SERIAL' ? '🔢' : '📦'}
            </div>
            <h3 className="m-0 mb-2 text-slate-800 text-base font-semibold">
              {queryMode === 'SKU' ? t.skuQueryMode : queryMode === 'LOCATION' ? t.locationQueryMode : queryMode === 'SERIAL' ? (language === 'tr' ? 'Seri Numara Takibi' : 'Serial Number Tracking') : (language === 'tr' ? 'Koli/Palet Sorgula' : 'Container Query')}
            </h3>
            <p className="m-0 mb-4 text-slate-500 text-sm leading-relaxed">
              {queryMode === 'SKU' ? t.skuQueryHint : queryMode === 'LOCATION' ? t.locationQueryHint : queryMode === 'SERIAL' ? (language === 'tr' ? 'Bir seri numaralı barkod tarayarak ürünün tüm geçmişini görüntüleyin' : 'Scan a serialized barcode to view the complete history of that item') : (language === 'tr' ? 'Koli veya palet barkodunu tarayarak içeriğini görüntüleyin' : 'Scan a container barcode to view its contents')}
            </p>
            <div className="inline-block py-2 px-4 bg-slate-100 rounded-lg font-mono text-[0.8125rem] text-slate-600">
              {t.example}: {queryMode === 'SKU' ? 'IWA-001, IWA-002' : queryMode === 'LOCATION' ? 'LOC-A01-01-01' : queryMode === 'SERIAL' ? 'IWA-001-000001' : 'KOL-00001, PAL-00001'}
            </div>
          </div>
        )}
        </>
      </div>
    </div>
  );
}

export default Inventory;
