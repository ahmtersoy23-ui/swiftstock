import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { shipmentApi, apiClient } from '../lib/api';
import { useStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import type { VirtualShipment, ShipmentBox, Warehouse } from '../types';
import './Shipments.css';

function Shipments() {
  const navigate = useNavigate();
  const { language } = useStore();
  const { user } = useAuthStore();

  const [shipments, setShipments] = useState<VirtualShipment[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // UI State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<VirtualShipment | null>(null);
  const [boxes, setBoxes] = useState<ShipmentBox[]>([]);
  const [statusFilter, setStatusFilter] = useState('');

  // Form state
  const [newShipment, setNewShipment] = useState({
    prefix: '',
    name: '',
    source_warehouse_id: 0,
    default_destination: 'USA' as 'USA' | 'FBA',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [statusFilter]);

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
        setWarehouses(warehousesRes.data || []);
        if (warehousesRes.data?.length > 0 && newShipment.source_warehouse_id === 0) {
          setNewShipment(prev => ({ ...prev, source_warehouse_id: warehousesRes.data[0].warehouse_id }));
        }
      }
    } catch (err: any) {
      setError(err.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newShipment.prefix || !newShipment.name || !newShipment.source_warehouse_id) {
      setError(language === 'tr' ? 'Prefix, isim ve depo zorunludur' : 'Prefix, name and warehouse are required');
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
        setNewShipment({
          prefix: '',
          name: '',
          source_warehouse_id: warehouses[0]?.warehouse_id || 0,
          default_destination: 'USA',
          notes: '',
        });
        loadData();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      setError(err.error || 'Failed to create shipment');
    }
  };

  const handleSelectShipment = async (shipment: VirtualShipment) => {
    setSelectedShipment(shipment);
    try {
      const response = await shipmentApi.getBoxes(shipment.shipment_id);
      if (response.success) {
        setBoxes(response.data || []);
      }
    } catch (err: any) {
      setError(err.error || 'Failed to load boxes');
    }
  };

  const handleCreateBox = async (destination: 'USA' | 'FBA') => {
    if (!selectedShipment) return;

    try {
      const response = await shipmentApi.createBox(selectedShipment.shipment_id, {
        destination,
        created_by: user?.username || 'system',
      });

      if (response.success) {
        setSuccess(language === 'tr' ? 'Koli oluşturuldu: ' + response.data.barcode : 'Box created: ' + response.data.barcode);
        handleSelectShipment(selectedShipment);
        loadData();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      setError(err.error || 'Failed to create box');
    }
  };

  const handleCloseShipment = async (shipment: VirtualShipment) => {
    if (!confirm(language === 'tr' ? 'Sevkiyatı kapatmak istediğinize emin misiniz?' : 'Are you sure you want to close this shipment?')) {
      return;
    }

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
    } catch (err: any) {
      setError(err.error || 'Failed to close shipment');
    }
  };

  const handleShipShipment = async (shipment: VirtualShipment) => {
    if (!confirm(language === 'tr' ? 'Sevkiyatı gönderildi olarak işaretlemek istediğinize emin misiniz?' : 'Are you sure you want to mark this shipment as shipped?')) {
      return;
    }

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
    } catch (err: any) {
      setError(err.error || 'Failed to ship shipment');
    }
  };

  const handleUpdateBoxDestination = async (box: ShipmentBox, newDestination: 'USA' | 'FBA') => {
    try {
      const response = await shipmentApi.updateBoxDestination(box.box_id, newDestination);
      if (response.success) {
        if (selectedShipment) {
          handleSelectShipment(selectedShipment);
        }
        loadData();
      }
    } catch (err: any) {
      setError(err.error || 'Failed to update destination');
    }
  };

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      'OPEN': 'status-open',
      'CLOSED': 'status-closed',
      'SHIPPED': 'status-shipped',
      'CANCELLED': 'status-cancelled',
    };
    const labels: Record<string, string> = {
      'OPEN': language === 'tr' ? 'Açık' : 'Open',
      'CLOSED': language === 'tr' ? 'Kapalı' : 'Closed',
      'SHIPPED': language === 'tr' ? 'Gönderildi' : 'Shipped',
      'CANCELLED': language === 'tr' ? 'İptal' : 'Cancelled',
    };
    return <span className={`status-badge ${classes[status] || ''}`}>{labels[status] || status}</span>;
  };

  const getDestinationBadge = (destination: string) => {
    return (
      <span className={`destination-badge ${destination.toLowerCase()}`}>
        {destination}
      </span>
    );
  };

  return (
    <div className="shipments-page">
      <div className="shipments-card">
        <div className="shipments-header">
          <button className="back-btn" onClick={() => navigate('/')}>
            ←
          </button>
          <h2>{language === 'tr' ? 'Sevkiyat' : 'Shipments'}</h2>
          <button className="add-btn" onClick={() => setShowCreateModal(true)}>
            + {language === 'tr' ? 'Yeni' : 'New'}
          </button>
        </div>

        <div className="shipments-content">
          {success && <div className="success-message">{success}</div>}
          {error && <div className="error-message">{error}</div>}

          <div className="filter-bar">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
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
              {/* Shipments List */}
              <div className="shipments-list">
                <h3>{language === 'tr' ? 'Sevkiyatlar' : 'Shipments'} ({shipments.length})</h3>
                {shipments.length === 0 ? (
                  <div className="empty-state">{language === 'tr' ? 'Sevkiyat bulunamadı' : 'No shipments found'}</div>
                ) : (
                  <div className="shipment-cards">
                    {shipments.map((shipment) => (
                      <div
                        key={shipment.shipment_id}
                        className={`shipment-card ${selectedShipment?.shipment_id === shipment.shipment_id ? 'selected' : ''}`}
                        onClick={() => handleSelectShipment(shipment)}
                      >
                        <div className="shipment-card-header">
                          <span className="shipment-prefix">{shipment.prefix}</span>
                          {getStatusBadge(shipment.status)}
                        </div>
                        <div className="shipment-name">{shipment.name}</div>
                        <div className="shipment-stats">
                          <span>{shipment.total_boxes} {language === 'tr' ? 'koli' : 'boxes'}</span>
                          <span className="separator">|</span>
                          <span>{shipment.total_items} {language === 'tr' ? 'ürün' : 'items'}</span>
                        </div>
                        <div className="shipment-destinations">
                          {(shipment.usa_boxes || 0) > 0 && (
                            <span className="dest-count usa">USA: {shipment.usa_boxes}</span>
                          )}
                          {(shipment.fba_boxes || 0) > 0 && (
                            <span className="dest-count fba">FBA: {shipment.fba_boxes}</span>
                          )}
                        </div>
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
                    ))}
                  </div>
                )}
              </div>

              {/* Boxes Panel */}
              {selectedShipment && (
                <div className="boxes-panel">
                  <div className="boxes-header">
                    <h3>{selectedShipment.prefix} - {language === 'tr' ? 'Koliler' : 'Boxes'}</h3>
                    {selectedShipment.status === 'OPEN' && (
                      <div className="create-box-buttons">
                        <button className="btn-create-box usa" onClick={() => handleCreateBox('USA')}>
                          + USA {language === 'tr' ? 'Koli' : 'Box'}
                        </button>
                        <button className="btn-create-box fba" onClick={() => handleCreateBox('FBA')}>
                          + FBA {language === 'tr' ? 'Koli' : 'Box'}
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
                            <span>{box.total_items} {language === 'tr' ? 'ürün' : 'items'}</span>
                            <span>{box.total_quantity} {language === 'tr' ? 'adet' : 'pcs'}</span>
                          </div>
                          {box.status === 'OPEN' && selectedShipment.status === 'OPEN' && (
                            <div className="box-actions">
                              <select
                                value={box.destination}
                                onChange={(e) => handleUpdateBoxDestination(box, e.target.value as 'USA' | 'FBA')}
                                className="destination-select"
                              >
                                <option value="USA">USA</option>
                                <option value="FBA">FBA</option>
                              </select>
                            </div>
                          )}
                          {box.contents && box.contents.length > 0 && (
                            <div className="box-contents">
                              {box.contents.map((content: any) => (
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

      {/* Create Shipment Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{language === 'tr' ? 'Yeni Sevkiyat' : 'New Shipment'}</h3>
            <form onSubmit={handleCreateShipment}>
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
                <small>{language === 'tr' ? 'Örn: IST → Koliler: IST-00001, IST-00002...' : 'Ex: IST → Boxes: IST-00001, IST-00002...'}</small>
              </div>
              <div className="form-group">
                <label>{language === 'tr' ? 'Sevkiyat Adı' : 'Shipment Name'} *</label>
                <input
                  type="text"
                  value={newShipment.name}
                  onChange={(e) => setNewShipment({ ...newShipment, name: e.target.value })}
                  placeholder={language === 'tr' ? 'Aralık 2024 Sevkiyatı' : 'December 2024 Shipment'}
                  required
                />
              </div>
              <div className="form-group">
                <label>{language === 'tr' ? 'Kaynak Depo' : 'Source Warehouse'} *</label>
                <select
                  value={newShipment.source_warehouse_id}
                  onChange={(e) => setNewShipment({ ...newShipment, source_warehouse_id: Number(e.target.value) })}
                  required
                >
                  {warehouses.map((w) => (
                    <option key={w.warehouse_id} value={w.warehouse_id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>{language === 'tr' ? 'Varsayılan Hedef' : 'Default Destination'}</label>
                <select
                  value={newShipment.default_destination}
                  onChange={(e) => setNewShipment({ ...newShipment, default_destination: e.target.value as 'USA' | 'FBA' })}
                >
                  <option value="USA">USA Warehouse</option>
                  <option value="FBA">FBA Warehouse</option>
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
          </div>
        </div>
      )}
    </div>
  );
}

export default Shipments;
