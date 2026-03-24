import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { orderApi } from '../lib/api/orders';
import { apiClient } from '../lib/api';
import { userApi } from '../lib/api';
import { useStore } from '../stores/appStore';
import { useSSOStore } from '../stores/ssoStore';
import type { ShipmentOrder, ShipmentOrderItem } from '../types';
import './Orders.css';

const STATUS_LABELS: Record<string, Record<string, string>> = {
  tr: {
    PENDING: 'Bekliyor', READY_TO_PICK: 'Toplamaya Hazır', PICKING: 'Toplanıyor',
    PICKED: 'Toplandı', SHIPPED: 'Gönderildi', CANCELLED: 'İptal',
  },
  en: {
    PENDING: 'Pending', READY_TO_PICK: 'Ready to Pick', PICKING: 'Picking',
    PICKED: 'Picked', SHIPPED: 'Shipped', CANCELLED: 'Cancelled',
  },
};

const PRIORITY_LABELS: Record<string, Record<string, string>> = {
  tr: { URGENT: 'Acil', HIGH: 'Yüksek', NORMAL: 'Normal', LOW: 'Düşük' },
  en: { URGENT: 'Urgent', HIGH: 'High', NORMAL: 'Normal', LOW: 'Low' },
};

interface WmsUser {
  user_id: number;
  username: string;
  full_name?: string;
  role: string;
  is_active: boolean;
}

interface NewOrderItem {
  product_sku: string;
  quantity: number;
}

function Orders() {
  const navigate = useNavigate();
  const { currentWarehouse, language } = useStore();
  const { wmsUser: user } = useSSOStore();
  const t = language === 'tr' ? 'tr' : 'en';

  // List state
  const [orders, setOrders] = useState<ShipmentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Detail
  const [selectedOrder, setSelectedOrder] = useState<ShipmentOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Picker assignment
  const [users, setUsers] = useState<WmsUser[]>([]);
  const [selectedPickerId, setSelectedPickerId] = useState<number>(0);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrder, setNewOrder] = useState({
    order_number: '',
    customer_name: '',
    customer_address: '',
    priority: 'NORMAL',
    notes: '',
  });
  const [newItems, setNewItems] = useState<NewOrderItem[]>([]);
  const [itemSku, setItemSku] = useState('');
  const [itemQty, setItemQty] = useState(1);

  useEffect(() => {
    loadOrders();
  }, [statusFilter, priorityFilter, currentWarehouse]);

  useEffect(() => {
    // Load users for picker assignment
    userApi.getAll().then(res => {
      if (res.success && Array.isArray(res.data)) {
        setUsers(res.data.filter((u: WmsUser) => u.is_active));
      }
    }).catch(() => {});
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const filters: Record<string, string | number> = { limit: 100 };
      if (statusFilter) filters.status = statusFilter;
      if (priorityFilter) filters.priority = priorityFilter;
      if (currentWarehouse) filters.warehouse_code = currentWarehouse;
      if (searchQuery) filters.search = searchQuery;

      const res = await orderApi.getAll(filters);
      if (res.success) {
        setOrders(res.data || []);
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadOrders();
  };

  const handleSelectOrder = async (order: ShipmentOrder) => {
    setDetailLoading(true);
    try {
      const res = await orderApi.getById(order.order_id);
      if (res.success) {
        setSelectedOrder(res.data);
        if (res.data.assigned_picker_id) {
          setSelectedPickerId(res.data.assigned_picker_id);
        } else {
          setSelectedPickerId(0);
        }
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to load order detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const showMsg = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleAssignPicker = async () => {
    if (!selectedOrder || !selectedPickerId) return;
    try {
      const res = await orderApi.assignPicker(selectedOrder.order_id, selectedPickerId);
      if (res.success) {
        showMsg(t === 'tr' ? 'Toplayıcı atandı' : 'Picker assigned');
        handleSelectOrder(selectedOrder);
        loadOrders();
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to assign picker');
    }
  };

  const handleStartPicking = async () => {
    if (!selectedOrder) return;
    try {
      const res = await orderApi.startPicking(selectedOrder.order_id);
      if (res.success) {
        showMsg(t === 'tr' ? 'Toplama başlatıldı' : 'Picking started');
        handleSelectOrder(selectedOrder);
        loadOrders();
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to start picking');
    }
  };

  const handleRecordPick = async (item: ShipmentOrderItem) => {
    if (!selectedOrder) return;
    const remaining = item.quantity_ordered - item.quantity_picked;
    if (remaining <= 0) return;

    try {
      const res = await orderApi.recordPick(selectedOrder.order_id, {
        item_id: item.item_id,
        product_sku: item.product_sku,
        location_id: item.location_id,
        quantity_picked: 1,
      });
      if (res.success) {
        handleSelectOrder(selectedOrder);
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to record pick');
    }
  };

  const handleCompletePicking = async () => {
    if (!selectedOrder) return;
    try {
      const res = await orderApi.completePicking(selectedOrder.order_id);
      if (res.success) {
        showMsg(t === 'tr' ? 'Toplama tamamlandı' : 'Picking completed');
        handleSelectOrder(selectedOrder);
        loadOrders();
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to complete picking');
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    const reason = prompt(t === 'tr' ? 'İptal nedeni:' : 'Cancel reason:');
    if (reason === null) return;

    try {
      const res = await orderApi.cancel(selectedOrder.order_id, reason);
      if (res.success) {
        showMsg(t === 'tr' ? 'Sipariş iptal edildi' : 'Order cancelled');
        setSelectedOrder(null);
        loadOrders();
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to cancel order');
    }
  };

  // Create Order
  const handleAddItem = () => {
    if (!itemSku.trim() || itemQty < 1) return;
    setNewItems(prev => [...prev, { product_sku: itemSku.trim(), quantity: itemQty }]);
    setItemSku('');
    setItemQty(1);
  };

  const handleRemoveItem = (index: number) => {
    setNewItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.order_number || !newOrder.customer_name || newItems.length === 0) {
      setError(t === 'tr' ? 'Sipariş no, müşteri adı ve en az 1 ürün gerekli' : 'Order number, customer name and at least 1 item required');
      return;
    }

    try {
      const res = await orderApi.create({
        order_number: newOrder.order_number,
        warehouse_code: currentWarehouse,
        customer_name: newOrder.customer_name,
        customer_address: newOrder.customer_address || undefined,
        priority: newOrder.priority,
        items: newItems,
        notes: newOrder.notes || undefined,
      });

      if (res.success) {
        showMsg(t === 'tr' ? 'Sipariş oluşturuldu' : 'Order created');
        setShowCreateModal(false);
        setNewOrder({ order_number: '', customer_name: '', customer_address: '', priority: 'NORMAL', notes: '' });
        setNewItems([]);
        loadOrders();
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to create order');
    }
  };

  const getStatusBadge = (status: string) => (
    <span className={`order-status s-${status.toLowerCase()}`}>
      {STATUS_LABELS[t][status] || status}
    </span>
  );

  const getPriorityBadge = (priority: string) => (
    <span className={`order-priority p-${priority.toLowerCase()}`}>
      {PRIORITY_LABELS[t][priority] || priority}
    </span>
  );

  const getItemStatusDot = (item: ShipmentOrderItem) => {
    if (item.quantity_picked >= item.quantity_ordered) return 'is-picked';
    if (item.quantity_picked > 0) return 'is-picking';
    return 'is-pending';
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString(t === 'tr' ? 'tr-TR' : 'en-US', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  };

  const isTerminal = (status: string) => ['SHIPPED', 'CANCELLED'].includes(status);

  return (
    <div className="orders-page">
      <div className="orders-card">
        <div className="orders-header">
          <button className="back-btn" onClick={() => navigate('/')}>←</button>
          <h2>{t === 'tr' ? 'Siparişler' : 'Orders'}</h2>
          <button className="add-btn" onClick={() => setShowCreateModal(true)}>
            + {t === 'tr' ? 'Yeni' : 'New'}
          </button>
        </div>

        <div className="orders-content">
          {success && <div className="success-message">{success}</div>}
          {error && <div className="error-message" onClick={() => setError(null)}>{error}</div>}

          <form className="orders-filters" onSubmit={handleSearch}>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">{t === 'tr' ? 'Tüm Durumlar' : 'All Statuses'}</option>
              {Object.keys(STATUS_LABELS[t]).map(s => (
                <option key={s} value={s}>{STATUS_LABELS[t][s]}</option>
              ))}
            </select>
            <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
              <option value="">{t === 'tr' ? 'Tüm Öncelikler' : 'All Priorities'}</option>
              {Object.keys(PRIORITY_LABELS[t]).map(p => (
                <option key={p} value={p}>{PRIORITY_LABELS[t][p]}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder={t === 'tr' ? 'Sipariş no veya müşteri...' : 'Order # or customer...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </form>

          {loading ? (
            <div className="loading">{t === 'tr' ? 'Yükleniyor...' : 'Loading...'}</div>
          ) : (
            <div className="orders-layout">
              {/* Order List */}
              <div className="orders-list">
                <h3>{t === 'tr' ? 'Siparişler' : 'Orders'} ({orders.length})</h3>
                {orders.length === 0 ? (
                  <div className="empty-state">
                    {t === 'tr' ? 'Sipariş bulunamadı' : 'No orders found'}
                  </div>
                ) : (
                  <div className="order-cards">
                    {orders.map(order => (
                      <div
                        key={order.order_id}
                        className={`order-card ${selectedOrder?.order_id === order.order_id ? 'selected' : ''}`}
                        onClick={() => handleSelectOrder(order)}
                      >
                        <div className="order-card-top">
                          <span className="order-number">{order.order_number}</span>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="order-card-meta">
                          {order.customer_name}
                          {order.picker_full_name && (
                            <span className="picker-info"> — {order.picker_full_name}</span>
                          )}
                        </div>
                        <div className="order-card-bottom">
                          <span>{formatDate(order.order_date)}</span>
                          {getPriorityBadge(order.priority)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Detail Panel */}
              {selectedOrder && (
                <div className="order-detail-panel">
                  {detailLoading ? (
                    <div className="loading">{t === 'tr' ? 'Yükleniyor...' : 'Loading...'}</div>
                  ) : (
                    <>
                      <div className="order-detail-header">
                        <div>
                          <h3>{selectedOrder.order_number}</h3>
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                            {getStatusBadge(selectedOrder.status)}
                            {getPriorityBadge(selectedOrder.priority)}
                          </div>
                        </div>
                      </div>

                      <div className="order-detail-info">
                        <div className="detail-field">
                          <span className="label">{t === 'tr' ? 'Müşteri' : 'Customer'}</span>
                          <span className="value">{selectedOrder.customer_name}</span>
                        </div>
                        <div className="detail-field">
                          <span className="label">{t === 'tr' ? 'Depo' : 'Warehouse'}</span>
                          <span className="value">{selectedOrder.warehouse_name || selectedOrder.warehouse_code}</span>
                        </div>
                        <div className="detail-field">
                          <span className="label">{t === 'tr' ? 'Tarih' : 'Date'}</span>
                          <span className="value">{formatDate(selectedOrder.order_date)}</span>
                        </div>
                        <div className="detail-field">
                          <span className="label">{t === 'tr' ? 'Toplayıcı' : 'Picker'}</span>
                          <span className="value">
                            {selectedOrder.picker_full_name || selectedOrder.picker_username || '-'}
                          </span>
                        </div>
                        {selectedOrder.customer_address && (
                          <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
                            <span className="label">{t === 'tr' ? 'Adres' : 'Address'}</span>
                            <span className="value">{selectedOrder.customer_address}</span>
                          </div>
                        )}
                      </div>

                      {/* Items */}
                      <div className="order-items-section">
                        <h4>
                          {t === 'tr' ? 'Ürünler' : 'Items'}
                          {selectedOrder.items && ` (${selectedOrder.items.length})`}
                        </h4>
                        <div className="order-items-list">
                          {selectedOrder.items?.map(item => (
                            <div
                              key={item.item_id}
                              className="order-item-row"
                              onClick={() => {
                                if (selectedOrder.status === 'PICKING') handleRecordPick(item);
                              }}
                              style={{ cursor: selectedOrder.status === 'PICKING' ? 'pointer' : 'default' }}
                            >
                              <span className="item-line">{item.line_number}</span>
                              <span className={`item-status-dot ${getItemStatusDot(item)}`} />
                              <div className="item-info">
                                <div className="item-sku">{item.product_sku}</div>
                                <div className="item-name">{item.product_name}</div>
                              </div>
                              <div className="item-qty">
                                <span className="picked">{item.quantity_picked}</span>
                                <span className="total">/{item.quantity_ordered}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      {!isTerminal(selectedOrder.status) && (
                        <div className="order-actions">
                          {/* Assign Picker */}
                          {(selectedOrder.status === 'PENDING' || selectedOrder.status === 'READY_TO_PICK') && (
                            <>
                              <div className="picker-select-row" style={{ width: '100%' }}>
                                <select
                                  value={selectedPickerId}
                                  onChange={e => setSelectedPickerId(Number(e.target.value))}
                                >
                                  <option value={0}>
                                    {t === 'tr' ? 'Toplayıcı seç...' : 'Select picker...'}
                                  </option>
                                  {users
                                    .filter(u => ['ADMIN', 'MANAGER', 'OPERATOR'].includes(u.role))
                                    .map(u => (
                                      <option key={u.user_id} value={u.user_id}>
                                        {u.full_name || u.username} ({u.role})
                                      </option>
                                    ))}
                                </select>
                                <button
                                  className="btn-assign"
                                  onClick={handleAssignPicker}
                                  disabled={!selectedPickerId}
                                  style={{ opacity: selectedPickerId ? 1 : 0.5 }}
                                >
                                  {t === 'tr' ? 'Ata' : 'Assign'}
                                </button>
                              </div>
                            </>
                          )}

                          {/* Start Picking */}
                          {(selectedOrder.status === 'PENDING' || selectedOrder.status === 'READY_TO_PICK') && (
                            <button className="btn-start-pick" onClick={handleStartPicking}>
                              {t === 'tr' ? 'Toplamaya Başla' : 'Start Picking'}
                            </button>
                          )}

                          {/* Complete Picking */}
                          {selectedOrder.status === 'PICKING' && (
                            <button className="btn-complete-pick" onClick={handleCompletePicking}>
                              {t === 'tr' ? 'Toplamayı Tamamla' : 'Complete Picking'}
                            </button>
                          )}

                          {/* Cancel */}
                          <button className="btn-cancel-order" onClick={handleCancelOrder}>
                            {t === 'tr' ? 'İptal' : 'Cancel'}
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

      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{t === 'tr' ? 'Yeni Sipariş' : 'New Order'}</h3>
            <form onSubmit={handleCreateOrder}>
              <div className="form-group">
                <label>{t === 'tr' ? 'Sipariş No' : 'Order Number'} *</label>
                <input
                  type="text"
                  value={newOrder.order_number}
                  onChange={e => setNewOrder(p => ({ ...p, order_number: e.target.value }))}
                  placeholder="ORD-2026-001"
                  required
                />
              </div>
              <div className="form-group">
                <label>{t === 'tr' ? 'Müşteri Adı' : 'Customer Name'} *</label>
                <input
                  type="text"
                  value={newOrder.customer_name}
                  onChange={e => setNewOrder(p => ({ ...p, customer_name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t === 'tr' ? 'Adres' : 'Address'}</label>
                <input
                  type="text"
                  value={newOrder.customer_address}
                  onChange={e => setNewOrder(p => ({ ...p, customer_address: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>{t === 'tr' ? 'Öncelik' : 'Priority'}</label>
                <select
                  value={newOrder.priority}
                  onChange={e => setNewOrder(p => ({ ...p, priority: e.target.value }))}
                >
                  {Object.keys(PRIORITY_LABELS[t]).map(p => (
                    <option key={p} value={p}>{PRIORITY_LABELS[t][p]}</option>
                  ))}
                </select>
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
                  <button type="button" className="btn-add-item" onClick={handleAddItem}>+</button>
                </div>
                {newItems.length > 0 && (
                  <div className="modal-items-list">
                    {newItems.map((item, i) => (
                      <div key={i} className="modal-item">
                        <span>{item.product_sku} x{item.quantity}</span>
                        <button type="button" className="remove-item" onClick={() => handleRemoveItem(i)}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>{t === 'tr' ? 'Notlar' : 'Notes'}</label>
                <textarea
                  value={newOrder.notes}
                  onChange={e => setNewOrder(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                />
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

export default Orders;
