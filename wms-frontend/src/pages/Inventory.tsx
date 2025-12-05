import { useState, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Html5Qrcode } from 'html5-qrcode';
import { useStore } from '../store/useStore';
import { apiClient } from '../lib/api';
import { translations } from '../i18n/translations';
import './Inventory.css';

const isNative = Capacitor.isNativePlatform();

type QueryMode = 'SKU' | 'LOCATION';

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

function Inventory() {
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
  const [skuInfo, setSkuInfo] = useState<any>(null);

  // Location Query Results
  const [locationResults, setLocationResults] = useState<LocationInventoryItem[]>([]);
  const [locationInfo, setLocationInfo] = useState<any>(null);

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
    setShowCamera(false);

    try {
      if (queryMode === 'SKU') {
        // Search by SKU
        const response = await apiClient.getInventoryBySku(query, currentWarehouse);
        if (response.success && response.data) {
          setSkuInfo(response.data.product);
          setSkuResults(response.data.locations || []);
        }
      } else {
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
      }
    } catch (err: any) {
      setError(
        queryMode === 'SKU'
          ? t.productNotFound
          : t.locationNotFound
      );
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
      } catch (e) {}
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

  const getTotalByType = (items: any[], type: 'EACH' | 'BOX' | 'PALLET') => {
    const key = type === 'EACH' ? 'quantity_each' : type === 'BOX' ? 'quantity_box' : 'quantity_pallet';
    return items.reduce((sum, item) => sum + (item[key] || 0), 0);
  };

  const clearResults = () => {
    setSearchInput('');
    setSkuInfo(null);
    setLocationInfo(null);
    setSkuResults([]);
    setLocationResults([]);
    setError(null);
    inputRef.current?.focus();
  };

  return (
    <div className="inventory-page">
      <div className="inventory-card">
        {/* Header */}
        <div className="inventory-header">
          <h2>{t.inventoryQuery}</h2>
          <div className="warehouse-badge">{currentWarehouse}</div>
        </div>

        {/* Query Mode Status Bar */}
        <div className={`workflow-status ${queryMode === 'SKU' ? 'sku-mode' : 'loc-mode'}`}>
          <div className="status-row">
            <span className="status-mode">
              {queryMode === 'SKU' ? t.searchBySKU : t.searchByLocation}
            </span>
          </div>
        </div>

        {/* Instruction */}
        <div className="scan-instruction">
          {queryMode === 'SKU'
            ? (language === 'tr' ? 'Ürün barkodunu okutun veya SKU girin' : 'Scan product barcode or enter SKU')
            : (language === 'tr' ? 'Lokasyon barkodunu okutun veya kod girin' : 'Scan location barcode or enter code')
          }
        </div>

        {/* Query Mode Buttons */}
        <div className="mode-buttons">
          <button
            className="mode-btn"
            style={{ background: queryMode === 'SKU' ? '#10b981' : '#64748b' }}
            onClick={() => { setQueryMode('SKU'); clearResults(); }}
          >
            SKU Ara
          </button>
          <button
            className="mode-btn"
            style={{ background: queryMode === 'LOCATION' ? '#8b5cf6' : '#64748b' }}
            onClick={() => { setQueryMode('LOCATION'); clearResults(); }}
          >
            Lokasyon Ara
          </button>
        </div>

        {/* HID Input */}
        <div className="hid-input-section">
          <input
            ref={inputRef}
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              queryMode === 'SKU'
                ? (language === 'tr' ? 'Barkod okutun veya SKU yazın...' : 'Scan barcode or type SKU...')
                : (language === 'tr' ? 'Lokasyon kodu veya barkod...' : 'Location code or barcode...')
            }
            className="hid-input"
            autoFocus
          />
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button
            className={`action-btn camera ${showCamera || isNativeScanning ? 'active' : ''}`}
            onClick={toggleCamera}
          >
            {showCamera || isNativeScanning ? 'Kapat' : 'Kamera'}
          </button>
          <button
            className="action-btn complete"
            onClick={() => handleSearch(searchInput)}
            disabled={loading || !searchInput.trim()}
          >
            {t.search}
          </button>
          {(skuInfo || locationInfo) && (
            <button className="action-btn cancel" onClick={clearResults}>
              Temizle
            </button>
          )}
        </div>

        {/* Camera Section */}
        {showCamera && !isNative && (
          <div className="camera-section">
            <div id="inventory-qr-reader" style={{ width: '100%', borderRadius: '12px', overflow: 'hidden' }}></div>
          </div>
        )}

        {/* Native Scanning Animation */}
        {isNativeScanning && (
          <div className="camera-section">
            <div className="native-scanning">
              <div className="scanning-animation"></div>
              <p>{language === 'tr' ? 'Barkod taranıyor...' : 'Scanning barcode...'}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && <div className="scan-loading">🔍</div>}

        {/* Error */}
        {error && <div className="scan-error">{error}</div>}

        {/* SKU Query Results */}
        {queryMode === 'SKU' && skuInfo && (
          <div className="results-section">
            <div className="product-header">
              <h3>{skuInfo.product_name}</h3>
              <span className="sku-badge">{skuInfo.sku_code}</span>
            </div>

            <div className="totals-row">
              <div className="total-item">
                <span className="total-value">{getTotalByType(skuResults, 'EACH')}</span>
                <span className="total-label">{t.each}</span>
              </div>
              <div className="total-item">
                <span className="total-value">{getTotalByType(skuResults, 'BOX')}</span>
                <span className="total-label">{t.boxes}</span>
              </div>
              <div className="total-item">
                <span className="total-value">{getTotalByType(skuResults, 'PALLET')}</span>
                <span className="total-label">{t.pallets}</span>
              </div>
            </div>

            <div className="items-list">
              <div className="items-header">
                <span>{t.locations}</span>
                <span className="items-total">{skuResults.length}</span>
              </div>
              {skuResults.length === 0 ? (
                <div className="scan-action-hint">{t.noStockFound}</div>
              ) : (
                skuResults.map((item, idx) => (
                  <div key={idx} className="item-row">
                    <div className="item-info">
                      <div className="item-name">
                        {item.location_code}
                        {item.zone && (
                          <span className={`zone-tag ${item.zone?.toLowerCase()}`}>
                            {item.zone}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="item-qty">{item.quantity_each || 0}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Location Query Results */}
        {queryMode === 'LOCATION' && locationInfo && (
          <div className="results-section">
            <div className="location-header">
              <h3>{locationInfo.location_code}</h3>
              {locationInfo.zone && (
                <span className={`zone-tag ${locationInfo.zone?.toLowerCase()}`}>
                  {locationInfo.zone}
                </span>
              )}
            </div>

            <div className="totals-row">
              <div className="total-item">
                <span className="total-value">{locationResults.length}</span>
                <span className="total-label">{t.products}</span>
              </div>
              <div className="total-item">
                <span className="total-value">{getTotalByType(locationResults, 'EACH')}</span>
                <span className="total-label">{t.each}</span>
              </div>
              <div className="total-item">
                <span className="total-value">{getTotalByType(locationResults, 'BOX')}</span>
                <span className="total-label">{t.boxes}</span>
              </div>
            </div>

            <div className="items-list">
              <div className="items-header">
                <span>{t.products}</span>
                <span className="items-total">{locationResults.length}</span>
              </div>
              {locationResults.length === 0 ? (
                <div className="scan-action-hint">{t.locationEmpty}</div>
              ) : (
                locationResults.map((item, idx) => (
                  <div key={idx} className="item-row">
                    <div className="item-info">
                      <div className="item-name">{item.product_name}</div>
                      <div className="item-sku">{item.sku_code}</div>
                    </div>
                    <span className="item-qty">{item.quantity_each || 0}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Initial State */}
        {!loading && !error && !skuInfo && !locationInfo && !showCamera && !isNativeScanning && (
          <div className="initial-state">
            <div className="hint-icon">
              {queryMode === 'SKU' ? '🏷️' : '📍'}
            </div>
            <h3>
              {queryMode === 'SKU' ? t.skuQueryMode : t.locationQueryMode}
            </h3>
            <p>
              {queryMode === 'SKU' ? t.skuQueryHint : t.locationQueryHint}
            </p>
            <div className="example-code">
              {t.example}: {queryMode === 'SKU' ? 'IWA-001, IWA-002, etc.' : 'LOC-A01-01-01'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Inventory;
