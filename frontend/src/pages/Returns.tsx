import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { rmaApi } from '../lib/api/rma';
import { apiClient } from '../lib/api';
import { useStore } from '../stores/appStore';
import { useSSOStore } from '../stores/ssoStore';
import type { RMARequest, RMAItem, RMAHistory, Warehouse } from '../types';
import './Returns.css';

const STATUS_LABELS: Record<string, Record<string, string>> = {
  tr: { PENDING: 'Bekliyor', APPROVED: 'Onaylandı', IN_PROCESS: 'İşlemde', COMPLETED: 'Tamamlandı' },
  en: { PENDING: 'Pending', APPROVED: 'Approved', IN_PROCESS: 'In Process', COMPLETED: 'Completed' },
};

const ACTION_LABELS: Record<string, Record<string, string>> = {
  tr: { REFUND: 'İade', REPLACE: 'Değişim', REPAIR: 'Tamir', DISCARD: 'İmha' },
  en: { REFUND: 'Refund', REPLACE: 'Replace', REPAIR: 'Repair', DISCARD: 'Discard' },
};

const CONDITION_LABELS: Record<string, Record<string, string>> = {
  tr: { NEW: 'Yeni', GOOD: 'İyi', DAMAGED: 'Hasarlı', DEFECTIVE: 'Kusurlu' },
  en: { NEW: 'New', GOOD: 'Good', DAMAGED: 'Damaged', DEFECTIVE: 'Defective' },
};

interface RMADetail {
  rma: RMARequest;
  items: RMAItem[];
  history: RMAHistory[];
}

interface NewRMAItem {
  product_sku: string;
  quantity_requested: number;
  action: string;
}

function Returns() {
  const navigate = useNavigate();
  const { language } = useStore();
  const { wmsUser: user } = useSSOStore();
  const t = language === 'tr' ? 'tr' : 'en';

  const [rmas, setRmas] = useState<RMARequest[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [selectedDetail, setSelectedDetail] = useState<RMADetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Receive form state
  const [receiveItemId, setReceiveItemId] = useState<number | null>(null);
  const [receiveQty, setReceiveQty] = useState(1);
  const [receiveCondition, setReceiveCondition] = useState('GOOD');

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRma, setNewRma] = useState({
    warehouse_id: 0,
    customer_name: '',
    order_number: '',
    reason: '',
    priority: 'NORMAL',
    notes: '',
  });
  const [newItems, setNewItems] = useState<NewRMAItem[]>([]);
  const [itemSku, setItemSku] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [itemAction, setItemAction] = useState('REFUND');

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rmaRes, whRes] = await Promise.all([
        rmaApi.getAll(statusFilter ? { status: statusFilter } : undefined),
        apiClient.getAllWarehouses(),
      ]);
      if (rmaRes.success) setRmas(rmaRes.data || []);
      if (whRes.success) {
        const list: Warehouse[] = whRes.data || [];
        setWarehouses(list);
        if (newRma.warehouse_id === 0 && list.length > 0) {
          setNewRma(prev => ({ ...prev, warehouse_id: list[0].warehouse_id }));
        }
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRma = async (rma: RMARequest) => {
    setDetailLoading(true);
    setReceiveItemId(null);
    try {
      const res = await rmaApi.getById(rma.rma_id);
      if (res.success) {
        setSelectedDetail(res.data);
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to load RMA detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const showMsg = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleApprove = async () => {
    if (!selectedDetail) return;
    const notes = prompt(t === 'tr' ? 'Onay notu (opsiyonel):' : 'Approval note (optional):');
    if (notes === null) return;

    try {
      const res = await rmaApi.approve(selectedDetail.rma.rma_id, notes || undefined);
      if (res.success) {
        showMsg(t === 'tr' ? 'RMA onaylandı' : 'RMA approved');
        handleSelectRma(selectedDetail.rma);
        loadData();
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to approve RMA');
    }
  };

  const handleReceive = async (item: RMAItem) => {
    try {
      const res = await rmaApi.receiveItem(item.item_id, {
        quantity_received: receiveQty,
        condition: receiveCondition,
      });
      if (res.success) {
        showMsg(t === 'tr' ? 'İade kabul edildi' : 'Return received');
        setReceiveItemId(null);
        setReceiveQty(1);
        setReceiveCondition('GOOD');
        if (selectedDetail) handleSelectRma(selectedDetail.rma);
        loadData();
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to receive return');
    }
  };

  const handleComplete = async () => {
    if (!selectedDetail) return;
    if (!confirm(t === 'tr' ? 'RMA\'yı tamamlamak istediğinize emin misiniz?' : 'Complete this RMA?')) return;

    try {
      const res = await rmaApi.complete(selectedDetail.rma.rma_id);
      if (res.success) {
        showMsg(t === 'tr' ? 'RMA tamamlandı' : 'RMA completed');
        handleSelectRma(selectedDetail.rma);
        loadData();
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to complete RMA');
    }
  };

  // Create
  const handleAddItem = () => {
    if (!itemSku.trim() || itemQty < 1) return;
    setNewItems(prev => [...prev, { product_sku: itemSku.trim(), quantity_requested: itemQty, action: itemAction }]);
    setItemSku('');
    setItemQty(1);
  };

  const handleCreateRma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRma.reason || newItems.length === 0) {
      setError(t === 'tr' ? 'İade nedeni ve en az 1 ürün gerekli' : 'Reason and at least 1 item required');
      return;
    }

    try {
      const res = await rmaApi.create({
        warehouse_id: newRma.warehouse_id,
        customer_name: newRma.customer_name || undefined,
        order_number: newRma.order_number || undefined,
        reason: newRma.reason,
        priority: newRma.priority,
        notes: newRma.notes || undefined,
        items: newItems,
      });

      if (res.success) {
        showMsg(t === 'tr' ? 'RMA oluşturuldu' : 'RMA created');
        setShowCreateModal(false);
        setNewRma({ warehouse_id: warehouses[0]?.warehouse_id || 0, customer_name: '', order_number: '', reason: '', priority: 'NORMAL', notes: '' });
        setNewItems([]);
        loadData();
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to create RMA');
    }
  };

  const getStatusBadge = (status: string) => (
    <span className={`rma-status s-${status.toLowerCase()}`}>
      {STATUS_LABELS[t][status] || status}
    </span>
  );

  const getActionBadge = (action: string) => (
    <span className={`action-badge a-${action.toLowerCase()}`}>
      {ACTION_LABELS[t][action] || action}
    </span>
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString(t === 'tr' ? 'tr-TR' : 'en-US', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  };

  const rma = selectedDetail?.rma;

  return (
    <div className="returns-page">
      <div className="returns-card">
        <div className="returns-header">
          <button className="back-btn" onClick={() => navigate('/')}>←</button>
          <h2>{t === 'tr' ? 'İade Yönetimi (RMA)' : 'Returns (RMA)'}</h2>
          <button className="add-btn" onClick={() => setShowCreateModal(true)}>
            + {t === 'tr' ? 'Yeni' : 'New'}
          </button>
        </div>

        <div className="returns-content">
          {success && <div className="success-message">{success}</div>}
          {error && <div className="error-message" onClick={() => setError(null)}>{error}</div>}

          <div className="returns-filters">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">{t === 'tr' ? 'Tüm Durumlar' : 'All Statuses'}</option>
              {Object.keys(STATUS_LABELS[t]).map(s => (
                <option key={s} value={s}>{STATUS_LABELS[t][s]}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="loading">{t === 'tr' ? 'Yükleniyor...' : 'Loading...'}</div>
          ) : (
            <div className="returns-layout">
              {/* RMA List */}
              <div className="rma-list">
                <h3>RMA ({rmas.length})</h3>
                {rmas.length === 0 ? (
                  <div className="empty-state">
                    {t === 'tr' ? 'İade kaydı bulunamadı' : 'No RMA records found'}
                  </div>
                ) : (
                  <div className="rma-cards">
                    {rmas.map(r => (
                      <div
                        key={r.rma_id}
                        className={`rma-card ${rma?.rma_id === r.rma_id ? 'selected' : ''}`}
                        onClick={() => handleSelectRma(r)}
                      >
                        <div className="rma-card-top">
                          <span className="rma-number">{r.rma_number}</span>
                          {getStatusBadge(r.status)}
                        </div>
                        <div className="rma-card-meta">
                          {r.customer_name || r.order_number || r.reason}
                        </div>
                        <div className="rma-card-bottom">
                          <span>{formatDate(r.created_at)}</span>
                          <span>{r.total_items || 0} {t === 'tr' ? 'kalem' : 'items'} — {r.total_quantity || 0} {t === 'tr' ? 'adet' : 'qty'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Detail Panel */}
              {selectedDetail && rma && (
                <div className="rma-detail-panel">
                  {detailLoading ? (
                    <div className="loading">{t === 'tr' ? 'Yükleniyor...' : 'Loading...'}</div>
                  ) : (
                    <>
                      <div className="rma-detail-header">
                        <h3>{rma.rma_number}</h3>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                          {getStatusBadge(rma.status)}
                        </div>
                      </div>

                      <div className="rma-detail-info">
                        <div className="detail-field">
                          <span className="label">{t === 'tr' ? 'Müşteri' : 'Customer'}</span>
                          <span className="value">{rma.customer_name || '-'}</span>
                        </div>
                        <div className="detail-field">
                          <span className="label">{t === 'tr' ? 'Sipariş No' : 'Order #'}</span>
                          <span className="value">{rma.order_number || '-'}</span>
                        </div>
                        <div className="detail-field">
                          <span className="label">{t === 'tr' ? 'Depo' : 'Warehouse'}</span>
                          <span className="value">{rma.warehouse_name || rma.warehouse_code}</span>
                        </div>
                        <div className="detail-field">
                          <span className="label">{t === 'tr' ? 'Tarih' : 'Date'}</span>
                          <span className="value">{formatDate(rma.created_at)}</span>
                        </div>
                        <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
                          <span className="label">{t === 'tr' ? 'Neden' : 'Reason'}</span>
                          <span className="value">{rma.reason}</span>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="rma-items-section">
                        <h4>{t === 'tr' ? 'Ürünler' : 'Items'} ({selectedDetail.items.length})</h4>
                        <div className="rma-items-list">
                          {selectedDetail.items.map(item => (
                            <div key={item.item_id}>
                              <div
                                className="rma-item-row"
                                onClick={() => {
                                  if (rma.status === 'APPROVED' || rma.status === 'IN_PROCESS') {
                                    setReceiveItemId(receiveItemId === item.item_id ? null : item.item_id);
                                    setReceiveQty(Math.max(1, item.quantity_requested - item.quantity_received));
                                  }
                                }}
                                style={{ cursor: ['APPROVED', 'IN_PROCESS'].includes(rma.status) ? 'pointer' : 'default' }}
                              >
                                <div className="item-info">
                                  <div className="item-sku">{item.product_sku}</div>
                                  <div className="item-name">{item.product_name}</div>
                                </div>
                                {getActionBadge(item.action)}
                                <div className="item-qty">
                                  <span className="received">{item.quantity_received}</span>
                                  <span className="requested">/{item.quantity_requested}</span>
                                </div>
                              </div>

                              {/* Receive Inline Form */}
                              {receiveItemId === item.item_id && (
                                <div className="receive-form">
                                  <div className="mini-field">
                                    <label>{t === 'tr' ? 'Adet' : 'Qty'}</label>
                                    <input
                                      type="number"
                                      value={receiveQty}
                                      onChange={e => setReceiveQty(Math.max(1, Number(e.target.value)))}
                                      min={1}
                                      max={item.quantity_requested - item.quantity_received}
                                      style={{ width: '60px' }}
                                    />
                                  </div>
                                  <div className="mini-field">
                                    <label>{t === 'tr' ? 'Durum' : 'Condition'}</label>
                                    <select value={receiveCondition} onChange={e => setReceiveCondition(e.target.value)}>
                                      {Object.keys(CONDITION_LABELS[t]).map(c => (
                                        <option key={c} value={c}>{CONDITION_LABELS[t][c]}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <button className="btn-receive" onClick={() => handleReceive(item)}>
                                    {t === 'tr' ? 'Kabul Et' : 'Receive'}
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* History */}
                      {selectedDetail.history.length > 0 && (
                        <div className="rma-history-section">
                          <h4>{t === 'tr' ? 'Geçmiş' : 'History'}</h4>
                          {selectedDetail.history.map(h => (
                            <div key={h.history_id} className="history-item">
                              <span className="history-action">{h.action}</span>
                              <span className="history-meta">
                                {h.performed_by} — {formatDate(h.created_at)}
                                {h.notes && ` — ${h.notes}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      {rma.status !== 'COMPLETED' && (
                        <div className="rma-actions">
                          {rma.status === 'PENDING' && (
                            <button className="btn-approve" onClick={handleApprove}>
                              {t === 'tr' ? 'Onayla' : 'Approve'}
                            </button>
                          )}
                          {(rma.status === 'APPROVED' || rma.status === 'IN_PROCESS') && (
                            <button className="btn-complete-rma" onClick={handleComplete}>
                              {t === 'tr' ? 'Tamamla' : 'Complete'}
                            </button>
                          )}
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

      {/* Create RMA Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{t === 'tr' ? 'Yeni İade (RMA)' : 'New Return (RMA)'}</h3>
            <form onSubmit={handleCreateRma}>
              <div className="form-group">
                <label>{t === 'tr' ? 'Depo' : 'Warehouse'} *</label>
                <select
                  value={newRma.warehouse_id}
                  onChange={e => setNewRma(p => ({ ...p, warehouse_id: Number(e.target.value) }))}
                  required
                >
                  {warehouses.filter(w => w.is_active).map(w => (
                    <option key={w.warehouse_id} value={w.warehouse_id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>{t === 'tr' ? 'Müşteri Adı' : 'Customer Name'}</label>
                <input
                  type="text"
                  value={newRma.customer_name}
                  onChange={e => setNewRma(p => ({ ...p, customer_name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>{t === 'tr' ? 'Sipariş No' : 'Order Number'}</label>
                <input
                  type="text"
                  value={newRma.order_number}
                  onChange={e => setNewRma(p => ({ ...p, order_number: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>{t === 'tr' ? 'İade Nedeni' : 'Reason'} *</label>
                <textarea
                  value={newRma.reason}
                  onChange={e => setNewRma(p => ({ ...p, reason: e.target.value }))}
                  rows={2}
                  required
                />
              </div>

              {/* Item Adder */}
              <div className="form-group">
                <label>{t === 'tr' ? 'Ürünler' : 'Items'} *</label>
                <div className="item-adder">
                  <div className="form-group">
                    <input
                      type="text"
                      value={itemSku}
                      onChange={e => setItemSku(e.target.value)}
                      placeholder="IWASKU"
                    />
                  </div>
                  <div className="form-group">
                    <input
                      type="number"
                      value={itemQty}
                      onChange={e => setItemQty(Math.max(1, Number(e.target.value)))}
                      min={1}
                    />
                  </div>
                  <div className="form-group">
                    <select value={itemAction} onChange={e => setItemAction(e.target.value)}>
                      {Object.keys(ACTION_LABELS[t]).map(a => (
                        <option key={a} value={a}>{ACTION_LABELS[t][a]}</option>
                      ))}
                    </select>
                  </div>
                  <button type="button" className="btn-add-item" onClick={handleAddItem}>+</button>
                </div>
                {newItems.length > 0 && (
                  <div className="modal-items-list">
                    {newItems.map((item, i) => (
                      <div key={i} className="modal-item">
                        <span>{item.product_sku} x{item.quantity_requested} ({ACTION_LABELS[t][item.action]})</span>
                        <button type="button" className="remove-item" onClick={() => setNewItems(prev => prev.filter((_, idx) => idx !== i))}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowCreateModal(false)}>
                  {t === 'tr' ? 'Vazgeç' : 'Cancel'}
                </button>
                <button type="submit" className="btn-save" disabled={newItems.length === 0}>
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

export default Returns;
