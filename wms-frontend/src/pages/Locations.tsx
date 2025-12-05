import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import { useStore } from '../store/useStore';
import { translations } from '../i18n/translations';
import type { Location, OperationMode, Warehouse } from '../types';
import './Locations.css';

function Locations() {
  const { language } = useStore();
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
    warehouse_code: 'USA',
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
      // Load locations
      const locationsResponse = await apiClient.getAllLocations(
        warehouseFilter || undefined,
        zoneFilter || undefined
      );

      if (locationsResponse.success) {
        setLocations(locationsResponse.data || []);
      }

      // Load operation modes
      const modesResponse = await apiClient.getAllOperationModes();
      if (modesResponse.success) {
        setOperationModes(modesResponse.data || []);
      }

      // Load warehouses
      const warehousesResponse = await apiClient.getAllWarehouses();
      if (warehousesResponse.success) {
        setWarehouses(warehousesResponse.data || []);
      }
    } catch (err: any) {
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
          warehouse_code: 'USA',
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create location');
    }
  };

  const handlePrintLocationBarcode = (location: Location) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Location QR Code - ${location.location_code}</title>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .preview-section {
              margin-bottom: 30px;
              text-align: center;
            }
            .preview-label {
              width: 60mm;
              height: 60mm;
              border: 2px solid #2563eb;
              padding: 3mm;
              background: white;
              display: inline-flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 2mm;
            }
            .location-header {
              font-size: 14pt;
              font-weight: bold;
              color: #2563eb;
              text-align: center;
            }
            .location-description {
              font-size: 8pt;
              color: #666;
              text-align: center;
            }
            .qr-container {
              width: 35mm;
              height: 35mm;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .qr-container img, .qr-container canvas {
              max-width: 100%;
              max-height: 100%;
            }
            .location-code {
              font-size: 10pt;
              font-family: 'Courier New', monospace;
              font-weight: bold;
              text-align: center;
            }
            .zone-badge {
              display: inline-block;
              padding: 1mm 3mm;
              background: #10b981;
              color: white;
              font-size: 8pt;
              font-weight: bold;
              border-radius: 2mm;
            }
            .btn-print {
              padding: 12px 24px;
              background: #2563eb;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              margin-top: 20px;
            }
            .btn-print:hover {
              background: #1d4ed8;
            }
            @media print {
              body { padding: 0; }
              .btn-print { display: none; }
              .preview-section h2 { display: none; }
              .preview-label {
                border: none;
                margin: 0;
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="preview-section">
            <h2>📍 Location QR Code Preview</h2>
            <div class="preview-label">
              <div class="location-header">LOCATION</div>
              <div class="qr-container" id="qrcode"></div>
              <div class="location-code">${location.location_code}</div>
              ${location.zone ? `<div class="zone-badge">${location.zone}</div>` : ''}
            </div>
          </div>
          <button class="btn-print" onclick="window.print()">🖨️ Print QR Code</button>
          <script>
            new QRCode(document.getElementById('qrcode'), {
              text: '${location.location_code}',
              width: 120,
              height: 120,
              colorDark: '#2563eb',
              colorLight: '#ffffff',
              correctLevel: QRCode.CorrectLevel.M
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintOperationModeBarcode = (mode: OperationMode) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const allColors: Record<string, string> = {
      // Operation Modes (database values)
      'MODE-IN-RECEIVING': '#10b981',    // Yeşil - Mal Kabul
      'MODE-OUT-PICKING': '#f59e0b',     // Turuncu - Toplama
      'MODE-MOVE-TRANSFER': '#3b82f6',   // Mavi - Transfer
      'MODE-COUNT-CYCLE': '#8b5cf6',     // Mor - Sayım
      // Action Barcodes
      'ACTION-CREATE-BOX': '#ec4899',    // Pembe
      'ACTION-CREATE-PALLET': '#14b8a6', // Teal
      'ACTION-COMPLETE': '#6366f1',      // İndigo
      'ACTION-CANCEL': '#dc2626',        // Kırmızı
    };

    // Determine color based on mode_code
    const color = allColors[mode.mode_code] || '#6b7280';

    // Get translated name and description
    const translatedName = mode.mode_code.startsWith('ACTION-')
      ? getTranslatedActionName(mode.mode_code)
      : getTranslatedModeName(mode.mode_type);

    const _translatedDesc = mode.mode_code.startsWith('ACTION-')
      ? getTranslatedActionDescription(mode.mode_code)
      : getTranslatedModeDescription(mode.mode_type);
    void _translatedDesc;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Operation Mode - ${translatedName}</title>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .preview-section {
              margin-bottom: 30px;
              text-align: center;
            }
            .preview-label {
              width: 60mm;
              height: 60mm;
              border: 2px solid ${color};
              padding: 3mm;
              background: white;
              display: inline-flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 2mm;
            }
            .mode-header {
              font-size: 14pt;
              font-weight: bold;
              color: ${color};
              text-align: center;
            }
            .mode-description {
              font-size: 8pt;
              color: #666;
              text-align: center;
            }
            .qr-container {
              width: 35mm;
              height: 35mm;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .qr-container img, .qr-container canvas {
              max-width: 100%;
              max-height: 100%;
            }
            .mode-code {
              font-size: 9pt;
              font-family: 'Courier New', monospace;
              font-weight: bold;
              text-align: center;
            }
            .mode-type-badge {
              display: inline-block;
              padding: 1mm 3mm;
              background: ${color};
              color: white;
              font-size: 8pt;
              font-weight: bold;
              border-radius: 2mm;
            }
            .btn-print {
              padding: 12px 24px;
              background: ${color};
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              margin-top: 20px;
            }
            .btn-print:hover {
              opacity: 0.9;
            }
            @media print {
              body { padding: 0; }
              .btn-print { display: none; }
              .preview-section h2 { display: none; }
              .preview-label {
                border: none;
                margin: 0;
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="preview-section">
            <h2>🔄 Operation Mode QR Code Preview</h2>
            <div class="preview-label">
              <div class="mode-header">${translatedName}</div>
              <div class="qr-container" id="qrcode"></div>
              <div class="mode-code">${mode.mode_code}</div>
              <div class="mode-type-badge">${translatedName}</div>
            </div>
          </div>
          <button class="btn-print" onclick="window.print()">🖨️ ${t.print} QR Code</button>
          <script>
            new QRCode(document.getElementById('qrcode'), {
              text: '${mode.mode_code}',
              width: 120,
              height: 120,
              colorDark: '${color}',
              colorLight: '#ffffff',
              correctLevel: QRCode.CorrectLevel.M
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getWarehouseName = (warehouseId: number) => {
    const warehouse = warehouses.find(w => w.warehouse_id === warehouseId);
    return warehouse?.name || 'Unknown';
  };

  return (
    <div className="locations-page">
      <div className="locations-card">
        <div className="locations-header">
          <h2>{t.locations}</h2>
        </div>
        <div className="locations-content">
        <div className="header-actions">
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="filter-select"
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
            className="filter-select"
          >
            <option value="">All Zones</option>
            <option value="RECEIVING">Receiving</option>
            <option value="STORAGE">Storage</option>
            <option value="PICKING">Picking</option>
            <option value="SHIPPING">Shipping</option>
            <option value="CATEGORY">Category (Factory)</option>
          </select>
          <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary">
            ➕ Add Location
          </button>
        </div>

      {success && <div className="success">✅ {success}</div>}
      {error && <div className="error">❌ {error}</div>}

      {/* Add Location Form */}
      {showAddForm && (
        <div className="add-form-container">
          <h3>Add New Location</h3>
          <form onSubmit={handleAddLocation}>
            <div className="form-row">
              <div className="form-group">
                <label>Warehouse *</label>
                <select
                  value={newLocation.warehouse_code}
                  onChange={(e) => setNewLocation({ ...newLocation, warehouse_code: e.target.value })}
                  required
                >
                  {warehouses.map((w) => (
                    <option key={w.warehouse_id} value={w.code}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Location Code *</label>
                <input
                  type="text"
                  value={newLocation.location_code}
                  onChange={(e) => setNewLocation({ ...newLocation, location_code: e.target.value })}
                  placeholder="LOC-A01-01-01"
                  required
                />
              </div>
              <div className="form-group">
                <label>QR Code *</label>
                <input
                  type="text"
                  value={newLocation.qr_code}
                  onChange={(e) => setNewLocation({ ...newLocation, qr_code: e.target.value })}
                  placeholder="LOC-A01-01-01"
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Zone</label>
                <select
                  value={newLocation.zone}
                  onChange={(e) => setNewLocation({ ...newLocation, zone: e.target.value })}
                >
                  <option value="">Select Zone</option>
                  <option value="RECEIVING">Receiving</option>
                  <option value="STORAGE">Storage</option>
                  <option value="PICKING">Picking</option>
                  <option value="SHIPPING">Shipping</option>
                  <option value="CATEGORY">Category (Factory)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Aisle</label>
                <input
                  type="text"
                  value={newLocation.aisle}
                  onChange={(e) => setNewLocation({ ...newLocation, aisle: e.target.value })}
                  placeholder="A01"
                />
              </div>
              <div className="form-group">
                <label>Bay</label>
                <input
                  type="text"
                  value={newLocation.bay}
                  onChange={(e) => setNewLocation({ ...newLocation, bay: e.target.value })}
                  placeholder="01"
                />
              </div>
              <div className="form-group">
                <label>Level</label>
                <input
                  type="text"
                  value={newLocation.level}
                  onChange={(e) => setNewLocation({ ...newLocation, level: e.target.value })}
                  placeholder="01"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Location Type</label>
                <select
                  value={newLocation.location_type}
                  onChange={(e) => setNewLocation({ ...newLocation, location_type: e.target.value })}
                >
                  <option value="FLOOR">Floor</option>
                  <option value="RACK">Rack</option>
                  <option value="PALLET">Pallet</option>
                  <option value="BULK">Bulk</option>
                </select>
              </div>
              <div className="form-group full-width">
                <label>Description</label>
                <input
                  type="text"
                  value={newLocation.description}
                  onChange={(e) => setNewLocation({ ...newLocation, description: e.target.value })}
                  placeholder="Aisle A, Rack 1, Level 1"
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary">Create Location</button>
              <button type="button" onClick={() => setShowAddForm(false)} className="btn-cancel">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <div className="loading">Loading locations...</div>}

      {!loading && (
        <div>
          {/* Action Barcodes Section */}
          <div className="section">
            <h3>⚡ {t.actionBarcodes}</h3>
            <p className="section-description">
              {t.actionBarcodesHint}
            </p>
            <div className="modes-grid">
              {operationModes
                .filter((mode) => mode.mode_code.startsWith('ACTION-'))
                .map((mode) => (
                  <div key={mode.mode_id} className="mode-card">
                    <div className="mode-info">
                      <div className="mode-name">{getTranslatedActionName(mode.mode_code)}</div>
                      <div className="mode-code">{mode.mode_code}</div>
                      <div className="mode-description">{getTranslatedActionDescription(mode.mode_code)}</div>
                    </div>
                    <button
                      onClick={() => handlePrintOperationModeBarcode(mode)}
                      className="btn-print-small"
                    >
                      🖨️ {t.print}
                    </button>
                  </div>
                ))}
            </div>
          </div>

          {/* Operation Modes Section */}
          <div className="section">
            <h3>🔄 {t.operationModes}</h3>
            <p className="section-description">
              {t.operationModesHint}
            </p>
            <div className="modes-grid">
              {operationModes
                .filter((mode) => !mode.mode_code.startsWith('ACTION-'))
                .map((mode) => (
                <div key={mode.mode_id} className="mode-card">
                  <div className="mode-info">
                    <div className="mode-name">{getTranslatedModeName(mode.mode_type)}</div>
                    <div className="mode-code">{mode.mode_code}</div>
                    <div className={`mode-type-badge ${mode.mode_type.toLowerCase()}`}>
                      {getTranslatedModeName(mode.mode_type)}
                    </div>
                    <div className="mode-description">{getTranslatedModeDescription(mode.mode_type)}</div>
                  </div>
                  <button
                    onClick={() => handlePrintOperationModeBarcode(mode)}
                    className="btn-print-small"
                  >
                    🖨️ {t.print}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Locations Table */}
          <div className="section">
            <h3>📦 {t.allLocations} ({locations.length})</h3>
            {locations.length === 0 ? (
              <div className="empty-state">{t.noData}</div>
            ) : (
              <div className="table-container">
                <table className="locations-table">
                  <thead>
                    <tr>
                      <th>{t.location}</th>
                      <th>{t.warehouse}</th>
                      <th>{t.zone}</th>
                      <th>{t.locationType}</th>
                      <th>Aisle/Bay/Level</th>
                      <th>{t.description}</th>
                      <th>Status</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locations.map((location) => (
                      <tr key={location.location_id}>
                        <td className="location-code">{location.location_code}</td>
                        <td>{getWarehouseName(location.warehouse_id)}</td>
                        <td>
                          {location.zone && (
                            <span className={`zone-badge ${location.zone.toLowerCase()}`}>
                              {location.zone}
                            </span>
                          )}
                        </td>
                        <td>{location.location_type || '-'}</td>
                        <td className="hierarchy">
                          {location.aisle || location.bay || location.level ? (
                            `${location.aisle || '-'}/${location.bay || '-'}/${location.level || '-'}`
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>{location.description || '-'}</td>
                        <td>
                          <span className={`status-badge ${location.is_active ? 'active' : 'inactive'}`}>
                            {location.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="text-center">
                          <button
                            onClick={() => handlePrintLocationBarcode(location)}
                            className="btn-icon"
                            title="Print Barcode"
                          >
                            🖨️
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
      )}
      </div>
      </div>
    </div>
  );
}

export default Locations;
