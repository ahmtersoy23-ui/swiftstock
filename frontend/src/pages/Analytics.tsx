import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsApi } from '../lib/api/analytics';
import { useStore } from '../stores/appStore';

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

  const badgeClass = (variant: string) => {
    const map: Record<string, string> = {
      danger: 'bg-red-50 text-red-600',
      warning: 'bg-amber-50 text-amber-600',
      success: 'bg-green-50 text-green-600',
      info: 'bg-blue-50 text-blue-600',
    };
    return `inline-block px-2 py-0.5 rounded-[10px] text-[0.72rem] font-semibold ${map[variant] || ''}`;
  };

  const perfTypeClass = (type: string) => {
    const map: Record<string, string> = {
      in: 'border-l-3 border-l-green-500',
      out: 'border-l-3 border-l-red-500',
      transfer: 'border-l-3 border-l-blue-500',
      count: 'border-l-3 border-l-purple-500',
    };
    return map[type] || '';
  };

  return (
    <div className="max-w-[1200px] mx-auto p-4 max-md:p-2">
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 bg-linear-to-br from-slate-900 to-slate-800 text-white">
          <button
            className="bg-white/15 border-none text-white px-2.5 py-1.5 rounded-md cursor-pointer hover:bg-white/25"
            onClick={() => navigate('/')}
          >
            ←
          </button>
          <h2 className="m-0 text-[1.1rem]">{tr ? 'Analitik & Zeka' : 'Analytics & Intelligence'}</h2>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              className={`px-4 py-2.5 border-none bg-none text-[0.82rem] cursor-pointer border-b-2 whitespace-nowrap transition-all duration-150
                ${tab === t.key
                  ? 'text-slate-900 border-b-blue-500 font-semibold'
                  : 'text-slate-500 border-b-transparent hover:bg-slate-50'
                }`}
              onClick={() => { setTab(t.key); setData([]); setPerfData(null); }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 px-5 py-3 border-b border-slate-100 items-center">
          {tab !== 'replenishment' && (
            <select
              className="px-2.5 py-1.5 border border-slate-300 rounded-md text-[0.82rem] bg-white"
              value={days}
              onChange={e => setDays(Number(e.target.value))}
            >
              <option value={7}>7 {tr ? 'gün' : 'days'}</option>
              <option value={14}>14 {tr ? 'gün' : 'days'}</option>
              <option value={30}>30 {tr ? 'gün' : 'days'}</option>
              <option value={60}>60 {tr ? 'gün' : 'days'}</option>
              <option value={90}>90 {tr ? 'gün' : 'days'}</option>
              <option value={180}>180 {tr ? 'gün' : 'days'}</option>
            </select>
          )}
          {tab === 'replenishment' && (
            <select
              className="px-2.5 py-1.5 border border-slate-300 rounded-md text-[0.82rem] bg-white"
              value={minThreshold}
              onChange={e => setMinThreshold(Number(e.target.value))}
            >
              <option value={3}>Min: 3</option>
              <option value={5}>Min: 5</option>
              <option value={10}>Min: 10</option>
              <option value={20}>Min: 20</option>
            </select>
          )}
          <span className="px-2.5 py-1 bg-sky-100 rounded-md text-xs font-semibold text-sky-700">
            {whCode}
          </span>
        </div>

        {/* Content */}
        <div className="px-5 py-4 min-h-[300px] max-md:px-3">
          {loading ? (
            <div className="text-center p-12 text-slate-400 text-[0.9rem]">
              {tr ? 'Yükleniyor...' : 'Loading...'}
            </div>
          ) : (
            <>
              {/* DEAD STOCK */}
              {tab === 'dead-stock' && (
                d.length === 0 ? (
                  <div className="text-center p-12 text-slate-400 text-[0.9rem]">
                    {tr ? 'Hareketsiz ürün yok' : 'No dead stock'}
                  </div>
                ) : (
                  <table className="w-full border-collapse text-[0.82rem] max-md:text-xs">
                    <thead>
                      <tr>
                        <th className="text-left px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">SKU</th>
                        <th className="text-left px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">{tr ? 'Ürün' : 'Product'}</th>
                        <th className="text-right px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">{tr ? 'Adet' : 'Qty'}</th>
                        <th className="text-right px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">{tr ? 'Boşta Gün' : 'Days Idle'}</th>
                        <th className="text-left px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">{tr ? 'Son Hareket' : 'Last Move'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-2.5 py-2 border-b border-slate-100 font-mono text-[0.78rem] text-blue-700">{r.product_sku}</td>
                          <td className="px-2.5 py-2 border-b border-slate-100">{r.product_name}</td>
                          <td className="px-2.5 py-2 border-b border-slate-100 text-right">{r.quantity}</td>
                          <td className="px-2.5 py-2 border-b border-slate-100 text-right">
                            <span className={badgeClass(r.days_idle > 180 ? 'danger' : r.days_idle > 90 ? 'warning' : 'info')}>
                              {r.days_idle ?? '∞'}
                            </span>
                          </td>
                          <td className="px-2.5 py-2 border-b border-slate-100">{r.last_movement ? new Date(r.last_movement).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {/* TURNOVER / DOS */}
              {tab === 'turnover' && (
                d.length === 0 ? (
                  <div className="text-center p-12 text-slate-400 text-[0.9rem]">
                    {tr ? 'Veri yok' : 'No data'}
                  </div>
                ) : (
                  <table className="w-full border-collapse text-[0.82rem] max-md:text-xs">
                    <thead>
                      <tr>
                        <th className="text-left px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">SKU</th>
                        <th className="text-left px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">{tr ? 'Ürün' : 'Product'}</th>
                        <th className="text-right px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">{tr ? 'Stok' : 'Stock'}</th>
                        <th className="text-right px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">{tr ? 'Çıkış' : 'Out'}</th>
                        <th className="text-right px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">{tr ? 'Gün/Ort' : 'Avg/Day'}</th>
                        <th className="text-right px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">DOS</th>
                        <th className="text-right px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">{tr ? 'Devir' : 'Turnover'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-2.5 py-2 border-b border-slate-100 font-mono text-[0.78rem] text-blue-700">{r.product_sku}</td>
                          <td className="px-2.5 py-2 border-b border-slate-100">{r.product_name}</td>
                          <td className="px-2.5 py-2 border-b border-slate-100 text-right">{r.current_stock}</td>
                          <td className="px-2.5 py-2 border-b border-slate-100 text-right">{r.total_out_period}</td>
                          <td className="px-2.5 py-2 border-b border-slate-100 text-right">{r.avg_daily_out}</td>
                          <td className="px-2.5 py-2 border-b border-slate-100 text-right">
                            <span className={badgeClass(Number(r.days_of_supply) > 365 ? 'danger' : Number(r.days_of_supply) > 90 ? 'warning' : 'success')}>
                              {r.days_of_supply >= 9999 ? '∞' : r.days_of_supply}
                            </span>
                          </td>
                          <td className="px-2.5 py-2 border-b border-slate-100 text-right">{r.turnover_ratio}x</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {/* PERFORMANCE */}
              {tab === 'performance' && perf && (
                <div className="flex flex-col gap-6">
                  <div>
                    <h3 className="m-0 mb-2 text-[0.9rem] text-slate-700">
                      {tr ? 'Hareket Hacmi' : 'Transaction Volume'}
                    </h3>
                    <div className="flex gap-3 flex-wrap max-md:flex-col">
                      {(perf.volume || []).map((v: { transaction_type: string; count: number; total_items: number }, i: number) => (
                        <div
                          key={i}
                          className={`flex-1 min-w-[100px] p-3 bg-slate-50 rounded-lg border border-slate-200 ${perfTypeClass(v.transaction_type.toLowerCase())}`}
                        >
                          <div className="text-[0.7rem] uppercase text-slate-500 font-semibold">{v.transaction_type}</div>
                          <div className="text-[1.4rem] font-bold text-slate-900 my-1">{v.count}</div>
                          <div className="text-[0.72rem] text-slate-400">{v.total_items} {tr ? 'ürün' : 'items'}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {perf.accuracy && (
                    <div>
                      <h3 className="m-0 mb-2 text-[0.9rem] text-slate-700">
                        {tr ? 'Sayım Doğruluğu' : 'Count Accuracy'}
                      </h3>
                      <div className="flex gap-3 flex-wrap max-md:flex-col">
                        <div className="flex-1 min-w-[100px] p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="text-[0.7rem] uppercase text-slate-500 font-semibold">{tr ? 'Oturumlar' : 'Sessions'}</div>
                          <div className="text-[1.4rem] font-bold text-slate-900 my-1">{perf.accuracy.total_sessions}</div>
                        </div>
                        <div className="flex-1 min-w-[100px] p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="text-[0.7rem] uppercase text-slate-500 font-semibold">{tr ? 'Doğruluk' : 'Accuracy'}</div>
                          <div className="text-[1.4rem] font-bold text-slate-900 my-1">{perf.accuracy.avg_accuracy_pct || '—'}%</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {(perf.pickers || []).length > 0 && (
                    <div>
                      <h3 className="m-0 mb-2 text-[0.9rem] text-slate-700">
                        {tr ? 'Toplayıcı Performansı' : 'Picker Performance'}
                      </h3>
                      <table className="w-full border-collapse text-[0.82rem] max-md:text-xs">
                        <thead>
                          <tr>
                            <th className="text-left px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">{tr ? 'Toplayıcı' : 'Picker'}</th>
                            <th className="text-right px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">{tr ? 'Sipariş' : 'Orders'}</th>
                            <th className="text-right px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">{tr ? 'Ort. dk' : 'Avg min'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(perf.pickers || []).map((p: { username: string; full_name: string; orders_picked: number; avg_pick_minutes: string }, i: number) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-2.5 py-2 border-b border-slate-100">{p.full_name || p.username}</td>
                              <td className="px-2.5 py-2 border-b border-slate-100 text-right">{p.orders_picked}</td>
                              <td className="px-2.5 py-2 border-b border-slate-100 text-right">{p.avg_pick_minutes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {(perf.trend || []).length > 0 && (
                    <div>
                      <h3 className="m-0 mb-2 text-[0.9rem] text-slate-700">
                        {tr ? 'Günlük Trend' : 'Daily Trend'}
                      </h3>
                      <div className="flex gap-[3px] items-end h-[120px] py-2">
                        {(perf.trend || []).slice(-14).map((t: { date: string; in_count: number; out_count: number; transfer_count: number }, i: number) => {
                          const max = Math.max(1, ...perf.trend.slice(-14).map((x: { in_count: number; out_count: number; transfer_count: number }) => x.in_count + x.out_count + x.transfer_count));
                          const total = t.in_count + t.out_count + t.transfer_count;
                          const pct = (total / max) * 100;
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center h-full" title={`${t.date}: IN ${t.in_count} / OUT ${t.out_count} / TR ${t.transfer_count}`}>
                              <div className="w-full max-w-6 rounded-t overflow-hidden flex flex-col mt-auto" style={{ height: `${Math.max(2, pct)}%` }}>
                                <div className="bg-green-500" style={{ height: `${total ? (t.in_count / total) * 100 : 0}%` }} />
                                <div className="bg-red-500" style={{ height: `${total ? (t.out_count / total) * 100 : 0}%` }} />
                                <div className="bg-blue-500" style={{ height: `${total ? (t.transfer_count / total) * 100 : 0}%` }} />
                              </div>
                              <div className="text-[0.65rem] text-slate-400 mt-0.5">{new Date(t.date).getDate()}</div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-3 justify-center text-[0.7rem] mt-1">
                        <span className="text-green-500">IN</span>
                        <span className="text-red-500">OUT</span>
                        <span className="text-blue-500">TRANSFER</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SLOTTING */}
              {tab === 'slotting' && (
                d.length === 0 ? (
                  <div className="text-center p-12 text-slate-400 text-[0.9rem]">
                    {tr ? 'Öneri yok' : 'No suggestions'}
                  </div>
                ) : (
                  <table className="w-full border-collapse text-[0.82rem] max-md:text-xs">
                    <thead>
                      <tr>
                        <th className="text-left px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">SKU</th>
                        <th className="text-left px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">{tr ? 'Ürün' : 'Product'}</th>
                        <th className="text-right px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">{tr ? 'Hareket' : 'Moves'}</th>
                        <th className="text-left px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">{tr ? 'Mevcut Lok.' : 'Current Loc'}</th>
                        <th className="text-left px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">{tr ? 'Öneri' : 'Suggestion'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-2.5 py-2 border-b border-slate-100 font-mono text-[0.78rem] text-blue-700">{r.product_sku}</td>
                          <td className="px-2.5 py-2 border-b border-slate-100">{r.product_name}</td>
                          <td className="px-2.5 py-2 border-b border-slate-100 text-right">{r.movement_count}</td>
                          <td className="px-2.5 py-2 border-b border-slate-100">{r.current_location || '—'}</td>
                          <td className="px-2.5 py-2 border-b border-slate-100">
                            <span className={badgeClass(r.recommendation === 'MOVE_TO_PRIME' ? 'warning' : r.recommendation === 'OPTIMAL' ? 'success' : 'info')}>
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
                d.length === 0 ? (
                  <div className="text-center p-12 text-slate-400 text-[0.9rem]">
                    {tr ? 'Yenileme gerekmiyor' : 'No replenishment needed'}
                  </div>
                ) : (
                  <table className="w-full border-collapse text-[0.82rem] max-md:text-xs">
                    <thead>
                      <tr>
                        <th className="text-left px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">SKU</th>
                        <th className="text-left px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">{tr ? 'Ürün' : 'Product'}</th>
                        <th className="text-right px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">{tr ? 'Stok' : 'Stock'}</th>
                        <th className="text-right px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">Min</th>
                        <th className="text-left px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">{tr ? 'Durum' : 'Status'}</th>
                        <th className="text-right px-2.5 py-2 bg-slate-50 border-b-2 border-slate-200 text-slate-600 font-semibold text-xs uppercase">{tr ? 'Gerekli' : 'Needed'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-2.5 py-2 border-b border-slate-100 font-mono text-[0.78rem] text-blue-700">{r.product_sku}</td>
                          <td className="px-2.5 py-2 border-b border-slate-100">{r.product_name}</td>
                          <td className="px-2.5 py-2 border-b border-slate-100 text-right">{r.current_stock}</td>
                          <td className="px-2.5 py-2 border-b border-slate-100 text-right">{r.min_threshold}</td>
                          <td className="px-2.5 py-2 border-b border-slate-100">
                            <span className={badgeClass(r.status === 'OUT_OF_STOCK' ? 'danger' : 'warning')}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-2.5 py-2 border-b border-slate-100 text-right">{Math.max(0, r.replenish_quantity)}</td>
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
