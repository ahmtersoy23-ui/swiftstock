import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useStore } from '../stores/appStore';
import { translations } from '../i18n/translations';
import type { Location, OperationMode, Warehouse } from '../types';

const ZONE_BADGE_CLASSES: Record<string, string> = {
  receiving: 'bg-emerald-100 text-emerald-800',
  storage: 'bg-blue-100 text-blue-800',
  picking: 'bg-amber-100 text-amber-800',
  shipping: 'bg-orange-100 text-orange-800',
  category: 'bg-violet-100 text-violet-700',
};

const MODE_TYPE_BADGE_CLASSES: Record<string, string> = {
  receiving: 'bg-emerald-100 text-emerald-800',
  picking: 'bg-amber-100 text-amber-800',
  transfer: 'bg-blue-100 text-blue-800',
  count: 'bg-violet-100 text-violet-700',
};

function Locations() {
  const navigate = useNavigate();
  const { language, currentWarehouse } = useStore();
  const t = translations[language];
  const [locations, setLocations] = useState<Location[]>([]);
  const [operationModes, setOperationModes] = useState<OperationMode[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Helper function to translate mode names and descriptions
  const getTranslatedModeName = (modeType: string): string => {
    const mapping: Record<string, keyof typeof t> = {
      'RECEIVING': 'receiving',
      'PICKING': 'picking',
      'TRANSFER': 'transfer',
      'COUNT': 'count',
    };
    return t[mapping[modeType]] || modeType;
  };

  const getTranslatedModeDescription = (modeType: string): string => {
    const mapping: Record<string, keyof typeof t> = {
      'RECEIVING': 'receivingDesc',
      'PICKING': 'pickingDesc',
      'TRANSFER': 'transferDesc',
      'COUNT': 'countDesc',
    };
    return t[mapping[modeType]] || '';
  };

  const getTranslatedActionName = (modeCode: string): string => {
    const mapping: Record<string, string> = {
      'ACTION-NEW-BOX': t.newBox,
      'ACTION-NEW-PALLET': t.newPallet,
      'ACTION-CREATE-BOX': t.newBox,
      'ACTION-CREATE-PALLET': t.newPallet,
      'ACTION-COMPLETE': t.complete,
      'ACTION-CANCEL': t.cancel,
    };
    return mapping[modeCode] || modeCode;
  };

  const getTranslatedActionDescription = (modeCode: string): string => {
    const mapping: Record<string, keyof typeof t> = {
      'ACTION-NEW-BOX': 'createBoxDesc',
      'ACTION-NEW-PALLET': 'createPalletDesc',
      'ACTION-CREATE-BOX': 'createBoxDesc',
      'ACTION-CREATE-PALLET': 'createPalletDesc',
      'ACTION-COMPLETE': 'completeDesc',
      'ACTION-CANCEL': 'cancelDesc',
    };
    return t[mapping[modeCode]] || '';
  };

  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state
  const [newLocation, setNewLocation] = useState({
    warehouse_code: currentWarehouse,
    location_code: '',
    qr_code: '',
    description: '',
    zone: '',
    aisle: '',
    bay: '',
    level: '',
    location_type: 'RACK',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [warehouseFilter, zoneFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const locationsResponse = await apiClient.getAllLocations(
        warehouseFilter || undefined,
        zoneFilter || undefined
      );

      if (locationsResponse.success) {
        setLocations(locationsResponse.data || []);
      }

      const modesResponse = await apiClient.getAllOperationModes();
      if (modesResponse.success) {
        setOperationModes(modesResponse.data || []);
      }

      const warehousesResponse = await apiClient.getAllWarehouses();
      if (warehousesResponse.success) {
        setWarehouses(warehousesResponse.data || []);
      }
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const response = await apiClient.createLocation(newLocation);

      if (response.success) {
        setSuccess('Location created successfully!');
        setShowAddForm(false);
        setNewLocation({
          warehouse_code: currentWarehouse,
          location_code: '',
          qr_code: '',
          description: '',
          zone: '',
          aisle: '',
          bay: '',
          level: '',
          location_type: 'RACK',
          notes: '',
        });
        loadData();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      setError(errorObj.response?.data?.error || 'Failed to create location');
    }
  };

  const handlePrintLocationBarcode = (location: Location) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html>
  <head>
    <title>Location QR Code</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; display: flex; flex-direction: column; align-items: center; }
      .preview-section { margin-bottom: 30px; text-align: center; }
      .preview-label { width: 60mm; height: 60mm; border: 2px solid #2563eb; padding: 3mm; background: white;
        display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 2mm; }
      .location-header { font-size: 14pt; font-weight: bold; color: #2563eb; text-align: center; }
      .qr-container { width: 35mm; height: 35mm; display: flex; align-items: center; justify-content: center; }
      .qr-container img, .qr-container canvas { max-width: 100%; max-height: 100%; }
      .location-code { font-size: 10pt; font-family: 'Courier New', monospace; font-weight: bold; text-align: center; }
      .zone-badge { display: none; padding: 1mm 3mm; background: #10b981; color: white;
        font-size: 8pt; font-weight: bold; border-radius: 2mm; }
      .btn-print { padding: 12px 24px; background: #2563eb; color: white; border: none;
        border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 20px; }
      @media print {
        body { padding: 0; }
        .btn-print { display: none; }
        .preview-section h2 { display: none; }
        .preview-label { border: none; margin: 0; page-break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <div class="preview-section">
      <h2>Location QR Code Preview</h2>
      <div class="preview-label">
        <div class="location-header">LOCATION</div>
        <div class="qr-container" id="qrcode"></div>
        <div class="location-code" id="loc-code"></div>
        <div class="zone-badge" id="zone-badge"></div>
      </div>
    </div>
    <button class="btn-print" onclick="window.print()">Print QR Code</button>
  </body>
</html>`);
    printWindow.document.close();

    const locCodeEl = printWindow.document.getElementById('loc-code');
    const zoneBadgeEl = printWindow.document.getElementById('zone-badge');
    if (locCodeEl) locCodeEl.textContent = location.location_code;
    if (zoneBadgeEl && location.zone) {
      zoneBadgeEl.textContent = location.zone;
      zoneBadgeEl.style.display = 'inline-block';
    }

    printWindow.addEventListener('load', () => {
      const win = printWindow as Window & { QRCode: new (el: HTMLElement, opts: object) => void };
      const qrEl = printWindow.document.getElementById('qrcode');
      if (qrEl && win.QRCode) {
        new win.QRCode(qrEl, {
          text: location.location_code,
          width: 120, height: 120,
          colorDark: '#2563eb', colorLight: '#ffffff', correctLevel: 1,
        });
      }
    });
  };

  const handlePrintOperationModeBarcode = (mode: OperationMode) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const allColors: Record<string, string> = {
      'MODE-IN-RECEIVING': '#10b981',
      'MODE-OUT-PICKING': '#f59e0b',
      'MODE-MOVE-TRANSFER': '#3b82f6',
      'MODE-COUNT-CYCLE': '#8b5cf6',
      'ACTION-CREATE-BOX': '#ec4899',
      'ACTION-CREATE-PALLET': '#14b8a6',
      'ACTION-COMPLETE': '#6366f1',
      'ACTION-CANCEL': '#dc2626',
    };

    const color = allColors[mode.mode_code] || '#6b7280';

    const translatedName = mode.mode_code.startsWith('ACTION-')
      ? getTranslatedActionName(mode.mode_code)
      : getTranslatedModeName(mode.mode_type);

    const _translatedDesc = mode.mode_code.startsWith('ACTION-')
      ? getTranslatedActionDescription(mode.mode_code)
      : getTranslatedModeDescription(mode.mode_type);
    void _translatedDesc;

    printWindow.document.write(`<!DOCTYPE html>
<html>
  <head>
    <title>Operation Mode QR Code</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; display: flex; flex-direction: column; align-items: center; }
      .preview-section { margin-bottom: 30px; text-align: center; }
      .preview-label { width: 60mm; height: 60mm; border: 2px solid ${color}; padding: 3mm; background: white;
        display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 2mm; }
      .mode-header { font-size: 14pt; font-weight: bold; color: ${color}; text-align: center; }
      .qr-container { width: 35mm; height: 35mm; display: flex; align-items: center; justify-content: center; }
      .qr-container img, .qr-container canvas { max-width: 100%; max-height: 100%; }
      .mode-code { font-size: 9pt; font-family: 'Courier New', monospace; font-weight: bold; text-align: center; }
      .mode-type-badge { display: inline-block; padding: 1mm 3mm; background: ${color}; color: white;
        font-size: 8pt; font-weight: bold; border-radius: 2mm; }
      .btn-print { padding: 12px 24px; background: ${color}; color: white; border: none;
        border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 20px; }
      @media print {
        body { padding: 0; }
        .btn-print { display: none; }
        .preview-section h2 { display: none; }
        .preview-label { border: none; margin: 0; page-break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <div class="preview-section">
      <h2>Operation Mode QR Code Preview</h2>
      <div class="preview-label">
        <div class="mode-header" id="mode-header"></div>
        <div class="qr-container" id="qrcode"></div>
        <div class="mode-code" id="mode-code"></div>
        <div class="mode-type-badge" id="mode-badge"></div>
      </div>
    </div>
    <button class="btn-print" onclick="window.print()">Print QR Code</button>
  </body>
</html>`);
    printWindow.document.close();

    const modeHeaderEl = printWindow.document.getElementById('mode-header');
    const modeCodeEl = printWindow.document.getElementById('mode-code');
    const modeBadgeEl = printWindow.document.getElementById('mode-badge');
    if (modeHeaderEl) modeHeaderEl.textContent = translatedName;
    if (modeCodeEl) modeCodeEl.textContent = mode.mode_code;
    if (modeBadgeEl) modeBadgeEl.textContent = translatedName;

    printWindow.addEventListener('load', () => {
      const win = printWindow as Window & { QRCode: new (el: HTMLElement, opts: object) => void };
      const qrEl = printWindow.document.getElementById('qrcode');
      if (qrEl && win.QRCode) {
        new win.QRCode(qrEl, {
          text: mode.mode_code,
          width: 120, height: 120,
          colorDark: color, colorLight: '#ffffff', correctLevel: 1,
        });
      }
    });
  };

  const getWarehouseName = (warehouseId: number) => {
    const warehouse = warehouses.find(w => w.warehouse_id === warehouseId);
    return warehouse?.name || 'Unknown';
  };

  return (
    <div className="min-h-[calc(100vh-120px)] bg-slate-100 p-4">
      <div className="max-w-[800px] mx-auto bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="flex items-center gap-3 bg-gradient-to-br from-blue-500 to-blue-700 text-white p-5">
          <button className="bg-white/20 border-none text-white w-9 h-9 rounded-lg text-lg cursor-pointer flex items-center justify-center duration-200 hover:bg-white/30" onClick={() => navigate('/')}>
            ←
          </button>
          <h2 className="m-0 text-white text-xl font-bold flex-1 leading-none">{t.locations}</h2>
        </div>
        <div className="p-4">
        <div className="flex gap-3 items-center flex-wrap md:flex-col md:items-stretch">
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="py-3 px-3 border-2 border-gray-200 rounded-md text-base bg-white cursor-pointer duration-200 min-w-[200px] focus:outline-none focus:border-blue-600 hover:border-gray-400 md:w-full md:min-w-0"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.warehouse_id} value={w.code}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="py-3 px-3 border-2 border-gray-200 rounded-md text-base bg-white cursor-pointer duration-200 min-w-[200px] focus:outline-none focus:border-blue-600 hover:border-gray-400 md:w-full md:min-w-0"
          >
            <option value="">All Zones</option>
            <option value="RECEIVING">Receiving</option>
            <option value="STORAGE">Storage</option>
            <option value="PICKING">Picking</option>
            <option value="SHIPPING">Shipping</option>
            <option value="CATEGORY">Category (Factory)</option>
          </select>
          <button onClick={() => setShowAddForm(!showAddForm)} className="py-3 px-5 bg-blue-600 text-white border-none rounded-md font-semibold cursor-pointer duration-200 whitespace-nowrap hover:bg-blue-700 md:w-full md:min-w-0">
            + Add Location
          </button>
        </div>

      {success && <div className="bg-emerald-100 text-emerald-800 p-4 rounded-md mb-4 font-medium mt-4">{success}</div>}
      {error && <div className="bg-red-100 text-red-800 p-4 rounded-md mb-4 mt-4">{error}</div>}

      {/* Add Location Form */}
      {showAddForm && (
        <div className="bg-white p-6 rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.1)] mb-6 mt-4 md:p-4 md:mb-4">
          <h3 className="m-0 mb-6 text-gray-800">Add New Location</h3>
          <form onSubmit={handleAddLocation}>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-4 md:grid-cols-1">
              <div className="flex flex-col">
                <label className="mb-2 font-semibold text-gray-700 text-[0.9rem]">Warehouse *</label>
                <select
                  value={newLocation.warehouse_code}
                  onChange={(e) => setNewLocation({ ...newLocation, warehouse_code: e.target.value })}
                  required
                  className="py-3 px-3 border-2 border-gray-200 rounded-md text-base duration-200 focus:outline-none focus:border-blue-600"
                >
                  {warehouses.map((w) => (
                    <option key={w.warehouse_id} value={w.code}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="mb-2 font-semibold text-gray-700 text-[0.9rem]">Location Code *</label>
                <input
                  type="text"
                  value={newLocation.location_code}
                  onChange={(e) => setNewLocation({ ...newLocation, location_code: e.target.value })}
                  placeholder="LOC-A01-01-01"
                  required
                  className="py-3 px-3 border-2 border-gray-200 rounded-md text-base duration-200 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="flex flex-col">
                <label className="mb-2 font-semibold text-gray-700 text-[0.9rem]">QR Code *</label>
                <input
                  type="text"
                  value={newLocation.qr_code}
                  onChange={(e) => setNewLocation({ ...newLocation, qr_code: e.target.value })}
                  placeholder="LOC-A01-01-01"
                  required
                  className="py-3 px-3 border-2 border-gray-200 rounded-md text-base duration-200 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-4 md:grid-cols-1">
              <div className="flex flex-col">
                <label className="mb-2 font-semibold text-gray-700 text-[0.9rem]">Zone</label>
                <select
                  value={newLocation.zone}
                  onChange={(e) => setNewLocation({ ...newLocation, zone: e.target.value })}
                  className="py-3 px-3 border-2 border-gray-200 rounded-md text-base duration-200 focus:outline-none focus:border-blue-600"
                >
                  <option value="">Select Zone</option>
                  <option value="RECEIVING">Receiving</option>
                  <option value="STORAGE">Storage</option>
                  <option value="PICKING">Picking</option>
                  <option value="SHIPPING">Shipping</option>
                  <option value="CATEGORY">Category (Factory)</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="mb-2 font-semibold text-gray-700 text-[0.9rem]">Aisle</label>
                <input
                  type="text"
                  value={newLocation.aisle}
                  onChange={(e) => setNewLocation({ ...newLocation, aisle: e.target.value })}
                  placeholder="A01"
                  className="py-3 px-3 border-2 border-gray-200 rounded-md text-base duration-200 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="flex flex-col">
                <label className="mb-2 font-semibold text-gray-700 text-[0.9rem]">Bay</label>
                <input
                  type="text"
                  value={newLocation.bay}
                  onChange={(e) => setNewLocation({ ...newLocation, bay: e.target.value })}
                  placeholder="01"
                  className="py-3 px-3 border-2 border-gray-200 rounded-md text-base duration-200 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="flex flex-col">
                <label className="mb-2 font-semibold text-gray-700 text-[0.9rem]">Level</label>
                <input
                  type="text"
                  value={newLocation.level}
                  onChange={(e) => setNewLocation({ ...newLocation, level: e.target.value })}
                  placeholder="01"
                  className="py-3 px-3 border-2 border-gray-200 rounded-md text-base duration-200 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-4 md:grid-cols-1">
              <div className="flex flex-col">
                <label className="mb-2 font-semibold text-gray-700 text-[0.9rem]">Location Type</label>
                <select
                  value={newLocation.location_type}
                  onChange={(e) => setNewLocation({ ...newLocation, location_type: e.target.value })}
                  className="py-3 px-3 border-2 border-gray-200 rounded-md text-base duration-200 focus:outline-none focus:border-blue-600"
                >
                  <option value="FLOOR">Floor</option>
                  <option value="RACK">Rack</option>
                  <option value="PALLET">Pallet</option>
                  <option value="BULK">Bulk</option>
                </select>
              </div>
              <div className="flex flex-col col-span-full">
                <label className="mb-2 font-semibold text-gray-700 text-[0.9rem]">Description</label>
                <input
                  type="text"
                  value={newLocation.description}
                  onChange={(e) => setNewLocation({ ...newLocation, description: e.target.value })}
                  placeholder="Aisle A, Rack 1, Level 1"
                  className="py-3 px-3 border-2 border-gray-200 rounded-md text-base duration-200 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="submit" className="py-3 px-5 bg-blue-600 text-white border-none rounded-md font-semibold cursor-pointer duration-200 whitespace-nowrap hover:bg-blue-700">Create Location</button>
              <button type="button" onClick={() => setShowAddForm(false)} className="py-3 px-5 bg-gray-500 text-white border-none rounded-md font-semibold cursor-pointer duration-200 hover:bg-gray-600">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <div className="text-center p-12 text-gray-500 text-lg">Loading locations...</div>}

      {!loading && (
        <div>
          {/* Action Barcodes Section */}
          <div className="py-4 mb-4 border-b border-gray-200">
            <h3 className="m-0 mb-4 text-gray-800">{t.actionBarcodes}</h3>
            <p className="m-0 mb-6 text-gray-500 text-[0.95rem]">
              {t.actionBarcodesHint}
            </p>
            <div className="grid grid-cols-2 gap-4 md:gap-3 sm:grid-cols-1">
              {operationModes
                .filter((mode) => mode.mode_code.startsWith('ACTION-'))
                .map((mode) => (
                  <div key={mode.mode_id} className="bg-gradient-to-br from-white to-slate-50 border-2 border-gray-200 rounded-xl p-5 flex flex-col gap-3 duration-200 shadow-[0_2px_4px_rgba(0,0,0,0.05)] hover:border-blue-600 hover:shadow-[0_4px_12px_rgba(37,99,235,0.15)] hover:-translate-y-0.5 md:p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="flex-1 flex flex-col gap-2 md:gap-1.5 sm:min-w-0">
                      <div className="text-lg font-bold text-gray-800 leading-snug md:text-[0.95rem]">{getTranslatedActionName(mode.mode_code)}</div>
                      <div className="font-mono text-[0.8rem] text-slate-500 bg-slate-100 py-1.5 px-2.5 rounded-md inline-block w-fit md:text-[0.7rem] md:py-1 md:px-2 sm:max-w-full sm:overflow-hidden sm:text-ellipsis sm:whitespace-nowrap">{mode.mode_code}</div>
                      <div className="text-[0.85rem] text-gray-500 leading-snug md:text-[0.8rem] md:line-clamp-2 md:overflow-hidden">{getTranslatedActionDescription(mode.mode_code)}</div>
                    </div>
                    <button
                      onClick={() => handlePrintOperationModeBarcode(mode)}
                      className="py-2 px-4 bg-blue-600 text-white border-none rounded-md font-semibold cursor-pointer duration-200 whitespace-nowrap text-[0.9rem] hover:bg-blue-700 md:py-1.5 md:px-3 md:text-[0.8rem] md:w-full md:justify-center sm:w-auto sm:shrink-0"
                    >
                      {t.print}
                    </button>
                  </div>
                ))}
            </div>
          </div>

          {/* Operation Modes Section */}
          <div className="py-4 mb-4 border-b border-gray-200">
            <h3 className="m-0 mb-4 text-gray-800">{t.operationModes}</h3>
            <p className="m-0 mb-6 text-gray-500 text-[0.95rem]">
              {t.operationModesHint}
            </p>
            <div className="grid grid-cols-2 gap-4 md:gap-3 sm:grid-cols-1">
              {operationModes
                .filter((mode) => !mode.mode_code.startsWith('ACTION-'))
                .map((mode) => (
                <div key={mode.mode_id} className="bg-gradient-to-br from-white to-slate-50 border-2 border-gray-200 rounded-xl p-5 flex flex-col gap-3 duration-200 shadow-[0_2px_4px_rgba(0,0,0,0.05)] hover:border-blue-600 hover:shadow-[0_4px_12px_rgba(37,99,235,0.15)] hover:-translate-y-0.5 md:p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="flex-1 flex flex-col gap-2 md:gap-1.5 sm:min-w-0">
                    <div className="text-lg font-bold text-gray-800 leading-snug md:text-[0.95rem]">{getTranslatedModeName(mode.mode_type)}</div>
                    <div className="font-mono text-[0.8rem] text-slate-500 bg-slate-100 py-1.5 px-2.5 rounded-md inline-block w-fit md:text-[0.7rem] md:py-1 md:px-2 sm:max-w-full sm:overflow-hidden sm:text-ellipsis sm:whitespace-nowrap">{mode.mode_code}</div>
                    <span className={`inline-block py-1 px-3 rounded-full text-xs font-semibold uppercase w-fit md:text-[0.65rem] md:py-0.5 md:px-2 ${MODE_TYPE_BADGE_CLASSES[mode.mode_type.toLowerCase()] || ''}`}>
                      {getTranslatedModeName(mode.mode_type)}
                    </span>
                    <div className="text-[0.85rem] text-gray-500 leading-snug md:text-[0.8rem] md:line-clamp-2 md:overflow-hidden">{getTranslatedModeDescription(mode.mode_type)}</div>
                  </div>
                  <button
                    onClick={() => handlePrintOperationModeBarcode(mode)}
                    className="py-2 px-4 bg-blue-600 text-white border-none rounded-md font-semibold cursor-pointer duration-200 whitespace-nowrap text-[0.9rem] hover:bg-blue-700 md:py-1.5 md:px-3 md:text-[0.8rem] md:w-full md:justify-center sm:w-auto sm:shrink-0"
                  >
                    {t.print}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Locations Grid */}
          <div className="py-4 mb-4 last:border-b-0 last:mb-0">
            <h3 className="m-0 mb-4 text-gray-800">{t.allLocations} ({locations.length})</h3>
            {locations.length === 0 ? (
              <div className="text-center p-12 text-gray-500 text-lg">{t.noData}</div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:gap-3 sm:grid-cols-1">
                {locations.map((location) => (
                  <div key={location.location_id} className="bg-gradient-to-br from-white to-slate-50 border-2 border-gray-200 rounded-xl overflow-hidden duration-200 shadow-[0_2px_4px_rgba(0,0,0,0.05)] hover:border-blue-600 hover:shadow-[0_4px_12px_rgba(37,99,235,0.15)] hover:-translate-y-0.5">
                    <div className="flex justify-between items-center py-3 px-4 bg-slate-600 md:py-2 md:px-3">
                      <span className="font-mono font-bold text-white text-base md:text-[0.85rem]">{location.location_code}</span>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase ${location.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'} md:text-[0.65rem] md:py-0.5 md:px-2`}>
                        {location.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="py-3 px-4 flex flex-col gap-2 md:py-2 md:px-3 md:gap-1.5">
                      <div className="flex justify-between items-center gap-2 sm:flex-wrap">
                        <span className="text-xs text-slate-500 font-medium uppercase md:text-[0.65rem]">{t.warehouse}:</span>
                        <span className="text-[0.85rem] text-slate-800 font-semibold md:text-xs">{getWarehouseName(location.warehouse_id)}</span>
                      </div>
                      {location.zone && (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-xs text-slate-500 font-medium uppercase md:text-[0.65rem]">{t.zone}:</span>
                          <span className={`inline-block py-1 px-3 rounded-full text-xs font-semibold uppercase ${ZONE_BADGE_CLASSES[location.zone.toLowerCase()] || ''}`}>
                            {location.zone}
                          </span>
                        </div>
                      )}
                      {location.location_type && (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-xs text-slate-500 font-medium uppercase md:text-[0.65rem]">{t.locationType}:</span>
                          <span className="text-[0.85rem] text-slate-800 font-semibold md:text-xs">{location.location_type}</span>
                        </div>
                      )}
                      {(location.aisle || location.bay || location.level) && (
                        <div className="flex justify-between items-center gap-2 sm:flex-wrap">
                          <span className="text-xs text-slate-500 font-medium uppercase md:text-[0.65rem]">Aisle/Bay/Level:</span>
                          <span className="text-[0.85rem] text-slate-800 font-semibold md:text-xs">
                            {`${location.aisle || '-'}/${location.bay || '-'}/${location.level || '-'}`}
                          </span>
                        </div>
                      )}
                      {location.description && (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-xs text-slate-500 font-medium uppercase md:text-[0.65rem]">{t.description}:</span>
                          <span className="text-[0.85rem] text-slate-800 font-semibold md:text-xs">{location.description}</span>
                        </div>
                      )}
                    </div>
                    <div className="py-3 px-4 bg-slate-50 border-t border-gray-200 md:py-2 md:px-3">
                      <button
                        onClick={() => handlePrintLocationBarcode(location)}
                        className="w-full py-2 px-4 bg-blue-600 text-white border-none rounded-md font-semibold cursor-pointer duration-200 whitespace-nowrap text-[0.9rem] hover:bg-blue-700 md:py-1.5 md:px-3 md:text-[0.8rem]"
                      >
                        {t.print}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
      </div>
    </div>
  );
}

export default Locations;
