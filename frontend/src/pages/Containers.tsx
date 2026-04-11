import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { containerApi, shipmentApi, apiClient } from '../lib/api';
import { useStore } from '../stores/appStore';
import { useSSOStore } from '../stores/ssoStore';
import type { VirtualShipment, Warehouse } from '../types';

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
  const [, setWarehouses] = useState<Warehouse[]>([]);
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
    const statusColors: Record<string, string> = {
      active: 'bg-green-100 text-green-600',
      opened: 'bg-red-100 text-red-600',
      sealed: 'bg-blue-100 text-blue-700',
      empty: 'bg-slate-100 text-slate-400',
      partial: 'bg-amber-100 text-amber-700',
    };
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full text-[0.6rem] font-semibold uppercase ${statusColors[s.toLowerCase()] || 'bg-slate-100 text-slate-400'}`}>
        {labels[t][s] || s}
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    const cls = type === 'BOX' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700';
    return (
      <span className={`inline-block px-1.5 py-0.5 rounded text-[0.6rem] font-bold uppercase ${cls}`}>
        {type === 'BOX' ? (t === 'tr' ? 'Koli' : 'Box') : (t === 'tr' ? 'Palet' : 'Pallet')}
      </span>
    );
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString(t === 'tr' ? 'tr-TR' : 'en-US', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  };

  const ctr = selectedDetail?.container;

  return (
    <div className="min-h-[calc(100vh-120px)] bg-slate-100 p-4">
      <div className="max-w-[900px] mx-auto bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white p-5 flex items-center gap-3">
          <button className="bg-white/20 border-none text-white w-9 h-9 rounded-lg text-[1.125rem] cursor-pointer flex items-center justify-center hover:bg-white/30" onClick={() => navigate('/')}>←</button>
          <h2 className="m-0 text-white text-xl font-bold flex-1 leading-9 flex items-center">{t === 'tr' ? 'Koli / Palet Yönetimi' : 'Container Management'}</h2>
          <button className="px-4 py-2 bg-white/20 text-white border-2 border-white/30 rounded-lg font-semibold cursor-pointer text-sm hover:bg-white/30" onClick={() => setShowCreateModal(true)}>
            + {t === 'tr' ? 'Yeni' : 'New'}
          </button>
        </div>

        <div className="p-4">
          {success && <div className="p-3 px-4 bg-green-100 text-green-600 rounded-lg mb-4 font-medium">{success}</div>}
          {error && <div className="p-3 px-4 bg-red-100 text-red-600 rounded-lg mb-4 font-medium cursor-pointer" onClick={() => setError(null)}>{error}</div>}

          <form className="flex gap-2 mb-4 flex-wrap" onSubmit={handleSearch}>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border-2 border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-cyan-500">
              <option value="">{t === 'tr' ? 'Tüm Tipler' : 'All Types'}</option>
              <option value="BOX">{t === 'tr' ? 'Koli' : 'Box'}</option>
              <option value="PALLET">{t === 'tr' ? 'Palet' : 'Pallet'}</option>
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border-2 border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-cyan-500">
              <option value="">{t === 'tr' ? 'Tüm Durumlar' : 'All Statuses'}</option>
              <option value="ACTIVE">{t === 'tr' ? 'Aktif' : 'Active'}</option>
              <option value="OPENED">{t === 'tr' ? 'Açıldı' : 'Opened'}</option>
            </select>
            <input
              type="text"
              placeholder={t === 'tr' ? 'Barkod veya isim ara...' : 'Search barcode or name...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 min-w-[120px] px-3 py-2 border-2 border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-cyan-500"
            />
          </form>

          {loading ? (
            <div className="text-center p-8 text-slate-500">{t === 'tr' ? 'Yükleniyor...' : 'Loading...'}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-4">
              {/* List */}
              <div>
                <h3 className="m-0 mb-3 text-base text-slate-800">{t === 'tr' ? 'Konteynerler' : 'Containers'} ({containers.length})</h3>
                {containers.length === 0 ? (
                  <div className="text-center p-8 text-slate-400 text-sm">
                    {t === 'tr' ? 'Koli/palet bulunamadı' : 'No containers found'}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[calc(100vh-340px)] overflow-y-auto">
                    {containers.map(c => (
                      <div
                        key={c.container_id}
                        className={`p-3 bg-slate-50 border-2 rounded-xl cursor-pointer transition-all duration-200 ${ctr?.container_id === c.container_id ? 'border-cyan-500 bg-cyan-50 shadow-[0_0_0_3px_rgba(6,182,212,0.1)]' : 'border-slate-200 hover:border-cyan-500 hover:bg-cyan-50'}`}
                        onClick={() => handleSelectContainer(c)}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[0.95rem] font-bold text-slate-800 font-mono">{c.barcode}</span>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            {getTypeBadge(c.container_type)}
                            {getStatusLabel(c)}
                          </div>
                        </div>
                        {c.display_name && (
                          <div className="text-[0.8rem] text-cyan-600 font-semibold mb-1">{c.display_name}</div>
                        )}
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>{c.current_items} {t === 'tr' ? 'ürün' : 'items'}</span>
                          <span>
                            {c.shipment_name && <span className="inline-block px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded text-[0.65rem] font-semibold">{c.shipment_name}</span>}
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
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  {detailLoading ? (
                    <div className="text-center p-8 text-slate-500">{t === 'tr' ? 'Yükleniyor...' : 'Loading...'}</div>
                  ) : (
                    <>
                      <div>
                        <h3 className="m-0 text-lg text-slate-800">{ctr.barcode}</h3>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                          {getTypeBadge(ctr.container_type)}
                          {getStatusLabel(ctr)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-2 my-3 text-[0.8rem]">
                        {ctr.display_name && (
                          <div className="flex flex-col">
                            <span className="text-slate-400 text-[0.7rem] uppercase font-semibold">{t === 'tr' ? 'İsim' : 'Name'}</span>
                            <span className="text-slate-800 font-medium">{ctr.display_name}</span>
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="text-slate-400 text-[0.7rem] uppercase font-semibold">{t === 'tr' ? 'Depo' : 'Warehouse'}</span>
                          <span className="text-slate-800 font-medium">{ctr.warehouse_name || ctr.warehouse_code}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-slate-400 text-[0.7rem] uppercase font-semibold">{t === 'tr' ? 'Lokasyon' : 'Location'}</span>
                          <span className="text-slate-800 font-medium">{ctr.location_code || '-'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-slate-400 text-[0.7rem] uppercase font-semibold">{t === 'tr' ? 'Oluşturan' : 'Created By'}</span>
                          <span className="text-slate-800 font-medium">{ctr.created_by}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-slate-400 text-[0.7rem] uppercase font-semibold">{t === 'tr' ? 'Tarih' : 'Date'}</span>
                          <span className="text-slate-800 font-medium">{formatDate(ctr.created_at)}</span>
                        </div>
                        {ctr.notes && (
                          <div className="flex flex-col col-span-full">
                            <span className="text-slate-400 text-[0.7rem] uppercase font-semibold">{t === 'tr' ? 'Notlar' : 'Notes'}</span>
                            <span className="text-slate-800 font-medium">{ctr.notes}</span>
                          </div>
                        )}
                      </div>

                      {/* Contents */}
                      <div>
                        <h4 className="m-0 mb-2 text-[0.9rem] text-slate-600">{t === 'tr' ? 'İçerik' : 'Contents'} ({selectedDetail.contents.length})</h4>
                        {selectedDetail.contents.length === 0 ? (
                          <div className="text-center p-4 text-slate-400 text-sm">
                            {t === 'tr' ? 'Boş' : 'Empty'}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {selectedDetail.contents.map(item => (
                              <div key={item.content_id} className="flex items-center gap-2 px-2.5 py-2 bg-white rounded-lg border border-slate-200 text-[0.8rem]">
                                <div className="flex-1 min-w-0">
                                  <div className="font-mono text-[0.7rem] text-cyan-600 font-semibold">{item.product_sku}</div>
                                  <div className="text-xs text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">{item.product_name}</div>
                                </div>
                                <div className="font-bold text-slate-800 shrink-0">x{item.quantity}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Shipment Link */}
                      {ctr.status === 'ACTIVE' && (
                        <div className="mt-3 flex gap-2 items-center">
                          <select
                            value={linkShipmentId}
                            onChange={e => setLinkShipmentId(Number(e.target.value))}
                            className="flex-1 p-2 border-2 border-slate-200 rounded-lg text-[0.8rem] focus:outline-none focus:border-cyan-500"
                          >
                            <option value={0}>{t === 'tr' ? 'Sevkiyat yok' : 'No shipment'}</option>
                            {shipments.map(s => (
                              <option key={s.shipment_id} value={s.shipment_id}>
                                {s.prefix} ({s.warehouse_code})
                              </option>
                            ))}
                          </select>
                          <button className="px-3 py-2 bg-cyan-500 text-white border-none rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap hover:bg-cyan-600" onClick={handleLinkShipment}>
                            {t === 'tr' ? 'Bağla' : 'Link'}
                          </button>
                          {ctr.shipment_id && (
                            <button className="px-3 py-2 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-xs font-medium cursor-pointer hover:bg-slate-200" onClick={() => { setLinkShipmentId(0); handleLinkShipment(); }}>
                              {t === 'tr' ? 'Kaldır' : 'Unlink'}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      {ctr.status === 'ACTIVE' && (
                        <div className="flex gap-2 mt-4 max-sm:flex-col">
                          <button className="flex-1 px-3 py-2 border-none rounded-lg text-[0.8rem] font-semibold cursor-pointer bg-gradient-to-br from-amber-400 to-amber-600 text-white hover:opacity-90" onClick={handleOpenContainer}>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-[420px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="m-0 mb-5 text-slate-800 text-lg">{t === 'tr' ? 'Yeni Koli / Palet' : 'New Container'}</h3>
            <form onSubmit={handleCreate}>
              <div className="mb-4">
                <label className="block mb-1.5 font-medium text-slate-600 text-sm">{t === 'tr' ? 'Tip' : 'Type'} *</label>
                <select
                  value={newContainer.container_type}
                  onChange={e => setNewContainer(p => ({ ...p, container_type: e.target.value as 'BOX' | 'PALLET' }))}
                  className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg text-[0.9375rem] box-border focus:outline-none focus:border-cyan-500"
                >
                  <option value="BOX">{t === 'tr' ? 'Koli (BOX)' : 'Box'}</option>
                  <option value="PALLET">{t === 'tr' ? 'Palet (PALLET)' : 'Pallet'}</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block mb-1.5 font-medium text-slate-600 text-sm">{t === 'tr' ? 'İsim' : 'Name'} *</label>
                <input
                  type="text"
                  value={newContainer.display_name}
                  onChange={e => setNewContainer(p => ({ ...p, display_name: e.target.value }))}
                  placeholder={t === 'tr' ? 'FBA-BOX-01, NJ-PLT-045...' : 'FBA-BOX-01, NJ-PLT-045...'}
                  required
                  className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg text-[0.9375rem] box-border focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1.5 font-medium text-slate-600 text-sm">{t === 'tr' ? 'Sevkiyat (opsiyonel)' : 'Shipment (optional)'}</label>
                <select
                  value={newContainer.shipment_id}
                  onChange={e => setNewContainer(p => ({ ...p, shipment_id: Number(e.target.value) }))}
                  className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg text-[0.9375rem] box-border focus:outline-none focus:border-cyan-500"
                >
                  <option value={0}>{t === 'tr' ? 'Sevkiyat yok' : 'No shipment'}</option>
                  {shipments.map(s => (
                    <option key={s.shipment_id} value={s.shipment_id}>
                      {s.prefix} ({s.warehouse_code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block mb-1.5 font-medium text-slate-600 text-sm">{t === 'tr' ? 'Notlar' : 'Notes'}</label>
                <textarea
                  value={newContainer.notes}
                  onChange={e => setNewContainer(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg text-[0.9375rem] box-border focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="flex gap-3 mt-6 justify-end">
                <button type="button" className="px-4 py-2.5 bg-slate-100 text-slate-500 border-none rounded-lg font-medium cursor-pointer hover:bg-slate-200" onClick={() => setShowCreateModal(false)}>
                  {t === 'tr' ? 'Vazgeç' : 'Cancel'}
                </button>
                <button type="submit" className="px-4 py-2.5 bg-gradient-to-br from-cyan-500 to-cyan-600 text-white border-none rounded-lg font-medium cursor-pointer hover:opacity-90">
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
