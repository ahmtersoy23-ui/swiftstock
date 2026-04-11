import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { shipmentApi, apiClient } from '../lib/api';
import { useStore } from '../stores/appStore';
import { useSSOStore } from '../stores/ssoStore';
import { Modal, ModalHeader, ModalBody } from '../shared/components/Modal';
import type { VirtualShipment, ShipmentBox, Warehouse } from '../types';

// Shipment Rules:
// FACTORY -> Cannot create virtual shipment (must enter TR first)
// UK, NL  -> Final destination, no outbound
// TR      -> NJ / NL / UK (depot transfer) + USA / FBA (marketplace)
// NJ      -> USA / FBA (marketplace) only

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

const STATUS_BADGE_CLASSES: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-600',
  CLOSED: 'bg-slate-100 text-slate-500',
  SHIPPED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

const DEST_COUNT_CLASSES: Record<string, string> = {
  usa: 'bg-blue-100 text-blue-700',
  fba: 'bg-amber-100 text-amber-700',
  nj: 'bg-green-100 text-green-700',
  nl: 'bg-violet-100 text-violet-700',
  uk: 'bg-pink-100 text-pink-700',
};

const DEST_BADGE_CLASSES: Record<string, string> = {
  usa: 'bg-blue-500 text-white',
  fba: 'bg-amber-500 text-white',
  nj: 'bg-emerald-500 text-white',
  nl: 'bg-violet-500 text-white',
  uk: 'bg-pink-500 text-white',
};

const WH_TAG_CLASSES: Record<string, string> = {
  tr: 'bg-blue-100 text-blue-700',
  nj: 'bg-green-100 text-green-700',
  nl: 'bg-violet-100 text-violet-700',
  uk: 'bg-pink-100 text-pink-700',
  factory: 'bg-amber-100 text-amber-700',
};

const ROUTE_DEST_CLASSES: Record<string, string> = {
  usa: 'text-blue-700',
  fba: 'text-amber-700',
  nj: 'text-green-700',
  nl: 'text-violet-700',
  uk: 'text-pink-700',
};

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
        setSuccess(language === 'tr' ? 'Sevkiyat olusturuldu' : 'Shipment created');
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
            ? `Koli olusturuldu: ${response.data.barcode}`
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
        ? 'Sevkiyati kapatmak istediginize emin misiniz?'
        : 'Are you sure you want to close this shipment?'
    )) return;

    try {
      const response = await shipmentApi.close(shipment.shipment_id);
      if (response.success) {
        setSuccess(language === 'tr' ? 'Sevkiyat kapatildi' : 'Shipment closed');
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
        ? 'Sevkiyati gonderildi olarak isaretlemek istediginize emin misiniz?'
        : 'Are you sure you want to mark this shipment as shipped?'
    )) return;

    try {
      const response = await shipmentApi.ship(shipment.shipment_id);
      if (response.success) {
        setSuccess(language === 'tr' ? 'Sevkiyat gonderildi' : 'Shipment marked as shipped');
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
    const labels: Record<string, string> = {
      OPEN:      language === 'tr' ? 'Acik'       : 'Open',
      CLOSED:    language === 'tr' ? 'Kapali'     : 'Closed',
      SHIPPED:   language === 'tr' ? 'Gonderildi' : 'Shipped',
      CANCELLED: language === 'tr' ? 'Iptal'      : 'Cancelled',
    };
    return <span className={`inline-block px-2 py-1 rounded-full text-[0.65rem] font-semibold uppercase ${STATUS_BADGE_CLASSES[status] || ''}`}>{labels[status] || status}</span>;
  };

  const getDestinationBadge = (destination: string) => (
    <span className={`inline-block px-2 py-1 rounded text-[0.7rem] font-bold ${DEST_BADGE_CLASSES[destination.toLowerCase()] || ''}`}>{destination}</span>
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
    <div className="min-h-[calc(100vh-120px)] bg-slate-100 p-4">
      <div className="max-w-[800px] mx-auto bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-5 flex items-center gap-3 max-sm:flex-wrap">
          <button className="bg-white/20 border-none text-white w-9 h-9 rounded-lg text-lg cursor-pointer flex items-center justify-center duration-200 hover:bg-white/30" onClick={() => navigate('/')}>←</button>
          <h2 className="m-0 text-white text-xl font-bold flex-1 leading-9 h-9 flex items-center">{language === 'tr' ? 'Sevkiyat' : 'Shipments'}</h2>
          <button className="py-2 px-4 bg-white/20 text-white border-2 border-white/30 rounded-lg font-semibold cursor-pointer duration-200 text-sm hover:bg-white/30 hover:border-white/50" onClick={() => setShowCreateModal(true)}>
            + {language === 'tr' ? 'Yeni' : 'New'}
          </button>
        </div>

        <div className="p-4">
          {success && <div className="py-3 px-4 bg-green-100 text-green-600 rounded-lg mb-4 font-medium">{success}</div>}
          {error && <div className="py-3 px-4 bg-red-100 text-red-600 rounded-lg mb-4 font-medium">{error}</div>}

          <div className="mb-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 px-4 border-2 border-slate-200 rounded-lg text-sm bg-white cursor-pointer focus:outline-none focus:border-blue-500"
            >
              <option value="">{language === 'tr' ? 'Tum Durumlar' : 'All Statuses'}</option>
              <option value="OPEN">{language === 'tr' ? 'Acik' : 'Open'}</option>
              <option value="CLOSED">{language === 'tr' ? 'Kapali' : 'Closed'}</option>
              <option value="SHIPPED">{language === 'tr' ? 'Gonderildi' : 'Shipped'}</option>
            </select>
          </div>

          {loading ? (
            <div className="text-center p-8 text-slate-500">{language === 'tr' ? 'Yukleniyor...' : 'Loading...'}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Shipment List */}
              <div>
                <h3 className="m-0 mb-4 text-base text-slate-800">{language === 'tr' ? 'Sevkiyatlar' : 'Shipments'} ({shipments.length})</h3>
                {shipments.length === 0 ? (
                  <div className="text-center p-8 text-slate-400 text-sm">
                    {language === 'tr' ? 'Sevkiyat bulunamadi' : 'No shipments found'}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {shipments.map((shipment) => {
                      const breakdown = getBoxBreakdown(shipment);
                      const totalBoxes = breakdown.reduce((s, x) => s + x.count, 0);
                      return (
                        <div
                          key={shipment.shipment_id}
                          className={`p-4 bg-slate-50 border-2 border-slate-200 rounded-xl cursor-pointer duration-200 hover:border-blue-500 hover:bg-blue-50 ${selectedShipment?.shipment_id === shipment.shipment_id ? 'border-blue-500 bg-blue-50 shadow-[0_0_0_3px_rgba(59,130,246,0.1)]' : ''}`}
                          onClick={() => handleSelectShipment(shipment)}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-lg font-bold text-slate-800 font-mono">{shipment.prefix}</span>
                            {getStatusBadge(shipment.status)}
                          </div>

                          {shipment.warehouse_name && (
                            <div className="text-[0.8rem] text-slate-500 mb-2">
                              <span className="text-slate-400">
                                {language === 'tr' ? 'Kaynak' : 'From'}:
                              </span>{' '}
                              <span className="text-slate-600">
                                {shipment.warehouse_name}{' '}
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[0.65rem] font-bold uppercase ${WH_TAG_CLASSES[(shipment.warehouse_code || '').toLowerCase()] || ''}`}>
                                  {shipment.warehouse_code}
                                </span>
                              </span>
                            </div>
                          )}

                          <div className="text-xs text-slate-400">
                            <span>{totalBoxes} {language === 'tr' ? 'koli' : 'box'}</span>
                          </div>

                          {breakdown.length > 0 && (
                            <div className="flex gap-2 mt-2">
                              {breakdown.map(({ dest, count }) => (
                                <span key={dest} className={`text-[0.7rem] py-1 px-2 rounded font-semibold ${DEST_COUNT_CLASSES[dest.toLowerCase()] || ''}`}>
                                  {dest}: {count}
                                </span>
                              ))}
                            </div>
                          )}

                          {shipment.status === 'OPEN' && (
                            <div className="mt-3 flex gap-2">
                              <button
                                className="flex-1 py-2 bg-slate-100 border border-slate-200 rounded-md text-xs font-medium text-slate-500 cursor-pointer duration-200 hover:bg-slate-200"
                                onClick={(e) => { e.stopPropagation(); handleCloseShipment(shipment); }}
                              >
                                {language === 'tr' ? 'Kapat' : 'Close'}
                              </button>
                            </div>
                          )}
                          {shipment.status === 'CLOSED' && (
                            <div className="mt-3 flex gap-2">
                              <button
                                className="flex-1 py-2 bg-gradient-to-br from-emerald-500 to-emerald-600 border-none rounded-md text-xs font-semibold text-white cursor-pointer duration-200 hover:opacity-90"
                                onClick={(e) => { e.stopPropagation(); handleShipShipment(shipment); }}
                              >
                                {language === 'tr' ? 'Gonder' : 'Ship'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Boxes Panel */}
              {selectedShipment && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex justify-between items-center flex-wrap gap-2 mb-4">
                    <div>
                      <h3 className="m-0 mb-0 text-base text-slate-800">{selectedShipment.prefix}</h3>
                      <div className="text-xs text-slate-500 mt-1 flex items-center flex-wrap gap-1">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[0.65rem] font-bold uppercase ${WH_TAG_CLASSES[(selectedShipment.warehouse_code || '').toLowerCase()] || ''}`}>
                          {selectedShipment.warehouse_code}
                        </span>
                        {availableDests.length > 0 && (
                          <>
                            {' → '}
                            {availableDests.map((d, i) => (
                              <span key={d}>
                                {i > 0 && ' / '}
                                <span className={`font-bold text-[0.7rem] ${ROUTE_DEST_CLASSES[d.toLowerCase()] || ''}`}>{d}</span>
                              </span>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                    {selectedShipment.status === 'OPEN' && availableDests.length > 0 && (
                      <div className="flex gap-2 items-center">
                        <select
                          value={newBoxDestination}
                          onChange={(e) => setNewBoxDestination(e.target.value)}
                          className="py-1.5 px-2 border-2 border-slate-200 rounded-md text-[0.8rem] bg-white cursor-pointer min-w-[130px] focus:outline-none focus:border-blue-500"
                        >
                          {availableDests.map(dest => (
                            <option key={dest} value={dest}>
                              {language === 'tr' ? DEST_INFO[dest]?.label_tr : DEST_INFO[dest]?.label_en}
                            </option>
                          ))}
                        </select>
                        <button className="py-1.5 px-3 bg-blue-500 border-none rounded-md text-[0.8rem] font-semibold text-white cursor-pointer duration-200 whitespace-nowrap hover:bg-blue-600" onClick={handleCreateBox}>
                          + {language === 'tr' ? 'Koli' : 'Box'}
                        </button>
                      </div>
                    )}
                  </div>

                  {boxes.length === 0 ? (
                    <div className="text-center p-8 text-slate-400 text-sm">{language === 'tr' ? 'Henuz koli yok' : 'No boxes yet'}</div>
                  ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 max-sm:grid-cols-2">
                      {boxes.map((box) => (
                        <div key={box.box_id} className={`bg-white border-2 rounded-[10px] p-3 duration-200 ${box.status === 'OPEN' ? 'border-emerald-500' : box.status === 'SHIPPED' ? 'border-blue-500 opacity-70' : 'border-slate-500 opacity-80'}`}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-semibold font-mono text-slate-800">{box.barcode}</span>
                            {getDestinationBadge(box.destination)}
                          </div>
                          <div className="text-[0.7rem] text-slate-500 flex justify-between">
                            <span>{box.contents?.length ?? 0} {language === 'tr' ? 'urun' : 'items'}</span>
                          </div>
                          {box.status === 'OPEN' && selectedShipment.status === 'OPEN' && (
                            <div className="mt-2">
                              <select
                                value={box.destination}
                                onChange={(e) => handleUpdateBoxDestination(box, e.target.value)}
                                className="w-full py-1.5 px-2 border border-slate-200 rounded text-xs bg-white cursor-pointer"
                              >
                                {availableDests.map(dest => (
                                  <option key={dest} value={dest}>{dest}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          {box.contents && box.contents.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-dashed border-slate-200">
                              {box.contents.map((content) => (
                                <div key={content.content_id} className="flex justify-between text-[0.7rem] text-slate-500 py-0.5">
                                  <span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1 mr-2">{content.product_name || content.sku_code}</span>
                                  <span className="font-semibold text-slate-800">x{content.quantity}</span>
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
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} size="md">
        <ModalHeader onClose={() => setShowCreateModal(false)}>{language === 'tr' ? 'Yeni Sevkiyat' : 'New Shipment'}</ModalHeader>
        <ModalBody>

            {outboundWarehouses.length === 0 ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg py-2.5 px-3.5 text-[0.8rem] text-blue-700 mb-4 leading-relaxed">
                {language === 'tr'
                  ? 'Sevkiyat baslatilabilecek depo bulunamadi. TR veya NJ deposu gereklidir.'
                  : 'No outbound warehouse found. TR or NJ warehouse is required.'}
              </div>
            ) : (
              <form onSubmit={handleCreateShipment}>
                <div className="bg-blue-50 border border-blue-200 rounded-lg py-2.5 px-3.5 text-[0.8rem] text-blue-700 mb-4 leading-relaxed">
                  <strong>TR</strong> → NJ / NL / UK / ABD Pazar / FBA<br />
                  <strong>NJ</strong> → ABD Pazar / FBA
                </div>
                <div className="mb-4">
                  <label className="block mb-1.5 font-medium text-slate-600 text-sm">{language === 'tr' ? 'Prefix (Koli On Eki)' : 'Prefix (Box Barcode Prefix)'} *</label>
                  <input
                    type="text"
                    value={newShipment.prefix}
                    onChange={(e) => setNewShipment({ ...newShipment, prefix: e.target.value.toUpperCase() })}
                    placeholder="IST, NYC, LA..."
                    required
                    maxLength={20}
                    className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-[0.9375rem] duration-200 box-border focus:outline-none focus:border-blue-500"
                  />
                  <small className="block mt-1 text-xs text-slate-400">
                    {language === 'tr'
                      ? 'Orn: IST → Koliler: IST-00001, IST-00002...'
                      : 'Ex: IST → Boxes: IST-00001, IST-00002...'}
                  </small>
                </div>
                <div className="mb-4">
                  <label className="block mb-1.5 font-medium text-slate-600 text-sm">{language === 'tr' ? 'Kaynak Depo' : 'Source Warehouse'} *</label>
                  <select
                    value={newShipment.warehouse_id}
                    onChange={(e) => setNewShipment({ ...newShipment, warehouse_id: Number(e.target.value) })}
                    required
                    className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-[0.9375rem] duration-200 box-border focus:outline-none focus:border-blue-500"
                  >
                    {outboundWarehouses.map((w) => (
                      <option key={w.warehouse_id} value={w.warehouse_id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block mb-1.5 font-medium text-slate-600 text-sm">{language === 'tr' ? 'Notlar' : 'Notes'}</label>
                  <textarea
                    value={newShipment.notes}
                    onChange={(e) => setNewShipment({ ...newShipment, notes: e.target.value })}
                    rows={2}
                    className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-[0.9375rem] duration-200 box-border resize-y min-h-[60px] focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex gap-3 mt-6 justify-end">
                  <button type="button" className="py-2.5 px-4 bg-slate-100 text-slate-500 border-none rounded-lg font-medium cursor-pointer duration-200 hover:bg-slate-200" onClick={() => setShowCreateModal(false)}>
                    {language === 'tr' ? 'Iptal' : 'Cancel'}
                  </button>
                  <button type="submit" className="py-2.5 px-4 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-none rounded-lg font-medium cursor-pointer duration-200 hover:opacity-90">
                    {language === 'tr' ? 'Olustur' : 'Create'}
                  </button>
                </div>
              </form>
            )}
        </ModalBody>
      </Modal>
    </div>
  );
}

export default Shipments;
