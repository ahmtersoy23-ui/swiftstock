import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsApi } from '../lib/api/analytics';
import { useStore } from '../stores/appStore';
import './StockDashboard.css';

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

  const numClass = (n: number) => n > 0 ? 'positive' : 'zero';

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

  return (
    <div className="stock-dashboard-page">
      <div className="stock-dashboard-card">
        <div className="stock-dashboard-header">
          <button className="back-btn" onClick={() => navigate('/')}>←</button>
          <h2>{t === 'tr' ? 'Birleşik Stok Görünümü' : 'Unified Stock View'}</h2>
          <button className="add-btn" onClick={exportData} disabled={data.length === 0}>
            ↓ XLSX
          </button>
        </div>

        <div className="stock-dashboard-content">
          {error && <div className="error-message" onClick={() => setError(null)}>{error}</div>}

          <div className="sd-filters">
            <input
              type="text"
              placeholder={t === 'tr' ? 'SKU veya ürün adı ara...' : 'Search SKU or product name...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span style={{ fontSize: '0.8rem', color: '#64748b', alignSelf: 'center' }}>
              {total.toLocaleString()} {t === 'tr' ? 'ürün' : 'products'}
            </span>
          </div>

          {loading ? (
            <div className="loading">{t === 'tr' ? 'Yükleniyor...' : 'Loading...'}</div>
          ) : data.length === 0 ? (
            <div className="empty-state">{t === 'tr' ? 'Ürün bulunamadı' : 'No products found'}</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table className="sd-table">
                  <thead>
                    <tr>
                      <th>{t === 'tr' ? 'Ürün' : 'Product'}</th>
                      <th style={{ textAlign: 'right' }}>{t === 'tr' ? 'Fiziksel' : 'Physical'}</th>
                      <th style={{ textAlign: 'right' }}>{t === 'tr' ? 'Transit' : 'Transit'}</th>
                      <th style={{ textAlign: 'right' }}>{t === 'tr' ? 'Rezerve' : 'Reserved'}</th>
                      <th style={{ textAlign: 'right' }}>{t === 'tr' ? 'Kullanılabilir' : 'Available'}</th>
                      <th style={{ textAlign: 'right' }}>Marketplace</th>
                      <th style={{ textAlign: 'right' }}>{t === 'tr' ? 'Toplam' : 'Total'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map(p => (
                      <tr key={p.product_sku}>
                        <td>
                          <div className="sd-sku">{p.product_sku}</div>
                          <div className="sd-name" title={p.product_name}>{p.product_name}</div>
                          {p.category && <span className="sd-category">{p.category}</span>}
                        </td>
                        <td>
                          <div className={`sd-num ${numClass(p.physical.total)}`}>{p.physical.total}</div>
                          <div className="sd-wh-list">
                            {WH_CODES.map(wh => {
                              const qty = p.physical.warehouses[wh];
                              if (!qty) return null;
                              return <span key={wh} className={`sd-wh-badge wh-${wh.toLowerCase()}`}>{wh} {qty}</span>;
                            })}
                          </div>
                        </td>
                        <td><div className={`sd-num ${numClass(p.transit)}`}>{p.transit}</div></td>
                        <td><div className={`sd-num ${p.reserved > 0 ? 'warning' : 'zero'}`}>{p.reserved}</div></td>
                        <td><div className={`sd-num ${numClass(p.available)}`}>{p.available}</div></td>
                        <td>
                          <div className={`sd-num ${numClass(p.marketplace.total_fulfillable)}`}>
                            {p.marketplace.total_fulfillable}
                          </div>
                          {p.marketplace.depots.length > 0 && (
                            <div className="sd-mp-list">
                              {p.marketplace.depots.map((d, i) => (
                                <span key={i} className={`sd-mp-badge mp-${d.source.toLowerCase()}`}>{d.depot} {d.fulfillable}</span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td><div className={`sd-num grand ${numClass(p.grand_total)}`}>{p.grand_total}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="sd-pagination">
                <button onClick={() => setPage(1)} disabled={page === 1}>⏮</button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>←</button>
                <span>{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>→</button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages}>⏭</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default StockDashboard;
