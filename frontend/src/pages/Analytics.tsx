import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsApi } from '../lib/api/analytics';
import { useStore } from '../stores/appStore';
import './Analytics.css';

type Tab = 'dead-stock' | 'turnover' | 'performance' | 'slotting' | 'replenishment';

function Analytics() {
  const navigate = useNavigate();
  const { language, selectedWarehouse } = useStore();
  const tr = language === 'tr';

  const [tab, setTab] = useState<Tab>('dead-stock');
  const [data, setData] = useState<unknown[]>([]);
  const [perfData, setPerfData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(30);
  const [minThreshold, setMinThreshold] = useState(5);
  const whCode = selectedWarehouse || 'TR';

  const loadTab = useCallback(async () => {
    setLoading(true);
    try {
      switch (tab) {
        case 'dead-stock': {
          const res = await analyticsApi.getDeadStock({ days, warehouse_code: whCode });
          setData(res.success ? res.data : []);
          break;
        }
        case 'turnover': {
          const res = await analyticsApi.getTurnover({ days, warehouse_code: whCode });
          setData(res.success ? res.data : []);
          break;
        }
        case 'performance': {
          const res = await analyticsApi.getPerformance({ days, warehouse_code: whCode });
          if (res.success) setPerfData(res.data);
          break;
        }
        case 'slotting': {
          const res = await analyticsApi.getSlotting(whCode, days);
          setData(res.success ? res.data : []);
          break;
        }
        case 'replenishment': {
          const res = await analyticsApi.getReplenishment(whCode, minThreshold);
          setData(res.success ? res.data : []);
          break;
        }
      }
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [tab, days, whCode, minThreshold]);

  useEffect(() => { loadTab(); }, [loadTab]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dead-stock', label: tr ? 'Hareketsiz Stok' : 'Dead Stock' },
    { key: 'turnover', label: tr ? 'Stok Devir / DOS' : 'Turnover / DOS' },
    { key: 'performance', label: tr ? 'Performans' : 'Performance' },
    { key: 'slotting', label: tr ? 'Slotting' : 'Slotting' },
    { key: 'replenishment', label: tr ? 'Yenileme' : 'Replenishment' },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perf = perfData as any;

  return (
    <div className="analytics-page">
      <div className="analytics-card">
        <div className="analytics-header">
          <button className="back-btn" onClick={() => navigate('/')}>←</button>
          <h2>{tr ? 'Analitik & Zeka' : 'Analytics & Intelligence'}</h2>
        </div>

        <div className="analytics-tabs">
          {tabs.map(t => (
            <button
              key={t.key}
              className={`tab-btn ${tab === t.key ? 'active' : ''}`}
              onClick={() => { setTab(t.key); setData([]); setPerfData(null); }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="analytics-filters">
          {tab !== 'replenishment' && (
            <select value={days} onChange={e => setDays(Number(e.target.value))}>
              <option value={7}>7 {tr ? 'gün' : 'days'}</option>
              <option value={14}>14 {tr ? 'gün' : 'days'}</option>
              <option value={30}>30 {tr ? 'gün' : 'days'}</option>
              <option value={60}>60 {tr ? 'gün' : 'days'}</option>
              <option value={90}>90 {tr ? 'gün' : 'days'}</option>
              <option value={180}>180 {tr ? 'gün' : 'days'}</option>
            </select>
          )}
          {tab === 'replenishment' && (
            <select value={minThreshold} onChange={e => setMinThreshold(Number(e.target.value))}>
              <option value={3}>Min: 3</option>
              <option value={5}>Min: 5</option>
              <option value={10}>Min: 10</option>
              <option value={20}>Min: 20</option>
            </select>
          )}
          <span className="wh-label">{whCode}</span>
        </div>

        <div className="analytics-content">
          {loading ? (
            <div className="loading">{tr ? 'Yükleniyor...' : 'Loading...'}</div>
          ) : (
            <>
              {/* DEAD STOCK */}
              {tab === 'dead-stock' && (
                d.length === 0 ? <div className="empty">{tr ? 'Hareketsiz ürün yok' : 'No dead stock'}</div> : (
                  <table className="an-table">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>{tr ? 'Ürün' : 'Product'}</th>
                        <th style={{ textAlign: 'right' }}>{tr ? 'Adet' : 'Qty'}</th>
                        <th style={{ textAlign: 'right' }}>{tr ? 'Boşta Gün' : 'Days Idle'}</th>
                        <th>{tr ? 'Son Hareket' : 'Last Move'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.map((r, i) => (
                        <tr key={i}>
                          <td className="mono">{r.product_sku}</td>
                          <td>{r.product_name}</td>
                          <td style={{ textAlign: 'right' }}>{r.quantity}</td>
                          <td style={{ textAlign: 'right' }}>
                            <span className={`badge ${r.days_idle > 180 ? 'danger' : r.days_idle > 90 ? 'warning' : 'info'}`}>
                              {r.days_idle ?? '∞'}
                            </span>
                          </td>
                          <td>{r.last_movement ? new Date(r.last_movement).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {/* TURNOVER / DOS */}
              {tab === 'turnover' && (
                d.length === 0 ? <div className="empty">{tr ? 'Veri yok' : 'No data'}</div> : (
                  <table className="an-table">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>{tr ? 'Ürün' : 'Product'}</th>
                        <th style={{ textAlign: 'right' }}>{tr ? 'Stok' : 'Stock'}</th>
                        <th style={{ textAlign: 'right' }}>{tr ? 'Çıkış' : 'Out'}</th>
                        <th style={{ textAlign: 'right' }}>{tr ? 'Gün/Ort' : 'Avg/Day'}</th>
                        <th style={{ textAlign: 'right' }}>DOS</th>
                        <th style={{ textAlign: 'right' }}>{tr ? 'Devir' : 'Turnover'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.map((r, i) => (
                        <tr key={i}>
                          <td className="mono">{r.product_sku}</td>
                          <td>{r.product_name}</td>
                          <td style={{ textAlign: 'right' }}>{r.current_stock}</td>
                          <td style={{ textAlign: 'right' }}>{r.total_out_period}</td>
                          <td style={{ textAlign: 'right' }}>{r.avg_daily_out}</td>
                          <td style={{ textAlign: 'right' }}>
                            <span className={`badge ${Number(r.days_of_supply) > 365 ? 'danger' : Number(r.days_of_supply) > 90 ? 'warning' : 'success'}`}>
                              {r.days_of_supply >= 9999 ? '∞' : r.days_of_supply}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>{r.turnover_ratio}x</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {/* PERFORMANCE */}
              {tab === 'performance' && perf && (
                <div className="perf-grid">
                  <div className="perf-section">
                    <h3>{tr ? 'Hareket Hacmi' : 'Transaction Volume'}</h3>
                    <div className="perf-cards">
                      {(perf.volume || []).map((v: { transaction_type: string; count: number; total_items: number }, i: number) => (
                        <div key={i} className={`perf-card type-${v.transaction_type.toLowerCase()}`}>
                          <div className="perf-type">{v.transaction_type}</div>
                          <div className="perf-value">{v.count}</div>
                          <div className="perf-sub">{v.total_items} {tr ? 'ürün' : 'items'}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {perf.accuracy && (
                    <div className="perf-section">
                      <h3>{tr ? 'Sayım Doğruluğu' : 'Count Accuracy'}</h3>
                      <div className="perf-cards">
                        <div className="perf-card">
                          <div className="perf-type">{tr ? 'Oturumlar' : 'Sessions'}</div>
                          <div className="perf-value">{perf.accuracy.total_sessions}</div>
                        </div>
                        <div className="perf-card">
                          <div className="perf-type">{tr ? 'Doğruluk' : 'Accuracy'}</div>
                          <div className="perf-value">{perf.accuracy.avg_accuracy_pct || '—'}%</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {(perf.pickers || []).length > 0 && (
                    <div className="perf-section">
                      <h3>{tr ? 'Toplayıcı Performansı' : 'Picker Performance'}</h3>
                      <table className="an-table">
                        <thead>
                          <tr>
                            <th>{tr ? 'Toplayıcı' : 'Picker'}</th>
                            <th style={{ textAlign: 'right' }}>{tr ? 'Sipariş' : 'Orders'}</th>
                            <th style={{ textAlign: 'right' }}>{tr ? 'Ort. dk' : 'Avg min'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(perf.pickers || []).map((p: { username: string; full_name: string; orders_picked: number; avg_pick_minutes: string }, i: number) => (
                            <tr key={i}>
                              <td>{p.full_name || p.username}</td>
                              <td style={{ textAlign: 'right' }}>{p.orders_picked}</td>
                              <td style={{ textAlign: 'right' }}>{p.avg_pick_minutes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {(perf.trend || []).length > 0 && (
                    <div className="perf-section">
                      <h3>{tr ? 'Günlük Trend' : 'Daily Trend'}</h3>
                      <div className="trend-chart">
                        {(perf.trend || []).slice(-14).map((t: { date: string; in_count: number; out_count: number; transfer_count: number }, i: number) => {
                          const max = Math.max(1, ...perf.trend.slice(-14).map((x: { in_count: number; out_count: number; transfer_count: number }) => x.in_count + x.out_count + x.transfer_count));
                          const total = t.in_count + t.out_count + t.transfer_count;
                          const pct = (total / max) * 100;
                          return (
                            <div key={i} className="trend-bar-wrap" title={`${t.date}: IN ${t.in_count} / OUT ${t.out_count} / TR ${t.transfer_count}`}>
                              <div className="trend-bar" style={{ height: `${Math.max(2, pct)}%` }}>
                                <div className="bar-in" style={{ height: `${total ? (t.in_count / total) * 100 : 0}%` }} />
                                <div className="bar-out" style={{ height: `${total ? (t.out_count / total) * 100 : 0}%` }} />
                                <div className="bar-tr" style={{ height: `${total ? (t.transfer_count / total) * 100 : 0}%` }} />
                              </div>
                              <div className="trend-label">{new Date(t.date).getDate()}</div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="trend-legend">
                        <span className="legend-in">IN</span>
                        <span className="legend-out">OUT</span>
                        <span className="legend-tr">TRANSFER</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SLOTTING */}
              {tab === 'slotting' && (
                d.length === 0 ? <div className="empty">{tr ? 'Öneri yok' : 'No suggestions'}</div> : (
                  <table className="an-table">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>{tr ? 'Ürün' : 'Product'}</th>
                        <th style={{ textAlign: 'right' }}>{tr ? 'Hareket' : 'Moves'}</th>
                        <th>{tr ? 'Mevcut Lok.' : 'Current Loc'}</th>
                        <th>{tr ? 'Öneri' : 'Suggestion'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.map((r, i) => (
                        <tr key={i}>
                          <td className="mono">{r.product_sku}</td>
                          <td>{r.product_name}</td>
                          <td style={{ textAlign: 'right' }}>{r.movement_count}</td>
                          <td>{r.current_location || '—'}</td>
                          <td>
                            <span className={`badge ${r.recommendation === 'MOVE_TO_PRIME' ? 'warning' : r.recommendation === 'OPTIMAL' ? 'success' : 'info'}`}>
                              {r.recommendation}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {/* REPLENISHMENT */}
              {tab === 'replenishment' && (
                d.length === 0 ? <div className="empty">{tr ? 'Yenileme gerekmiyor' : 'No replenishment needed'}</div> : (
                  <table className="an-table">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>{tr ? 'Ürün' : 'Product'}</th>
                        <th style={{ textAlign: 'right' }}>{tr ? 'Stok' : 'Stock'}</th>
                        <th style={{ textAlign: 'right' }}>Min</th>
                        <th>{tr ? 'Durum' : 'Status'}</th>
                        <th style={{ textAlign: 'right' }}>{tr ? 'Gerekli' : 'Needed'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.map((r, i) => (
                        <tr key={i}>
                          <td className="mono">{r.product_sku}</td>
                          <td>{r.product_name}</td>
                          <td style={{ textAlign: 'right' }}>{r.current_stock}</td>
                          <td style={{ textAlign: 'right' }}>{r.min_threshold}</td>
                          <td>
                            <span className={`badge ${r.status === 'OUT_OF_STOCK' ? 'danger' : 'warning'}`}>
                              {r.status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>{Math.max(0, r.replenish_quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Analytics;
