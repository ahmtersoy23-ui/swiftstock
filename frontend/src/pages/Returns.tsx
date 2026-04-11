import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { rmaApi } from '../lib/api/rma';
import { apiClient } from '../lib/api';
import { useStore } from '../stores/appStore';
import { Modal, ModalHeader, ModalBody } from '../shared/components/Modal';
import type { RMARequest, RMAItem, RMAHistory, Warehouse } from '../types';

const STATUS_LABELS: Record<string, Record<string, string>> = {
  tr: { PENDING: 'Bekliyor', APPROVED: 'Onaylandi', IN_PROCESS: 'Islemde', COMPLETED: 'Tamamlandi' },
  en: { PENDING: 'Pending', APPROVED: 'Approved', IN_PROCESS: 'In Process', COMPLETED: 'Completed' },
};

const ACTION_LABELS: Record<string, Record<string, string>> = {
  tr: { REFUND: 'Iade', REPLACE: 'Degisim', REPAIR: 'Tamir', DISCARD: 'Imha' },
  en: { REFUND: 'Refund', REPLACE: 'Replace', REPAIR: 'Repair', DISCARD: 'Discard' },
};

const CONDITION_LABELS: Record<string, Record<string, string>> = {
  tr: { NEW: 'Yeni', GOOD: 'Iyi', DAMAGED: 'Hasarli', DEFECTIVE: 'Kusurlu' },
  en: { NEW: 'New', GOOD: 'Good', DAMAGED: 'Damaged', DEFECTIVE: 'Defective' },
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  in_process: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-600',
};

const ACTION_BADGE_CLASSES: Record<string, string> = {
  refund: 'bg-green-100 text-green-600',
  replace: 'bg-blue-100 text-blue-700',
  repair: 'bg-amber-100 text-amber-700',
  discard: 'bg-red-100 text-red-600',
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
        showMsg(t === 'tr' ? 'RMA onaylandi' : 'RMA approved');
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
        showMsg(t === 'tr' ? 'Iade kabul edildi' : 'Return received');
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
    if (!confirm(t === 'tr' ? 'RMA\'yi tamamlamak istediginize emin misiniz?' : 'Complete this RMA?')) return;

    try {
      const res = await rmaApi.complete(selectedDetail.rma.rma_id);
      if (res.success) {
        showMsg(t === 'tr' ? 'RMA tamamlandi' : 'RMA completed');
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
      setError(t === 'tr' ? 'Iade nedeni ve en az 1 urun gerekli' : 'Reason and at least 1 item required');
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
        showMsg(t === 'tr' ? 'RMA olusturuldu' : 'RMA created');
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
    <span className={`inline-block px-2 py-0.5 rounded-full text-[0.65rem] font-semibold uppercase ${STATUS_BADGE_CLASSES[status.toLowerCase()] || ''}`}>
      {STATUS_LABELS[t][status] || status}
    </span>
  );

  const getActionBadge = (action: string) => (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[0.6rem] font-bold uppercase ${ACTION_BADGE_CLASSES[action.toLowerCase()] || ''}`}>
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
    <div className="min-h-[calc(100vh-120px)] bg-slate-100 p-4">
      <div className="max-w-[900px] mx-auto bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-5 flex items-center gap-3">
          <button className="bg-white/20 border-none text-white w-9 h-9 rounded-lg text-lg cursor-pointer flex items-center justify-center hover:bg-white/30" onClick={() => navigate('/')}>←</button>
          <h2 className="m-0 text-white text-xl font-bold flex-1 leading-9 h-9 flex items-center">{t === 'tr' ? 'Iade Yonetimi (RMA)' : 'Returns (RMA)'}</h2>
          <button className="py-2 px-4 bg-white/20 text-white border-2 border-white/30 rounded-lg font-semibold cursor-pointer text-sm hover:bg-white/30" onClick={() => setShowCreateModal(true)}>
            + {t === 'tr' ? 'Yeni' : 'New'}
          </button>
        </div>

        <div className="p-4">
          {success && <div className="py-3 px-4 bg-green-100 text-green-600 rounded-lg mb-4 font-medium">{success}</div>}
          {error && <div className="py-3 px-4 bg-red-100 text-red-600 rounded-lg mb-4 font-medium cursor-pointer" onClick={() => setError(null)}>{error}</div>}

          <div className="flex gap-2 mb-4 flex-wrap">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="py-2 px-3 border-2 border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-amber-500"
            >
              <option value="">{t === 'tr' ? 'Tum Durumlar' : 'All Statuses'}</option>
              {Object.keys(STATUS_LABELS[t]).map(s => (
                <option key={s} value={s}>{STATUS_LABELS[t][s]}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="text-center p-8 text-slate-500">{t === 'tr' ? 'Yukleniyor...' : 'Loading...'}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1.3fr] gap-4">
              {/* RMA List */}
              <div>
                <h3 className="m-0 mb-3 text-base text-slate-800">RMA ({rmas.length})</h3>
                {rmas.length === 0 ? (
                  <div className="text-center p-8 text-slate-400 text-sm">
                    {t === 'tr' ? 'Iade kaydi bulunamadi' : 'No RMA records found'}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[calc(100vh-340px)] overflow-y-auto">
                    {rmas.map(r => (
                      <div
                        key={r.rma_id}
                        className={`p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl cursor-pointer duration-200 hover:border-amber-500 hover:bg-amber-50 ${rma?.rma_id === r.rma_id ? 'border-amber-500 bg-yellow-50 shadow-[0_0_0_3px_rgba(245,158,11,0.1)]' : ''}`}
                        onClick={() => handleSelectRma(r)}
                      >
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[0.9rem] font-bold text-slate-800 font-mono">{r.rma_number}</span>
                          {getStatusBadge(r.status)}
                        </div>
                        <div className="text-[0.8rem] text-slate-500 mb-1">
                          {r.customer_name || r.order_number || r.reason}
                        </div>
                        <div className="flex justify-between items-center text-xs text-slate-400 mt-1.5">
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
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  {detailLoading ? (
                    <div className="text-center p-8 text-slate-500">{t === 'tr' ? 'Yukleniyor...' : 'Loading...'}</div>
                  ) : (
                    <>
                      <div>
                        <h3 className="m-0 text-lg text-slate-800">{rma.rma_number}</h3>
                        <div className="flex gap-2 mt-1">
                          {getStatusBadge(rma.status)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-2 my-3 text-[0.8rem]">
                        <div className="flex flex-col">
                          <span className="text-slate-400 text-[0.7rem] uppercase font-semibold">{t === 'tr' ? 'Musteri' : 'Customer'}</span>
                          <span className="text-slate-800 font-medium">{rma.customer_name || '-'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-slate-400 text-[0.7rem] uppercase font-semibold">{t === 'tr' ? 'Siparis No' : 'Order #'}</span>
                          <span className="text-slate-800 font-medium">{rma.order_number || '-'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-slate-400 text-[0.7rem] uppercase font-semibold">{t === 'tr' ? 'Depo' : 'Warehouse'}</span>
                          <span className="text-slate-800 font-medium">{rma.warehouse_name || rma.warehouse_code}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-slate-400 text-[0.7rem] uppercase font-semibold">{t === 'tr' ? 'Tarih' : 'Date'}</span>
                          <span className="text-slate-800 font-medium">{formatDate(rma.created_at)}</span>
                        </div>
                        <div className="flex flex-col col-span-full">
                          <span className="text-slate-400 text-[0.7rem] uppercase font-semibold">{t === 'tr' ? 'Neden' : 'Reason'}</span>
                          <span className="text-slate-800 font-medium">{rma.reason}</span>
                        </div>
                      </div>

                      {/* Items */}
                      <div>
                        <h4 className="m-0 mb-2 text-[0.9rem] text-slate-600">{t === 'tr' ? 'Urunler' : 'Items'} ({selectedDetail.items.length})</h4>
                        <div className="flex flex-col gap-1.5">
                          {selectedDetail.items.map(item => (
                            <div key={item.item_id}>
                              <div
                                className="flex items-center gap-2 py-2 px-2.5 bg-white rounded-lg border border-slate-200 text-[0.8rem]"
                                onClick={() => {
                                  if (rma.status === 'APPROVED' || rma.status === 'IN_PROCESS') {
                                    setReceiveItemId(receiveItemId === item.item_id ? null : item.item_id);
                                    setReceiveQty(Math.max(1, item.quantity_requested - item.quantity_received));
                                  }
                                }}
                                style={{ cursor: ['APPROVED', 'IN_PROCESS'].includes(rma.status) ? 'pointer' : 'default' }}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="font-mono text-[0.7rem] text-amber-600 font-semibold">{item.product_sku}</div>
                                  <div className="text-xs text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">{item.product_name}</div>
                                </div>
                                {getActionBadge(item.action)}
                                <div className="text-right shrink-0">
                                  <span className="text-green-600 font-bold">{item.quantity_received}</span>
                                  <span className="text-slate-400">/{item.quantity_requested}</span>
                                </div>
                              </div>

                              {/* Receive Inline Form */}
                              {receiveItemId === item.item_id && (
                                <div className="mt-2 p-2 bg-amber-50 rounded-md border border-amber-200 flex gap-1.5 items-end flex-wrap max-sm:flex-col">
                                  <div className="flex flex-col gap-0.5">
                                    <label className="text-[0.65rem] text-amber-800 font-semibold">{t === 'tr' ? 'Adet' : 'Qty'}</label>
                                    <input
                                      type="number"
                                      value={receiveQty}
                                      onChange={e => setReceiveQty(Math.max(1, Number(e.target.value)))}
                                      min={1}
                                      max={item.quantity_requested - item.quantity_received}
                                      className="py-1.5 px-2 border border-slate-200 rounded text-xs w-[60px] focus:outline-none focus:border-amber-500"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <label className="text-[0.65rem] text-amber-800 font-semibold">{t === 'tr' ? 'Durum' : 'Condition'}</label>
                                    <select
                                      value={receiveCondition}
                                      onChange={e => setReceiveCondition(e.target.value)}
                                      className="py-1.5 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:border-amber-500"
                                    >
                                      {Object.keys(CONDITION_LABELS[t]).map(c => (
                                        <option key={c} value={c}>{CONDITION_LABELS[t][c]}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <button className="py-1.5 px-2.5 bg-amber-500 text-white border-none rounded text-xs font-semibold cursor-pointer whitespace-nowrap hover:bg-amber-600" onClick={() => handleReceive(item)}>
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
                        <div className="mt-4">
                          <h4 className="m-0 mb-2 text-[0.85rem] text-slate-600">{t === 'tr' ? 'Gecmis' : 'History'}</h4>
                          {selectedDetail.history.map(h => (
                            <div key={h.history_id} className="flex gap-2 py-1.5 border-b border-slate-100 text-xs">
                              <span className="font-semibold text-slate-800 min-w-[80px]">{h.action}</span>
                              <span className="text-slate-400 flex-1">
                                {h.performed_by} — {formatDate(h.created_at)}
                                {h.notes && ` — ${h.notes}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      {rma.status !== 'COMPLETED' && (
                        <div className="flex gap-2 mt-4 flex-wrap max-sm:flex-col">
                          {rma.status === 'PENDING' && (
                            <button className="flex-1 min-w-[100px] py-2 px-3 border-none rounded-lg text-[0.8rem] font-semibold cursor-pointer duration-200 bg-gradient-to-br from-blue-500 to-blue-700 text-white hover:opacity-90" onClick={handleApprove}>
                              {t === 'tr' ? 'Onayla' : 'Approve'}
                            </button>
                          )}
                          {(rma.status === 'APPROVED' || rma.status === 'IN_PROCESS') && (
                            <button className="flex-1 min-w-[100px] py-2 px-3 border-none rounded-lg text-[0.8rem] font-semibold cursor-pointer duration-200 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white hover:opacity-90" onClick={handleComplete}>
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
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} size="xl">
        <ModalHeader onClose={() => setShowCreateModal(false)}>{t === 'tr' ? 'Yeni Iade (RMA)' : 'New Return (RMA)'}</ModalHeader>
        <ModalBody>
            <form onSubmit={handleCreateRma}>
              <div className="mb-4">
                <label className="block mb-1.5 font-medium text-slate-600 text-sm">{t === 'tr' ? 'Depo' : 'Warehouse'} *</label>
                <select
                  value={newRma.warehouse_id}
                  onChange={e => setNewRma(p => ({ ...p, warehouse_id: Number(e.target.value) }))}
                  required
                  className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-[0.9375rem] box-border focus:outline-none focus:border-amber-500"
                >
                  {warehouses.filter(w => w.is_active).map(w => (
                    <option key={w.warehouse_id} value={w.warehouse_id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block mb-1.5 font-medium text-slate-600 text-sm">{t === 'tr' ? 'Musteri Adi' : 'Customer Name'}</label>
                <input
                  type="text"
                  value={newRma.customer_name}
                  onChange={e => setNewRma(p => ({ ...p, customer_name: e.target.value }))}
                  className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-[0.9375rem] box-border focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1.5 font-medium text-slate-600 text-sm">{t === 'tr' ? 'Siparis No' : 'Order Number'}</label>
                <input
                  type="text"
                  value={newRma.order_number}
                  onChange={e => setNewRma(p => ({ ...p, order_number: e.target.value }))}
                  className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-[0.9375rem] box-border focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1.5 font-medium text-slate-600 text-sm">{t === 'tr' ? 'Iade Nedeni' : 'Reason'} *</label>
                <textarea
                  value={newRma.reason}
                  onChange={e => setNewRma(p => ({ ...p, reason: e.target.value }))}
                  rows={2}
                  required
                  className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-[0.9375rem] box-border focus:outline-none focus:border-amber-500"
                />
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
                      className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-[0.9375rem] box-border focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={itemQty}
                      onChange={e => setItemQty(Math.max(1, Number(e.target.value)))}
                      min={1}
                      className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-[0.9375rem] box-border focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="flex-1">
                    <select
                      value={itemAction}
                      onChange={e => setItemAction(e.target.value)}
                      className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-[0.9375rem] box-border focus:outline-none focus:border-amber-500"
                    >
                      {Object.keys(ACTION_LABELS[t]).map(a => (
                        <option key={a} value={a}>{ACTION_LABELS[t][a]}</option>
                      ))}
                    </select>
                  </div>
                  <button type="button" className="py-2.5 px-3 bg-amber-500 text-white border-none rounded-lg text-base cursor-pointer h-[42px] hover:bg-amber-600" onClick={handleAddItem}>+</button>
                </div>
                {newItems.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1">
                    {newItems.map((item, i) => (
                      <div key={i} className="flex justify-between items-center py-1.5 px-2 bg-slate-50 rounded-md text-[0.8rem]">
                        <span>{item.product_sku} x{item.quantity_requested} ({ACTION_LABELS[t][item.action]})</span>
                        <button type="button" className="bg-transparent border-none text-red-600 cursor-pointer text-base px-1" onClick={() => setNewItems(prev => prev.filter((_, idx) => idx !== i))}>x</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6 justify-end">
                <button type="button" className="py-2.5 px-4 bg-slate-100 text-slate-500 border-none rounded-lg font-medium cursor-pointer hover:bg-slate-200" onClick={() => setShowCreateModal(false)}>
                  {t === 'tr' ? 'Vazgec' : 'Cancel'}
                </button>
                <button type="submit" className="py-2.5 px-4 bg-gradient-to-br from-amber-500 to-amber-600 text-white border-none rounded-lg font-medium cursor-pointer hover:opacity-90" disabled={newItems.length === 0}>
                  {t === 'tr' ? 'Olustur' : 'Create'}
                </button>
              </div>
            </form>
        </ModalBody>
      </Modal>
    </div>
  );
}

export default Returns;
