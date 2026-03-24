import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { containerApi, shipmentApi, apiClient } from '../lib/api';
import { useStore } from '../stores/appStore';
import { useSSOStore } from '../stores/ssoStore';
import type { VirtualShipment, Warehouse } from '../types';
import './Containers.css';

interface Container {
  container_id: number;
  barcode: string;
  display_name?: string;
  container_type: 'BOX' | 'PALLET';
  warehouse_id: number;
  warehouse_code?: string;
  warehouse_name?: string;
  status: string;
  calculated_status?: string;
  shipment_id?: number;
  shipment_name?: string;
  location_code?: string;
  current_items: number;
  original_items: number;
  notes?: string;
  created_by: string;
  created_at: string;
}

interface ContainerContent {
  content_id: number;
  product_sku: string;
  product_name?: string;
  quantity: number;
}

interface ContainerDetail {
  container: Container;
  contents: ContainerContent[];
}

function Containers() {
  const navigate = useNavigate();
  const { currentWarehouse, language } = useStore();
  const { wmsUser: user } = useSSOStore();
  const t = language === 'tr' ? 'tr' : 'en';

  const [containers, setContainers] = useState<Container[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [shipments, setShipments] = useState<VirtualShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Detail
  const [selectedDetail, setSelectedDetail] = useState<ContainerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [linkShipmentId, setLinkShipmentId] = useState<number>(0);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newContainer, setNewContainer] = useState({
    container_type: 'BOX' as 'BOX' | 'PALLET',
    display_name: '',
    shipment_id: 0,
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [statusFilter, typeFilter, currentWarehouse]);

  const loadData = async () => {
    setLoading(true);
    try {
      const filters: Record<string, string | number> = {};
      if (currentWarehouse) filters.warehouse_code = currentWarehouse;
      if (statusFilter) filters.status = statusFilter;
      if (typeFilter) filters.type = typeFilter;
      if (searchQuery) filters.search = searchQuery;

      const [ctrRes, whRes, shipRes] = await Promise.all([
        containerApi.getAll(filters),
        apiClient.getAllWarehouses(),
        shipmentApi.getAll({ status: 'OPEN' }),
      ]);

      if (ctrRes.success) setContainers(ctrRes.data || []);
      if (whRes.success) setWarehouses(whRes.data || []);
      if (shipRes.success) setShipments(shipRes.data || []);
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleSelectContainer = async (ctr: Container) => {
    setDetailLoading(true);
    try {
      const res = await containerApi.getByBarcode(ctr.barcode);
      if (res.success) {
        setSelectedDetail(res.data);
        setLinkShipmentId(res.data.container?.shipment_id || 0);
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to load container');
    } finally {
      setDetailLoading(false);
    }
  };

  const showMsg = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContainer.display_name.trim()) {
      setError(t === 'tr' ? 'Koli/palet adı zorunludur' : 'Container name is required');
      return;
    }

    try {
      const res = await containerApi.create({
        container_type: newContainer.container_type,
        warehouse_code: currentWarehouse,
        display_name: newContainer.display_name.trim(),
        shipment_id: newContainer.shipment_id || undefined,
        notes: newContainer.notes || undefined,
        created_by: user?.username || 'system',
      });

      if (res.success) {
        showMsg(t === 'tr' ? `Oluşturuldu: ${res.data.barcode}` : `Created: ${res.data.barcode}`);
        setShowCreateModal(false);
        setNewContainer({ container_type: 'BOX', display_name: '', shipment_id: 0, notes: '' });
        loadData();
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to create container');
    }
  };

  const handleOpenContainer = async () => {
    if (!selectedDetail) return;
    const barcode = selectedDetail.container.barcode;
    if (!confirm(
      t === 'tr'
        ? `${barcode} açılsın mı? İçindeki ürünler tekil olarak stoka kaydedilir.`
        : `Open ${barcode}? Items will be individually registered to stock.`
    )) return;

    try {
      const res = await containerApi.open(barcode, {
        created_by: user?.username || 'system',
      });
      if (res.success) {
        showMsg(t === 'tr' ? `${barcode} açıldı` : `${barcode} opened`);
        setSelectedDetail(null);
        loadData();
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to open container');
    }
  };

  const handleLinkShipment = async () => {
    if (!selectedDetail) return;
    try {
      const res = await containerApi.linkShipment(
        selectedDetail.container.container_id,
        linkShipmentId || null,
      );
      if (res.success) {
        showMsg(t === 'tr' ? 'Sevkiyat bağlantısı güncellendi' : 'Shipment link updated');
        handleSelectContainer(selectedDetail.container);
        loadData();
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to link shipment');
    }
  };

  const getStatusLabel = (ctr: Container) => {
    const s = ctr.calculated_status || ctr.status;
    const labels: Record<string, Record<string, string>> = {
      tr: { ACTIVE: 'Aktif', OPENED: 'Açıldı', SEALED: 'Dolu', EMPTY: 'Boş', PARTIAL: 'Kısmi' },
      en: { ACTIVE: 'Active', OPENED: 'Opened', SEALED: 'Sealed', EMPTY: 'Empty', PARTIAL: 'Partial' },
    };
    return (
      <span className={`ctr-status s-${s.toLowerCase()}`}>
        {labels[t][s] || s}
      </span>
    );
  };

  const getTypeBadge = (type: string) => (
    <span className={`type-badge t-${type.toLowerCase()}`}>
      {type === 'BOX' ? (t === 'tr' ? 'Koli' : 'Box') : (t === 'tr' ? 'Palet' : 'Pallet')}
    </span>
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString(t === 'tr' ? 'tr-TR' : 'en-US', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  };

  const ctr = selectedDetail?.container;

  return (
    <div className="containers-page">
      <div className="containers-card">
        <div className="containers-header">
          <button className="back-btn" onClick={() => navigate('/')}>←</button>
          <h2>{t === 'tr' ? 'Koli / Palet Yönetimi' : 'Container Management'}</h2>
          <button className="add-btn" onClick={() => setShowCreateModal(true)}>
            + {t === 'tr' ? 'Yeni' : 'New'}
          </button>
        </div>

        <div className="containers-content">
          {success && <div className="success-message">{success}</div>}
          {error && <div className="error-message" onClick={() => setError(null)}>{error}</div>}

          <form className="containers-filters" onSubmit={handleSearch}>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">{t === 'tr' ? 'Tüm Tipler' : 'All Types'}</option>
              <option value="BOX">{t === 'tr' ? 'Koli' : 'Box'}</option>
              <option value="PALLET">{t === 'tr' ? 'Palet' : 'Pallet'}</option>
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">{t === 'tr' ? 'Tüm Durumlar' : 'All Statuses'}</option>
              <option value="ACTIVE">{t === 'tr' ? 'Aktif' : 'Active'}</option>
              <option value="OPENED">{t === 'tr' ? 'Açıldı' : 'Opened'}</option>
            </select>
            <input
              type="text"
              placeholder={t === 'tr' ? 'Barkod veya isim ara...' : 'Search barcode or name...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </form>

          {loading ? (
            <div className="loading">{t === 'tr' ? 'Yükleniyor...' : 'Loading...'}</div>
          ) : (
            <div className="containers-layout">
              {/* List */}
              <div className="container-list">
                <h3>{t === 'tr' ? 'Konteynerler' : 'Containers'} ({containers.length})</h3>
                {containers.length === 0 ? (
                  <div className="empty-state">
                    {t === 'tr' ? 'Koli/palet bulunamadı' : 'No containers found'}
                  </div>
                ) : (
                  <div className="container-cards">
                    {containers.map(c => (
                      <div
                        key={c.container_id}
                        className={`ctr-card ${ctr?.container_id === c.container_id ? 'selected' : ''}`}
                        onClick={() => handleSelectContainer(c)}
                      >
                        <div className="ctr-card-top">
                          <span className="ctr-barcode">{c.barcode}</span>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            {getTypeBadge(c.container_type)}
                            {getStatusLabel(c)}
                          </div>
                        </div>
                        {c.display_name && (
                          <div className="ctr-display-name">{c.display_name}</div>
                        )}
                        <div className="ctr-card-meta">
                          <span>{c.current_items} {t === 'tr' ? 'ürün' : 'items'}</span>
                          <span>
                            {c.shipment_name && <span className="shipment-tag">{c.shipment_name}</span>}
                            {!c.shipment_name && formatDate(c.created_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Detail */}
              {selectedDetail && ctr && (
                <div className="ctr-detail-panel">
                  {detailLoading ? (
                    <div className="loading">{t === 'tr' ? 'Yükleniyor...' : 'Loading...'}</div>
                  ) : (
                    <>
                      <div className="ctr-detail-header">
                        <h3>{ctr.barcode}</h3>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                          {getTypeBadge(ctr.container_type)}
                          {getStatusLabel(ctr)}
                        </div>
                      </div>

                      <div className="ctr-detail-info">
                        {ctr.display_name && (
                          <div className="detail-field">
                            <span className="label">{t === 'tr' ? 'İsim' : 'Name'}</span>
                            <span className="value">{ctr.display_name}</span>
                          </div>
                        )}
                        <div className="detail-field">
                          <span className="label">{t === 'tr' ? 'Depo' : 'Warehouse'}</span>
                          <span className="value">{ctr.warehouse_name || ctr.warehouse_code}</span>
                        </div>
                        <div className="detail-field">
                          <span className="label">{t === 'tr' ? 'Lokasyon' : 'Location'}</span>
                          <span className="value">{ctr.location_code || '-'}</span>
                        </div>
                        <div className="detail-field">
                          <span className="label">{t === 'tr' ? 'Oluşturan' : 'Created By'}</span>
                          <span className="value">{ctr.created_by}</span>
                        </div>
                        <div className="detail-field">
                          <span className="label">{t === 'tr' ? 'Tarih' : 'Date'}</span>
                          <span className="value">{formatDate(ctr.created_at)}</span>
                        </div>
                        {ctr.notes && (
                          <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
                            <span className="label">{t === 'tr' ? 'Notlar' : 'Notes'}</span>
                            <span className="value">{ctr.notes}</span>
                          </div>
                        )}
                      </div>

                      {/* Contents */}
                      <div className="ctr-contents-section">
                        <h4>{t === 'tr' ? 'İçerik' : 'Contents'} ({selectedDetail.contents.length})</h4>
                        {selectedDetail.contents.length === 0 ? (
                          <div className="empty-state" style={{ padding: '1rem' }}>
                            {t === 'tr' ? 'Boş' : 'Empty'}
                          </div>
                        ) : (
                          <div className="ctr-contents-list">
                            {selectedDetail.contents.map(item => (
                              <div key={item.content_id} className="ctr-content-row">
                                <div className="item-info">
                                  <div className="item-sku">{item.product_sku}</div>
                                  <div className="item-name">{item.product_name}</div>
                                </div>
                                <div className="item-qty">x{item.quantity}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Shipment Link */}
                      {ctr.status === 'ACTIVE' && (
                        <div className="shipment-link-row">
                          <select
                            value={linkShipmentId}
                            onChange={e => setLinkShipmentId(Number(e.target.value))}
                          >
                            <option value={0}>{t === 'tr' ? 'Sevkiyat yok' : 'No shipment'}</option>
                            {shipments.map(s => (
                              <option key={s.shipment_id} value={s.shipment_id}>
                                {s.prefix} ({s.warehouse_code})
                              </option>
                            ))}
                          </select>
                          <button className="btn-link" onClick={handleLinkShipment}>
                            {t === 'tr' ? 'Bağla' : 'Link'}
                          </button>
                          {ctr.shipment_id && (
                            <button className="btn-unlink" onClick={() => { setLinkShipmentId(0); handleLinkShipment(); }}>
                              {t === 'tr' ? 'Kaldır' : 'Unlink'}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      {ctr.status === 'ACTIVE' && (
                        <div className="ctr-actions">
                          <button className="btn-open-ctr" onClick={handleOpenContainer}>
                            {t === 'tr' ? 'Aç (İçeriği Stoka Al)' : 'Open (Unpack to Stock)'}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{t === 'tr' ? 'Yeni Koli / Palet' : 'New Container'}</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>{t === 'tr' ? 'Tip' : 'Type'} *</label>
                <select
                  value={newContainer.container_type}
                  onChange={e => setNewContainer(p => ({ ...p, container_type: e.target.value as 'BOX' | 'PALLET' }))}
                >
                  <option value="BOX">{t === 'tr' ? 'Koli (BOX)' : 'Box'}</option>
                  <option value="PALLET">{t === 'tr' ? 'Palet (PALLET)' : 'Pallet'}</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t === 'tr' ? 'İsim' : 'Name'} *</label>
                <input
                  type="text"
                  value={newContainer.display_name}
                  onChange={e => setNewContainer(p => ({ ...p, display_name: e.target.value }))}
                  placeholder={t === 'tr' ? 'FBA-BOX-01, NJ-PLT-045...' : 'FBA-BOX-01, NJ-PLT-045...'}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t === 'tr' ? 'Sevkiyat (opsiyonel)' : 'Shipment (optional)'}</label>
                <select
                  value={newContainer.shipment_id}
                  onChange={e => setNewContainer(p => ({ ...p, shipment_id: Number(e.target.value) }))}
                >
                  <option value={0}>{t === 'tr' ? 'Sevkiyat yok' : 'No shipment'}</option>
                  {shipments.map(s => (
                    <option key={s.shipment_id} value={s.shipment_id}>
                      {s.prefix} ({s.warehouse_code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>{t === 'tr' ? 'Notlar' : 'Notes'}</label>
                <textarea
                  value={newContainer.notes}
                  onChange={e => setNewContainer(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowCreateModal(false)}>
                  {t === 'tr' ? 'Vazgeç' : 'Cancel'}
                </button>
                <button type="submit" className="btn-save">
                  {t === 'tr' ? 'Oluştur' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Containers;
