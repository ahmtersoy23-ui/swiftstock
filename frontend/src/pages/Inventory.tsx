import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Html5Qrcode } from 'html5-qrcode';
import { useStore } from '../stores/appStore';
import { apiClient } from '../lib/api';
import { translations } from '../i18n/translations';
import './Inventory.css';

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
    } catch (err: unknown) {
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

  const getStatusBadgeClass = (status: string): string => {
    const classes: Record<string, string> = {
      'AVAILABLE': 'status-available',
      'IN_STOCK': 'status-instock',
      'SHIPPED': 'status-shipped',
      'USED': 'status-used',
    };
    return classes[status] || '';
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
    <div className="inventory-page">
      <div className="inventory-card">
        {/* Header */}
        <div className="inventory-header">
          <button className="back-btn" onClick={() => navigate('/')}>
            ←
          </button>
          <h2>{t.inventoryQuery}</h2>
          <div className="warehouse-badge">{currentWarehouse}</div>
        </div>

        {/* QUERY CONTENT */}
        <>
        {/* Query Mode Status Bar */}
        <div className={`workflow-status ${queryMode === 'SKU' ? 'sku-mode' : queryMode === 'LOCATION' ? 'loc-mode' : queryMode === 'SERIAL' ? 'serial-mode' : 'container-mode'}`}>
          <div className="status-row">
            <span className="status-mode">
              {queryMode === 'SKU' ? t.searchBySKU : queryMode === 'LOCATION' ? t.searchByLocation : queryMode === 'SERIAL' ? (language === 'tr' ? 'Seri No Geçmişi' : 'Serial History') : (language === 'tr' ? 'Koli/Palet Sorgula' : 'Container Query')}
            </span>
          </div>
        </div>

        {/* Instruction */}
        <div className="scan-instruction">
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
        <div className="mode-buttons query-modes">
          <button
            className={`mode-btn ${queryMode === 'SKU' ? 'active sku' : ''}`}
            onClick={() => { setQueryMode('SKU'); clearResults(); }}
          >
            {language === 'tr' ? 'SKU' : 'SKU'}
          </button>
          <button
            className={`mode-btn ${queryMode === 'LOCATION' ? 'active location' : ''}`}
            onClick={() => { setQueryMode('LOCATION'); clearResults(); }}
          >
            {language === 'tr' ? 'Lokasyon' : 'Location'}
          </button>
          <button
            className={`mode-btn ${queryMode === 'SERIAL' ? 'active serial' : ''}`}
            onClick={() => { setQueryMode('SERIAL'); clearResults(); }}
          >
            {language === 'tr' ? 'Seri No' : 'Serial'}
          </button>
          <button
            className={`mode-btn ${queryMode === 'CONTAINER' ? 'active container' : ''}`}
            onClick={() => { setQueryMode('CONTAINER'); clearResults(); }}
          >
            {language === 'tr' ? 'Koli' : 'Container'}
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
                : queryMode === 'LOCATION'
                ? (language === 'tr' ? 'Lokasyon kodu veya barkod...' : 'Location code or barcode...')
                : queryMode === 'SERIAL'
                ? (language === 'tr' ? 'Seri numaralı barkod (örn: IWA-001-000001)' : 'Serial barcode (e.g. IWA-001-000001)')
                : (language === 'tr' ? 'Koli/Palet barkodu (örn: KOL-00001)' : 'Container barcode (e.g. KOL-00001)')
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
            {showCamera || isNativeScanning ? (language === 'tr' ? 'Kapat' : 'Close') : (language === 'tr' ? 'Kamera' : 'Camera')}
          </button>
          <button
            className="action-btn complete"
            onClick={() => handleSearch(searchInput)}
            disabled={loading || !searchInput.trim()}
          >
            {t.search}
          </button>
          {(skuInfo || locationInfo || serialHistory || containerData) && (
            <button className="action-btn cancel" onClick={clearResults}>
              {language === 'tr' ? 'Temizle' : 'Clear'}
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

        {/* Serial History Results */}
        {queryMode === 'SERIAL' && serialHistory && (
          <div className="results-section">
            <div className="product-header serial-header">
              <div>
                <h3>{serialHistory.serial.product_name}</h3>
                <div className="serial-barcode">
                  {serialHistory.serial.full_barcode}
                </div>
              </div>
              <span className={`serial-status-badge ${getStatusBadgeClass(serialHistory.serial.status)}`}>
                {serialHistory.serial.status}
              </span>
            </div>

            <div className="totals-row">
              <div className="total-item serial-total">
                <span className="total-value">{serialHistory.serial.serial_no}</span>
                <span className="total-label">{language === 'tr' ? 'Seri No' : 'Serial No'}</span>
              </div>
              <div className="total-item">
                <span className="total-value">{serialHistory.history.length}</span>
                <span className="total-label">{language === 'tr' ? 'Hareket' : 'Events'}</span>
              </div>
            </div>

            <div className="serial-info-card">
              <div className="serial-info-row">
                <span className="serial-info-label">{language === 'tr' ? 'Ürün SKU' : 'Product SKU'}:</span>
                <span className="serial-info-value">{serialHistory.serial.sku_code}</span>
              </div>
              <div className="serial-info-row">
                <span className="serial-info-label">{language === 'tr' ? 'Oluşturulma' : 'Created'}:</span>
                <span className="serial-info-value">{formatDate(serialHistory.serial.created_at)}</span>
              </div>
              {serialHistory.serial.last_scanned_at && (
                <div className="serial-info-row">
                  <span className="serial-info-label">{language === 'tr' ? 'Son Tarama' : 'Last Scan'}:</span>
                  <span className="serial-info-value">{formatDate(serialHistory.serial.last_scanned_at)}</span>
                </div>
              )}
            </div>

            <div className="items-list">
              <div className="items-header">
                <span>{language === 'tr' ? 'Hareket Geçmişi' : 'Event History'}</span>
                <span className="items-total">{serialHistory.history.length}</span>
              </div>
              {serialHistory.history.length === 0 ? (
                <div className="scan-action-hint">{language === 'tr' ? 'Henüz hareket kaydı yok' : 'No events recorded yet'}</div>
              ) : (
                serialHistory.history.map((event, idx) => (
                  <div key={idx} className="history-event-row">
                    <div className="history-event-icon">
                      {event.event_type === 'CREATED' && '🆕'}
                      {event.event_type === 'RECEIVED' && '📥'}
                      {event.event_type === 'TRANSFERRED' && '🔄'}
                      {event.event_type === 'PICKED' && '📦'}
                      {event.event_type === 'SHIPPED' && '🚚'}
                      {event.event_type === 'STATUS_CHANGE' && '📝'}
                      {event.event_type === 'COUNTED' && '🔢'}
                    </div>
                    <div className="history-event-info">
                      <div className="history-event-type">{getEventTypeLabel(event.event_type)}</div>
                      <div className="history-event-details">
                        {event.from_location && event.to_location && (
                          <span>{event.from_location} → {event.to_location}</span>
                        )}
                        {event.to_location && !event.from_location && (
                          <span>→ {event.to_location}</span>
                        )}
                        {event.performed_by && (
                          <span className="history-event-user">{event.performed_by}</span>
                        )}
                      </div>
                      <div className="history-event-date">{formatDate(event.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Container Query Results */}
        {queryMode === 'CONTAINER' && containerData && (
          <div className="results-section">
            <div className={`product-header container-header ${containerData.container.container_type === 'BOX' ? 'box' : 'pallet'}`}>
              <div>
                <h3>
                  {containerData.container.container_type === 'BOX' ? (language === 'tr' ? 'Koli' : 'Box') : (language === 'tr' ? 'Palet' : 'Pallet')}
                </h3>
                <div className="container-barcode">
                  {containerData.container.barcode}
                </div>
              </div>
              <span className={`container-status-badge ${containerData.container.status.toLowerCase()}`}>
                {containerData.container.status === 'ACTIVE' ? (language === 'tr' ? 'Aktif' : 'Active') :
                 containerData.container.status === 'OPENED' ? (language === 'tr' ? 'Açık' : 'Opened') : containerData.container.status}
              </span>
            </div>

            <div className="totals-row">
              <div className={`total-item container-total ${containerData.container.container_type === 'BOX' ? 'box' : 'pallet'}`}>
                <span className="total-value">
                  {containerData.contents.length}
                </span>
                <span className="total-label">{language === 'tr' ? 'Ürün Çeşidi' : 'Product Types'}</span>
              </div>
              <div className="total-item">
                <span className="total-value">
                  {containerData.contents.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
                <span className="total-label">{language === 'tr' ? 'Toplam Adet' : 'Total Qty'}</span>
              </div>
            </div>

            <div className="serial-info-card">
              <div className="serial-info-row">
                <span className="serial-info-label">{language === 'tr' ? 'Oluşturan' : 'Created By'}:</span>
                <span className="serial-info-value">{containerData.container.created_by}</span>
              </div>
              <div className="serial-info-row">
                <span className="serial-info-label">{language === 'tr' ? 'Oluşturulma' : 'Created'}:</span>
                <span className="serial-info-value">{formatDate(containerData.container.created_at)}</span>
              </div>
              {containerData.container.opened_at && (
                <div className="serial-info-row">
                  <span className="serial-info-label">{language === 'tr' ? 'Açılma Tarihi' : 'Opened At'}:</span>
                  <span className="serial-info-value">{formatDate(containerData.container.opened_at)}</span>
                </div>
              )}
              {containerData.container.notes && (
                <div className="serial-info-row">
                  <span className="serial-info-label">{language === 'tr' ? 'Notlar' : 'Notes'}:</span>
                  <span className="serial-info-value">{containerData.container.notes}</span>
                </div>
              )}
            </div>

            <div className="items-list">
              <div className="items-header">
                <span>{language === 'tr' ? 'İçerik' : 'Contents'}</span>
                <span className="items-total">{containerData.contents.length}</span>
              </div>
              {containerData.contents.length === 0 ? (
                <div className="scan-action-hint">{language === 'tr' ? 'Koli boş' : 'Container is empty'}</div>
              ) : (
                containerData.contents.map((item, idx) => (
                  <div key={idx} className="item-row">
                    <div className="item-info">
                      <div className="item-name">{item.product_name}</div>
                      <div className="item-sku">{item.sku_code}</div>
                    </div>
                    <span className="item-qty">{item.quantity}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Initial State */}
        {!loading && !error && !skuInfo && !locationInfo && !serialHistory && !containerData && !showCamera && !isNativeScanning && (
          <div className="initial-state">
            <div className="hint-icon">
              {queryMode === 'SKU' ? '🏷️' : queryMode === 'LOCATION' ? '📍' : queryMode === 'SERIAL' ? '🔢' : '📦'}
            </div>
            <h3>
              {queryMode === 'SKU' ? t.skuQueryMode : queryMode === 'LOCATION' ? t.locationQueryMode : queryMode === 'SERIAL' ? (language === 'tr' ? 'Seri Numara Takibi' : 'Serial Number Tracking') : (language === 'tr' ? 'Koli/Palet Sorgula' : 'Container Query')}
            </h3>
            <p>
              {queryMode === 'SKU' ? t.skuQueryHint : queryMode === 'LOCATION' ? t.locationQueryHint : queryMode === 'SERIAL' ? (language === 'tr' ? 'Bir seri numaralı barkod tarayarak ürünün tüm geçmişini görüntüleyin' : 'Scan a serialized barcode to view the complete history of that item') : (language === 'tr' ? 'Koli veya palet barkodunu tarayarak içeriğini görüntüleyin' : 'Scan a container barcode to view its contents')}
            </p>
            <div className="example-code">
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
