import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { shipmentApi, apiClient } from '../lib/api';
import { useStore } from '../stores/appStore';
import { useSSOStore } from '../stores/ssoStore';
import type { VirtualShipment, ShipmentBox, Warehouse } from '../types';
import './Shipments.css';

// ── Sevkiyat Kuralları ─────────────────────────────────────────────────────────
// FACTORY → Sanal sevkiyat YAPILAMAZ (önce TR'ye girmeli)
// UK, NL  → Final hedef, çıkış yapılamaz
// TR      → NJ / NL / UK (depo transferi) + USA / FBA (pazar yeri)
// NJ      → USA / FBA (pazar yeri) only

const OUTBOUND_WAREHOUSES = ['TR', 'NJ'];

interface DestInfo {
  label_tr: string;
  label_en: string;
  group: 'warehouse' | 'marketplace';
}

const DEST_INFO: Record<string, DestInfo> = {
  NJ:  { label_tr: 'NJ Deposu',  label_en: 'NJ Depot',   group: 'warehouse'   },
  NL:  { label_tr: 'NL Deposu',  label_en: 'NL Depot',   group: 'warehouse'   },
  UK:  { label_tr: 'UK Deposu',  label_en: 'UK Depot',   group: 'warehouse'   },
  USA: { label_tr: 'ABD Pazar',  label_en: 'US Market',  group: 'marketplace' },
  FBA: { label_tr: 'Amazon FBA', label_en: 'Amazon FBA', group: 'marketplace' },
};

const getAvailableDestinations = (warehouseCode?: string): string[] => {
  if (warehouseCode === 'TR') return ['NJ', 'NL', 'UK', 'USA', 'FBA'];
  if (warehouseCode === 'NJ') return ['USA', 'FBA'];
  return [];
};

const ALL_DEST_KEYS = ['NJ', 'NL', 'UK', 'USA', 'FBA'] as const;

function Shipments() {
  const navigate = useNavigate();
  const { language } = useStore();
  const { wmsUser: user } = useSSOStore();

  const [shipments, setShipments] = useState<VirtualShipment[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<VirtualShipment | null>(null);
  const [boxes, setBoxes] = useState<ShipmentBox[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [newBoxDestination, setNewBoxDestination] = useState<string>('');

  const [newShipment, setNewShipment] = useState({
    prefix: '',
    warehouse_id: 0,
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const outboundWarehouses = warehouses.filter(w => OUTBOUND_WAREHOUSES.includes(w.code));

  const loadData = async () => {
    setLoading(true);
    try {
      const [shipmentsRes, warehousesRes] = await Promise.all([
        shipmentApi.getAll(statusFilter ? { status: statusFilter } : undefined),
        apiClient.getAllWarehouses(),
      ]);

      if (shipmentsRes.success) {
        setShipments(shipmentsRes.data || []);
      }
      if (warehousesRes.success) {
        const all: Warehouse[] = warehousesRes.data || [];
        setWarehouses(all);
        if (newShipment.warehouse_id === 0) {
          const outbound = all.filter(w => OUTBOUND_WAREHOUSES.includes(w.code));
          const trWarehouse = outbound.find(w => w.code === 'TR') || outbound[0];
          if (trWarehouse) {
            setNewShipment(prev => ({ ...prev, warehouse_id: trWarehouse.warehouse_id }));
          }
        }
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newShipment.prefix || !newShipment.warehouse_id) {
      setError(language === 'tr' ? 'Prefix ve depo zorunludur' : 'Prefix and warehouse are required');
      return;
    }

    try {
      const response = await shipmentApi.create({
        ...newShipment,
        created_by: user?.username || 'system',
      });

      if (response.success) {
        setSuccess(language === 'tr' ? 'Sevkiyat oluşturuldu' : 'Shipment created');
        setShowCreateModal(false);
        const trWarehouse = outboundWarehouses.find(w => w.code === 'TR') || outboundWarehouses[0];
        setNewShipment({ prefix: '', warehouse_id: trWarehouse?.warehouse_id || 0, notes: '' });
        loadData();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to create shipment');
    }
  };

  const handleSelectShipment = async (shipment: VirtualShipment) => {
    setSelectedShipment(shipment);
    const dests = getAvailableDestinations(shipment.warehouse_code);
    setNewBoxDestination(dests[0] || '');
    try {
      const response = await shipmentApi.getBoxes(shipment.shipment_id);
      if (response.success) {
        setBoxes(response.data || []);
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to load boxes');
    }
  };

  const handleCreateBox = async () => {
    if (!selectedShipment || !newBoxDestination) return;
    try {
      const response = await shipmentApi.createBox(selectedShipment.shipment_id, {
        destination: newBoxDestination,
        created_by: user?.username || 'system',
      });

      if (response.success) {
        setSuccess(
          language === 'tr'
            ? `Koli oluşturuldu: ${response.data.barcode}`
            : `Box created: ${response.data.barcode}`
        );
        handleSelectShipment(selectedShipment);
        loadData();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to create box');
    }
  };

  const handleCloseShipment = async (shipment: VirtualShipment) => {
    if (!confirm(
      language === 'tr'
        ? 'Sevkiyatı kapatmak istediğinize emin misiniz?'
        : 'Are you sure you want to close this shipment?'
    )) return;

    try {
      const response = await shipmentApi.close(shipment.shipment_id);
      if (response.success) {
        setSuccess(language === 'tr' ? 'Sevkiyat kapatıldı' : 'Shipment closed');
        loadData();
        if (selectedShipment?.shipment_id === shipment.shipment_id) {
          setSelectedShipment(null);
          setBoxes([]);
        }
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to close shipment');
    }
  };

  const handleShipShipment = async (shipment: VirtualShipment) => {
    if (!confirm(
      language === 'tr'
        ? 'Sevkiyatı gönderildi olarak işaretlemek istediğinize emin misiniz?'
        : 'Are you sure you want to mark this shipment as shipped?'
    )) return;

    try {
      const response = await shipmentApi.ship(shipment.shipment_id);
      if (response.success) {
        setSuccess(language === 'tr' ? 'Sevkiyat gönderildi' : 'Shipment marked as shipped');
        loadData();
        if (selectedShipment?.shipment_id === shipment.shipment_id) {
          setSelectedShipment(null);
          setBoxes([]);
        }
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to ship shipment');
    }
  };

  const handleUpdateBoxDestination = async (box: ShipmentBox, newDest: string) => {
    try {
      const response = await shipmentApi.updateBoxDestination(box.box_id, newDest);
      if (response.success) {
        if (selectedShipment) handleSelectShipment(selectedShipment);
        loadData();
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to update destination');
    }
  };

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      OPEN: 'status-open', CLOSED: 'status-closed',
      SHIPPED: 'status-shipped', CANCELLED: 'status-cancelled',
    };
    const labels: Record<string, string> = {
      OPEN:      language === 'tr' ? 'Açık'       : 'Open',
      CLOSED:    language === 'tr' ? 'Kapalı'     : 'Closed',
      SHIPPED:   language === 'tr' ? 'Gönderildi' : 'Shipped',
      CANCELLED: language === 'tr' ? 'İptal'      : 'Cancelled',
    };
    return <span className={`status-badge ${classes[status] || ''}`}>{labels[status] || status}</span>;
  };

  const getDestinationBadge = (destination: string) => (
    <span className={`destination-badge dest-${destination.toLowerCase()}`}>{destination}</span>
  );

  const getBoxBreakdown = (shipment: VirtualShipment) =>
    ALL_DEST_KEYS
      .map(dest => ({
        dest,
        count: (shipment[`${dest.toLowerCase()}_boxes` as keyof VirtualShipment] as number) || 0,
      }))
      .filter(x => x.count > 0);

  const availableDests = getAvailableDestinations(selectedShipment?.warehouse_code);

  return (
    <div className="shipments-page">
      <div className="shipments-card">
        <div className="shipments-header">
          <button className="back-btn" onClick={() => navigate('/')}>←</button>
          <h2>{language === 'tr' ? 'Sevkiyat' : 'Shipments'}</h2>
          <button className="add-btn" onClick={() => setShowCreateModal(true)}>
            + {language === 'tr' ? 'Yeni' : 'New'}
          </button>
        </div>

        <div className="shipments-content">
          {success && <div className="success-message">{success}</div>}
          {error && <div className="error-message">{error}</div>}

          <div className="filter-bar">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
              <option value="">{language === 'tr' ? 'Tüm Durumlar' : 'All Statuses'}</option>
              <option value="OPEN">{language === 'tr' ? 'Açık' : 'Open'}</option>
              <option value="CLOSED">{language === 'tr' ? 'Kapalı' : 'Closed'}</option>
              <option value="SHIPPED">{language === 'tr' ? 'Gönderildi' : 'Shipped'}</option>
            </select>
          </div>

          {loading ? (
            <div className="loading">{language === 'tr' ? 'Yükleniyor...' : 'Loading...'}</div>
          ) : (
            <div className="shipments-layout">
              {/* Sevkiyat Listesi */}
              <div className="shipments-list">
                <h3>{language === 'tr' ? 'Sevkiyatlar' : 'Shipments'} ({shipments.length})</h3>
                {shipments.length === 0 ? (
                  <div className="empty-state">
                    {language === 'tr' ? 'Sevkiyat bulunamadı' : 'No shipments found'}
                  </div>
                ) : (
                  <div className="shipment-cards">
                    {shipments.map((shipment) => {
                      const breakdown = getBoxBreakdown(shipment);
                      const totalBoxes = breakdown.reduce((s, x) => s + x.count, 0);
                      return (
                        <div
                          key={shipment.shipment_id}
                          className={`shipment-card ${selectedShipment?.shipment_id === shipment.shipment_id ? 'selected' : ''}`}
                          onClick={() => handleSelectShipment(shipment)}
                        >
                          <div className="shipment-card-header">
                            <span className="shipment-prefix">{shipment.prefix}</span>
                            {getStatusBadge(shipment.status)}
                          </div>

                          {shipment.warehouse_name && (
                            <div className="shipment-meta">
                              <span className="shipment-meta-label">
                                {language === 'tr' ? 'Kaynak' : 'From'}:
                              </span>{' '}
                              <span className="shipment-meta-value">
                                {shipment.warehouse_name}{' '}
                                <span className={`warehouse-tag wh-${(shipment.warehouse_code || '').toLowerCase()}`}>
                                  {shipment.warehouse_code}
                                </span>
                              </span>
                            </div>
                          )}

                          <div className="shipment-stats">
                            <span>{totalBoxes} {language === 'tr' ? 'koli' : 'box'}</span>
                          </div>

                          {breakdown.length > 0 && (
                            <div className="shipment-destinations">
                              {breakdown.map(({ dest, count }) => (
                                <span key={dest} className={`dest-count dest-${dest.toLowerCase()}`}>
                                  {dest}: {count}
                                </span>
                              ))}
                            </div>
                          )}

                          {shipment.status === 'OPEN' && (
                            <div className="shipment-actions">
                              <button
                                className="btn-close-shipment"
                                onClick={(e) => { e.stopPropagation(); handleCloseShipment(shipment); }}
                              >
                                {language === 'tr' ? 'Kapat' : 'Close'}
                              </button>
                            </div>
                          )}
                          {shipment.status === 'CLOSED' && (
                            <div className="shipment-actions">
                              <button
                                className="btn-ship"
                                onClick={(e) => { e.stopPropagation(); handleShipShipment(shipment); }}
                              >
                                {language === 'tr' ? 'Gönder' : 'Ship'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Koli Paneli */}
              {selectedShipment && (
                <div className="boxes-panel">
                  <div className="boxes-header">
                    <div>
                      <h3>{selectedShipment.prefix}</h3>
                      <div className="route-info">
                        <span className={`warehouse-tag wh-${(selectedShipment.warehouse_code || '').toLowerCase()}`}>
                          {selectedShipment.warehouse_code}
                        </span>
                        {availableDests.length > 0 && (
                          <>
                            {' → '}
                            {availableDests.map((d, i) => (
                              <span key={d}>
                                {i > 0 && ' / '}
                                <span className={`route-dest dest-${d.toLowerCase()}`}>{d}</span>
                              </span>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                    {selectedShipment.status === 'OPEN' && availableDests.length > 0 && (
                      <div className="create-box-row">
                        <select
                          value={newBoxDestination}
                          onChange={(e) => setNewBoxDestination(e.target.value)}
                          className="dest-select-inline"
                        >
                          {availableDests.map(dest => (
                            <option key={dest} value={dest}>
                              {language === 'tr' ? DEST_INFO[dest]?.label_tr : DEST_INFO[dest]?.label_en}
                            </option>
                          ))}
                        </select>
                        <button className="btn-create-box-inline" onClick={handleCreateBox}>
                          + {language === 'tr' ? 'Koli' : 'Box'}
                        </button>
                      </div>
                    )}
                  </div>

                  {boxes.length === 0 ? (
                    <div className="empty-state">{language === 'tr' ? 'Henüz koli yok' : 'No boxes yet'}</div>
                  ) : (
                    <div className="boxes-grid">
                      {boxes.map((box) => (
                        <div key={box.box_id} className={`box-card ${box.status.toLowerCase()}`}>
                          <div className="box-header">
                            <span className="box-barcode">{box.barcode}</span>
                            {getDestinationBadge(box.destination)}
                          </div>
                          <div className="box-stats">
                            <span>{box.contents?.length ?? 0} {language === 'tr' ? 'ürün' : 'items'}</span>
                          </div>
                          {box.status === 'OPEN' && selectedShipment.status === 'OPEN' && (
                            <div className="box-actions">
                              <select
                                value={box.destination}
                                onChange={(e) => handleUpdateBoxDestination(box, e.target.value)}
                                className="destination-select"
                              >
                                {availableDests.map(dest => (
                                  <option key={dest} value={dest}>{dest}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          {box.contents && box.contents.length > 0 && (
                            <div className="box-contents">
                              {box.contents.map((content) => (
                                <div key={content.content_id} className="content-item">
                                  <span className="content-name">{content.product_name || content.sku_code}</span>
                                  <span className="content-qty">x{content.quantity}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Yeni Sevkiyat Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{language === 'tr' ? 'Yeni Sevkiyat' : 'New Shipment'}</h3>

            {outboundWarehouses.length === 0 ? (
              <div className="shipment-rule-info">
                {language === 'tr'
                  ? 'Sevkiyat başlatılabilecek depo bulunamadı. TR veya NJ deposu gereklidir.'
                  : 'No outbound warehouse found. TR or NJ warehouse is required.'}
              </div>
            ) : (
              <form onSubmit={handleCreateShipment}>
                <div className="shipment-rule-info">
                  <strong>TR</strong> → NJ / NL / UK / ABD Pazar / FBA<br />
                  <strong>NJ</strong> → ABD Pazar / FBA
                </div>
                <div className="form-group">
                  <label>{language === 'tr' ? 'Prefix (Koli Ön Eki)' : 'Prefix (Box Barcode Prefix)'} *</label>
                  <input
                    type="text"
                    value={newShipment.prefix}
                    onChange={(e) => setNewShipment({ ...newShipment, prefix: e.target.value.toUpperCase() })}
                    placeholder="IST, NYC, LA..."
                    required
                    maxLength={20}
                  />
                  <small>
                    {language === 'tr'
                      ? 'Örn: IST → Koliler: IST-00001, IST-00002...'
                      : 'Ex: IST → Boxes: IST-00001, IST-00002...'}
                  </small>
                </div>
                <div className="form-group">
                  <label>{language === 'tr' ? 'Kaynak Depo' : 'Source Warehouse'} *</label>
                  <select
                    value={newShipment.warehouse_id}
                    onChange={(e) => setNewShipment({ ...newShipment, warehouse_id: Number(e.target.value) })}
                    required
                  >
                    {outboundWarehouses.map((w) => (
                      <option key={w.warehouse_id} value={w.warehouse_id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>{language === 'tr' ? 'Notlar' : 'Notes'}</label>
                  <textarea
                    value={newShipment.notes}
                    onChange={(e) => setNewShipment({ ...newShipment, notes: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-cancel" onClick={() => setShowCreateModal(false)}>
                    {language === 'tr' ? 'İptal' : 'Cancel'}
                  </button>
                  <button type="submit" className="btn-save">
                    {language === 'tr' ? 'Oluştur' : 'Create'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Shipments;
