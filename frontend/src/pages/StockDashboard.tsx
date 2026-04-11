import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsApi } from '../lib/api/analytics';
import { useStore } from '../stores/appStore';

interface WarehouseStock { [code: string]: number }
interface MarketplaceDepot { source: string; depot: string; fulfillable: number; reserved: number; unfulfillable: number; inbound: number }

interface UnifiedProduct {
  product_sku: string;
  product_name: string;
  category: string;
  physical: { warehouses: WarehouseStock; total: number };
  transit: number;
  reserved: number;
  available: number;
  marketplace: { depots: MarketplaceDepot[]; total_fulfillable: number };
  grand_total: number;
}

function StockDashboard() {
  const navigate = useNavigate();
  const { language } = useStore();
  const t = language === 'tr' ? 'tr' : 'en';

  const [data, setData] = useState<UnifiedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => { setSearchDebounce(search); setPage(1); }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadData();
  }, [searchDebounce, page]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await analyticsApi.getUnifiedStock({
        search: searchDebounce || undefined,
        page,
        limit: 50,
      });
      if (res.success) {
        setData(res.data || []);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotal(res.pagination?.total || 0);
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const numClass = (n: number) => n > 0 ? 'text-green-600' : 'text-slate-300';

  const exportData = () => {
    if (data.length === 0) return;
    import('../utils/exportXlsx').then(({ exportToXlsx }) => {
      exportToXlsx(
        data.map(p => ({
          SKU: p.product_sku,
          Product: p.product_name,
          Category: p.category,
          'Physical Total': p.physical.total,
          FACTORY: p.physical.warehouses['FACTORY'] || 0,
          TR: p.physical.warehouses['TR'] || 0,
          NJ: p.physical.warehouses['NJ'] || 0,
          NL: p.physical.warehouses['NL'] || 0,
          UK: p.physical.warehouses['UK'] || 0,
          Transit: p.transit,
          Reserved: p.reserved,
          Available: p.available,
          'FBA Total': p.marketplace.total_fulfillable,
          'Grand Total': p.grand_total,
        })),
        `unified-stock-${new Date().toISOString().slice(0, 10)}`,
        'Unified Stock',
      );
    });
  };

  const WH_CODES = ['FACTORY', 'TR', 'NJ', 'NL', 'UK'];

  const whColorMap: Record<string, string> = {
    factory: 'bg-amber-100 text-amber-700',
    tr: 'bg-blue-100 text-blue-700',
    nj: 'bg-green-100 text-green-700',
    nl: 'bg-violet-100 text-violet-700',
    uk: 'bg-pink-100 text-pink-700',
  };

  return (
    <div className="min-h-[calc(100vh-120px)] bg-slate-100 p-4">
      <div className="max-w-[1000px] mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-linear-to-br from-slate-900 to-slate-800 text-white px-5 py-5 flex items-center gap-3">
          <button
            className="bg-white/20 border-none text-white w-9 h-9 rounded-lg text-lg cursor-pointer flex items-center justify-center hover:bg-white/30"
            onClick={() => navigate('/')}
          >
            ←
          </button>
          <h2 className="m-0 text-white text-xl font-bold flex-1">
            {t === 'tr' ? 'Birleşik Stok Görünümü' : 'Unified Stock View'}
          </h2>
          <button
            className="px-4 py-2 bg-white/20 text-white border-2 border-white/30 rounded-lg font-semibold cursor-pointer text-[0.8rem] hover:bg-white/30"
            onClick={exportData}
            disabled={data.length === 0}
          >
            ↓ XLSX
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {error && (
            <div
              className="p-3 bg-red-100 text-red-600 rounded-lg mb-4 cursor-pointer"
              onClick={() => setError(null)}
            >
              {error}
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <input
              type="text"
              className="flex-1 min-w-[150px] px-3 py-2 border-2 border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-500"
              placeholder={t === 'tr' ? 'SKU veya ürün adı ara...' : 'Search SKU or product name...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span className="text-[0.8rem] text-slate-500 self-center">
              {total.toLocaleString()} {t === 'tr' ? 'ürün' : 'products'}
            </span>
          </div>

          {loading ? (
            <div className="text-center p-8 text-slate-500">
              {t === 'tr' ? 'Yükleniyor...' : 'Loading...'}
            </div>
          ) : data.length === 0 ? (
            <div className="text-center p-8 text-slate-400">
              {t === 'tr' ? 'Ürün bulunamadı' : 'No products found'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[0.8rem] md:text-[0.8rem] max-md:text-[0.7rem]">
                  <thead>
                    <tr>
                      <th className="bg-slate-50 px-2.5 py-2 text-left text-[0.7rem] font-bold text-slate-500 uppercase border-b-2 border-slate-200 whitespace-nowrap">
                        {t === 'tr' ? 'Ürün' : 'Product'}
                      </th>
                      <th className="bg-slate-50 px-2.5 py-2 text-right text-[0.7rem] font-bold text-slate-500 uppercase border-b-2 border-slate-200 whitespace-nowrap">
                        {t === 'tr' ? 'Fiziksel' : 'Physical'}
                      </th>
                      <th className="bg-slate-50 px-2.5 py-2 text-right text-[0.7rem] font-bold text-slate-500 uppercase border-b-2 border-slate-200 whitespace-nowrap">
                        {t === 'tr' ? 'Transit' : 'Transit'}
                      </th>
                      <th className="bg-slate-50 px-2.5 py-2 text-right text-[0.7rem] font-bold text-slate-500 uppercase border-b-2 border-slate-200 whitespace-nowrap">
                        {t === 'tr' ? 'Rezerve' : 'Reserved'}
                      </th>
                      <th className="bg-slate-50 px-2.5 py-2 text-right text-[0.7rem] font-bold text-slate-500 uppercase border-b-2 border-slate-200 whitespace-nowrap">
                        {t === 'tr' ? 'Kullanılabilir' : 'Available'}
                      </th>
                      <th className="bg-slate-50 px-2.5 py-2 text-right text-[0.7rem] font-bold text-slate-500 uppercase border-b-2 border-slate-200 whitespace-nowrap">
                        Marketplace
                      </th>
                      <th className="bg-slate-50 px-2.5 py-2 text-right text-[0.7rem] font-bold text-slate-500 uppercase border-b-2 border-slate-200 whitespace-nowrap">
                        {t === 'tr' ? 'Toplam' : 'Total'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map(p => (
                      <tr key={p.product_sku} className="hover:bg-slate-50">
                        <td className="px-2.5 py-2 border-b border-slate-100 align-top max-md:px-1.5">
                          <div className="font-mono font-bold text-slate-800 text-xs">{p.product_sku}</div>
                          <div className="text-[0.7rem] text-slate-500 max-w-[200px] max-md:max-w-[120px] whitespace-nowrap overflow-hidden text-ellipsis" title={p.product_name}>
                            {p.product_name}
                          </div>
                          {p.category && (
                            <span className="text-[0.6rem] text-slate-400 bg-slate-100 px-1 py-0.5 rounded-sm">
                              {p.category}
                            </span>
                          )}
                        </td>
                        <td className="px-2.5 py-2 border-b border-slate-100 align-top max-md:px-1.5">
                          <div className={`font-bold font-mono text-right ${numClass(p.physical.total)}`}>
                            {p.physical.total}
                          </div>
                          <div className="flex flex-wrap gap-0.5 justify-end">
                            {WH_CODES.map(wh => {
                              const qty = p.physical.warehouses[wh];
                              if (!qty) return null;
                              return (
                                <span
                                  key={wh}
                                  className={`text-[0.55rem] px-1 py-0.5 rounded-sm font-bold ${whColorMap[wh.toLowerCase()] || 'bg-slate-100 text-slate-600'}`}
                                >
                                  {wh} {qty}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-2.5 py-2 border-b border-slate-100 align-top max-md:px-1.5">
                          <div className={`font-bold font-mono text-right ${numClass(p.transit)}`}>{p.transit}</div>
                        </td>
                        <td className="px-2.5 py-2 border-b border-slate-100 align-top max-md:px-1.5">
                          <div className={`font-bold font-mono text-right ${p.reserved > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
                            {p.reserved}
                          </div>
                        </td>
                        <td className="px-2.5 py-2 border-b border-slate-100 align-top max-md:px-1.5">
                          <div className={`font-bold font-mono text-right ${numClass(p.available)}`}>{p.available}</div>
                        </td>
                        <td className="px-2.5 py-2 border-b border-slate-100 align-top max-md:px-1.5">
                          <div className={`font-bold font-mono text-right ${numClass(p.marketplace.total_fulfillable)}`}>
                            {p.marketplace.total_fulfillable}
                          </div>
                          {p.marketplace.depots.length > 0 && (
                            <div className="flex flex-wrap gap-0.5 justify-end">
                              {p.marketplace.depots.map((d, i) => (
                                <span key={i} className="text-[0.55rem] px-1 py-0.5 rounded-sm font-semibold bg-amber-100 text-amber-800">
                                  {d.depot} {d.fulfillable}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-2.5 py-2 border-b border-slate-100 align-top max-md:px-1.5">
                          <div className={`font-bold font-mono text-right text-[0.9rem] ${p.grand_total > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                            {p.grand_total}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex justify-center items-center gap-2 mt-4 p-2">
                <button
                  className="px-3 py-1.5 border border-slate-200 rounded-md bg-white cursor-pointer text-[0.8rem] disabled:opacity-40 disabled:cursor-default hover:enabled:bg-slate-100"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                >
                  ⏮
                </button>
                <button
                  className="px-3 py-1.5 border border-slate-200 rounded-md bg-white cursor-pointer text-[0.8rem] disabled:opacity-40 disabled:cursor-default hover:enabled:bg-slate-100"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  ←
                </button>
                <span className="text-[0.8rem] text-slate-500">{page} / {totalPages}</span>
                <button
                  className="px-3 py-1.5 border border-slate-200 rounded-md bg-white cursor-pointer text-[0.8rem] disabled:opacity-40 disabled:cursor-default hover:enabled:bg-slate-100"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  →
                </button>
                <button
                  className="px-3 py-1.5 border border-slate-200 rounded-md bg-white cursor-pointer text-[0.8rem] disabled:opacity-40 disabled:cursor-default hover:enabled:bg-slate-100"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                >
                  ⏭
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default StockDashboard;
