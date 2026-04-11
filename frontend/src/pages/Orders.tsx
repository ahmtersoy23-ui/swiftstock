import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { orderApi } from '../lib/api/orders';
import { userApi } from '../lib/api';
import { useStore } from '../stores/appStore';
import type { ShipmentOrder, ShipmentOrderItem } from '../types';

const STATUS_LABELS: Record<string, Record<string, string>> = {
  tr: {
    PENDING: 'Bekliyor', READY_TO_PICK: 'Toplamaya Hazir', PICKING: 'Toplaniyor',
    PICKED: 'Toplandi', SHIPPED: 'Gonderildi', CANCELLED: 'Iptal',
  },
  en: {
    PENDING: 'Pending', READY_TO_PICK: 'Ready to Pick', PICKING: 'Picking',
    PICKED: 'Picked', SHIPPED: 'Shipped', CANCELLED: 'Cancelled',
  },
};

const PRIORITY_LABELS: Record<string, Record<string, string>> = {
  tr: { URGENT: 'Acil', HIGH: 'Yuksek', NORMAL: 'Normal', LOW: 'Dusuk' },
  en: { URGENT: 'Urgent', HIGH: 'High', NORMAL: 'Normal', LOW: 'Low' },
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  ready_to_pick: 'bg-blue-100 text-blue-700',
  picking: 'bg-indigo-100 text-indigo-700',
  picked: 'bg-green-100 text-green-600',
  shipped: 'bg-cyan-100 text-cyan-600',
  cancelled: 'bg-red-100 text-red-600',
};

const PRIORITY_BADGE_CLASSES: Record<string, string> = {
  urgent: 'bg-red-600 text-white',
  high: 'bg-amber-500 text-white',
  normal: 'bg-slate-200 text-slate-500',
  low: 'bg-slate-100 text-slate-400',
};

const ITEM_STATUS_COLORS: Record<string, string> = {
  'is-pending': 'bg-amber-400',
  'is-picking': 'bg-indigo-400',
  'is-picked': 'bg-green-500',
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
        showMsg(t === 'tr' ? 'Toplayici atandi' : 'Picker assigned');
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
        showMsg(t === 'tr' ? 'Toplama baslatildi' : 'Picking started');
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
        showMsg(t === 'tr' ? 'Toplama tamamlandi' : 'Picking completed');
        handleSelectOrder(selectedOrder);
        loadOrders();
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to complete picking');
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    const reason = prompt(t === 'tr' ? 'Iptal nedeni:' : 'Cancel reason:');
    if (reason === null) return;

    try {
      const res = await orderApi.cancel(selectedOrder.order_id, reason);
      if (res.success) {
        showMsg(t === 'tr' ? 'Siparis iptal edildi' : 'Order cancelled');
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
      setError(t === 'tr' ? 'Siparis no, musteri adi ve en az 1 urun gerekli' : 'Order number, customer name and at least 1 item required');
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
        showMsg(t === 'tr' ? 'Siparis olusturuldu' : 'Order created');
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
    <span className={`inline-block px-2 py-0.5 rounded-full text-[0.65rem] font-semibold uppercase ${STATUS_BADGE_CLASSES[status.toLowerCase()] || ''}`}>
      {STATUS_LABELS[t][status] || status}
    </span>
  );

  const getPriorityBadge = (priority: string) => (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[0.6rem] font-bold uppercase ${PRIORITY_BADGE_CLASSES[priority.toLowerCase()] || ''}`}>
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
    <div className="min-h-[calc(100vh-120px)] bg-slate-100 p-4">
      <div className="max-w-[900px] mx-auto bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="bg-gradient-to-br from-violet-500 to-violet-700 text-white p-5 flex items-center gap-3">
          <button className="bg-white/20 border-none text-white w-9 h-9 rounded-lg text-lg cursor-pointer flex items-center justify-center duration-200 hover:bg-white/30" onClick={() => navigate('/')}>←</button>
          <h2 className="m-0 text-white text-xl font-bold flex-1 leading-9 h-9 flex items-center">{t === 'tr' ? 'Siparisler' : 'Orders'}</h2>
          <button className="py-2 px-4 bg-white/20 text-white border-2 border-white/30 rounded-lg font-semibold cursor-pointer text-sm hover:bg-white/30" onClick={() => setShowCreateModal(true)}>
            + {t === 'tr' ? 'Yeni' : 'New'}
          </button>
        </div>

        <div className="p-4">
          {success && <div className="py-3 px-4 bg-green-100 text-green-600 rounded-lg mb-4 font-medium">{success}</div>}
          {error && <div className="py-3 px-4 bg-red-100 text-red-600 rounded-lg mb-4 font-medium cursor-pointer" onClick={() => setError(null)}>{error}</div>}

          <form className="flex gap-2 mb-4 flex-wrap max-sm:flex-col" onSubmit={handleSearch}>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="py-2 px-3 border-2 border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-violet-500"
            >
              <option value="">{t === 'tr' ? 'Tum Durumlar' : 'All Statuses'}</option>
              {Object.keys(STATUS_LABELS[t]).map(s => (
                <option key={s} value={s}>{STATUS_LABELS[t][s]}</option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="py-2 px-3 border-2 border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-violet-500"
            >
              <option value="">{t === 'tr' ? 'Tum Oncelikler' : 'All Priorities'}</option>
              {Object.keys(PRIORITY_LABELS[t]).map(p => (
                <option key={p} value={p}>{PRIORITY_LABELS[t][p]}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder={t === 'tr' ? 'Siparis no veya musteri...' : 'Order # or customer...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 min-w-[120px] py-2 px-3 border-2 border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-violet-500"
            />
          </form>

          {loading ? (
            <div className="text-center p-8 text-slate-500">{t === 'tr' ? 'Yukleniyor...' : 'Loading...'}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-4">
              {/* Order List */}
              <div>
                <h3 className="m-0 mb-3 text-base text-slate-800">{t === 'tr' ? 'Siparisler' : 'Orders'} ({orders.length})</h3>
                {orders.length === 0 ? (
                  <div className="text-center p-8 text-slate-400 text-sm">
                    {t === 'tr' ? 'Siparis bulunamadi' : 'No orders found'}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[calc(100vh-340px)] overflow-y-auto">
                    {orders.map(order => (
                      <div
                        key={order.order_id}
                        className={`p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl cursor-pointer duration-200 hover:border-violet-500 hover:bg-violet-50 ${selectedOrder?.order_id === order.order_id ? 'border-violet-500 bg-violet-50 shadow-[0_0_0_3px_rgba(139,92,246,0.1)]' : ''}`}
                        onClick={() => handleSelectOrder(order)}
                      >
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-base font-bold text-slate-800 font-mono">{order.order_number}</span>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="text-[0.8rem] text-slate-500 mb-1">
                          {order.customer_name}
                          {order.picker_full_name && (
                            <span className="text-xs text-violet-700 font-medium"> — {order.picker_full_name}</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center text-xs text-slate-400 mt-1.5">
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
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  {detailLoading ? (
                    <div className="text-center p-8 text-slate-500">{t === 'tr' ? 'Yukleniyor...' : 'Loading...'}</div>
                  ) : (
                    <>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="m-0 text-lg text-slate-800">{selectedOrder.order_number}</h3>
                          <div className="flex gap-2 mt-1">
                            {getStatusBadge(selectedOrder.status)}
                            {getPriorityBadge(selectedOrder.priority)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-2 mb-4 text-[0.8rem]">
                        <div className="flex flex-col">
                          <span className="text-slate-400 text-[0.7rem] uppercase font-semibold">{t === 'tr' ? 'Musteri' : 'Customer'}</span>
                          <span className="text-slate-800 font-medium">{selectedOrder.customer_name}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-slate-400 text-[0.7rem] uppercase font-semibold">{t === 'tr' ? 'Depo' : 'Warehouse'}</span>
                          <span className="text-slate-800 font-medium">{selectedOrder.warehouse_name || selectedOrder.warehouse_code}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-slate-400 text-[0.7rem] uppercase font-semibold">{t === 'tr' ? 'Tarih' : 'Date'}</span>
                          <span className="text-slate-800 font-medium">{formatDate(selectedOrder.order_date)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-slate-400 text-[0.7rem] uppercase font-semibold">{t === 'tr' ? 'Toplayici' : 'Picker'}</span>
                          <span className="text-slate-800 font-medium">
                            {selectedOrder.picker_full_name || selectedOrder.picker_username || '-'}
                          </span>
                        </div>
                        {selectedOrder.customer_address && (
                          <div className="flex flex-col col-span-full">
                            <span className="text-slate-400 text-[0.7rem] uppercase font-semibold">{t === 'tr' ? 'Adres' : 'Address'}</span>
                            <span className="text-slate-800 font-medium">{selectedOrder.customer_address}</span>
                          </div>
                        )}
                      </div>

                      {/* Items */}
                      <div>
                        <h4 className="m-0 mb-2 text-[0.9rem] text-slate-600">
                          {t === 'tr' ? 'Urunler' : 'Items'}
                          {selectedOrder.items && ` (${selectedOrder.items.length})`}
                        </h4>
                        <div className="flex flex-col gap-1.5">
                          {selectedOrder.items?.map(item => (
                            <div
                              key={item.item_id}
                              className="flex items-center gap-2 py-2 px-2.5 bg-white rounded-lg border border-slate-200 text-[0.8rem]"
                              onClick={() => {
                                if (selectedOrder.status === 'PICKING') handleRecordPick(item);
                              }}
                              style={{ cursor: selectedOrder.status === 'PICKING' ? 'pointer' : 'default' }}
                            >
                              <span className="w-[22px] h-[22px] bg-slate-200 rounded-full flex items-center justify-center text-[0.65rem] font-bold text-slate-500 shrink-0">{item.line_number}</span>
                              <span className={`w-2 h-2 rounded-full shrink-0 ${ITEM_STATUS_COLORS[getItemStatusDot(item)] || ''}`} />
                              <div className="flex-1 min-w-0">
                                <div className="font-mono text-[0.7rem] text-violet-500 font-semibold">{item.product_sku}</div>
                                <div className="text-xs text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">{item.product_name}</div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-green-600 font-bold">{item.quantity_picked}</span>
                                <span className="text-slate-400">/{item.quantity_ordered}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      {!isTerminal(selectedOrder.status) && (
                        <div className="flex gap-2 mt-4 flex-wrap max-sm:flex-col">
                          {/* Assign Picker */}
                          {(selectedOrder.status === 'PENDING' || selectedOrder.status === 'READY_TO_PICK') && (
                            <>
                              <div className="flex gap-2 w-full">
                                <select
                                  value={selectedPickerId}
                                  onChange={e => setSelectedPickerId(Number(e.target.value))}
                                  className="flex-1 py-2 border-2 border-slate-200 rounded-lg text-[0.8rem] focus:outline-none focus:border-violet-500"
                                >
                                  <option value={0}>
                                    {t === 'tr' ? 'Toplayici sec...' : 'Select picker...'}
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
                                  className="bg-blue-100 text-blue-700 border-none rounded-lg text-[0.8rem] font-semibold cursor-pointer px-3 py-2 hover:bg-blue-200"
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
                            <button className="flex-1 min-w-[100px] py-2 px-3 border-none rounded-lg text-[0.8rem] font-semibold cursor-pointer duration-200 bg-gradient-to-br from-violet-500 to-violet-700 text-white hover:opacity-90" onClick={handleStartPicking}>
                              {t === 'tr' ? 'Toplamaya Basla' : 'Start Picking'}
                            </button>
                          )}

                          {/* Complete Picking */}
                          {selectedOrder.status === 'PICKING' && (
                            <button className="flex-1 min-w-[100px] py-2 px-3 border-none rounded-lg text-[0.8rem] font-semibold cursor-pointer duration-200 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white hover:opacity-90" onClick={handleCompletePicking}>
                              {t === 'tr' ? 'Toplamayi Tamamla' : 'Complete Picking'}
                            </button>
                          )}

                          {/* Cancel */}
                          <button className="flex-1 min-w-[100px] py-2 px-3 rounded-lg text-[0.8rem] font-semibold cursor-pointer duration-200 bg-slate-100 text-red-600 border border-red-200 hover:bg-red-100" onClick={handleCancelOrder}>
                            {t === 'tr' ? 'Iptal' : 'Cancel'}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-[480px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="m-0 mb-5 text-slate-800 text-lg">{t === 'tr' ? 'Yeni Siparis' : 'New Order'}</h3>
            <form onSubmit={handleCreateOrder}>
              <div className="mb-4">
                <label className="block mb-1.5 font-medium text-slate-600 text-sm">{t === 'tr' ? 'Siparis No' : 'Order Number'} *</label>
                <input
                  type="text"
                  value={newOrder.order_number}
                  onChange={e => setNewOrder(p => ({ ...p, order_number: e.target.value }))}
                  placeholder="ORD-2026-001"
                  required
                  className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-[0.9375rem] duration-200 box-border focus:outline-none focus:border-violet-500"
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1.5 font-medium text-slate-600 text-sm">{t === 'tr' ? 'Musteri Adi' : 'Customer Name'} *</label>
                <input
                  type="text"
                  value={newOrder.customer_name}
                  onChange={e => setNewOrder(p => ({ ...p, customer_name: e.target.value }))}
                  required
                  className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-[0.9375rem] duration-200 box-border focus:outline-none focus:border-violet-500"
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1.5 font-medium text-slate-600 text-sm">{t === 'tr' ? 'Adres' : 'Address'}</label>
                <input
                  type="text"
                  value={newOrder.customer_address}
                  onChange={e => setNewOrder(p => ({ ...p, customer_address: e.target.value }))}
                  className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-[0.9375rem] duration-200 box-border focus:outline-none focus:border-violet-500"
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1.5 font-medium text-slate-600 text-sm">{t === 'tr' ? 'Oncelik' : 'Priority'}</label>
                <select
                  value={newOrder.priority}
                  onChange={e => setNewOrder(p => ({ ...p, priority: e.target.value }))}
                  className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-[0.9375rem] duration-200 box-border focus:outline-none focus:border-violet-500"
                >
                  {Object.keys(PRIORITY_LABELS[t]).map(p => (
                    <option key={p} value={p}>{PRIORITY_LABELS[t][p]}</option>
                  ))}
                </select>
              </div>

              {/* Item Adder */}
              <div className="mb-4">
                <label className="block mb-1.5 font-medium text-slate-600 text-sm">{t === 'tr' ? 'Urunler' : 'Items'} *</label>
                <div className="flex gap-2 items-end">
                  <div className="flex-[2]">
                    <input
                      type="text"
                      value={itemSku}
                      onChange={e => setItemSku(e.target.value)}
                      placeholder="IWASKU"
                      className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-[0.9375rem] duration-200 box-border focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={itemQty}
                      onChange={e => setItemQty(Math.max(1, Number(e.target.value)))}
                      min={1}
                      className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-[0.9375rem] duration-200 box-border focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <button type="button" className="py-2.5 px-3 bg-violet-500 text-white border-none rounded-lg text-base cursor-pointer whitespace-nowrap h-[42px] hover:bg-violet-600" onClick={handleAddItem}>+</button>
                </div>
                {newItems.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1">
                    {newItems.map((item, i) => (
                      <div key={i} className="flex justify-between items-center py-1.5 px-2 bg-slate-50 rounded-md text-[0.8rem]">
                        <span>{item.product_sku} x{item.quantity}</span>
                        <button type="button" className="bg-transparent border-none text-red-600 cursor-pointer text-base px-1" onClick={() => handleRemoveItem(i)}>x</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label className="block mb-1.5 font-medium text-slate-600 text-sm">{t === 'tr' ? 'Notlar' : 'Notes'}</label>
                <textarea
                  value={newOrder.notes}
                  onChange={e => setNewOrder(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-[0.9375rem] duration-200 box-border focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex gap-3 mt-6 justify-end">
                <button type="button" className="py-2.5 px-4 bg-slate-100 text-slate-500 border-none rounded-lg font-medium cursor-pointer hover:bg-slate-200" onClick={() => setShowCreateModal(false)}>
                  {t === 'tr' ? 'Vazgec' : 'Cancel'}
                </button>
                <button type="submit" className="py-2.5 px-4 bg-gradient-to-br from-violet-500 to-violet-700 text-white border-none rounded-lg font-medium cursor-pointer hover:opacity-90" disabled={newItems.length === 0}>
                  {t === 'tr' ? 'Olustur' : 'Create'}
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
