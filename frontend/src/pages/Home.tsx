import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api/client';
import { apiClient } from '../lib/api';
import { useStore } from '../stores/appStore';
import { useSSOStore } from '../stores/ssoStore';
import { translations } from '../i18n/translations';

interface DashboardStats {
  today: { in: number; out: number; transfer: number; adjust: number; total: number };
  pending_orders: number;
  active_shipments: number;
  low_stock_items: number;
  active_counts: number;
  pending_rmas: number;
  total_skus: number;
  total_units: number;
  trend: Array<{ date: string; count: number }>;
}

interface ModuleCard {
  id: string;
  path: string;
  icon: string;
  titleKey: string;
  descKey: string;
  color: string;
  adminOnly?: boolean;
}

const modules: ModuleCard[] = [
  {
    id: 'stock-dashboard',
    path: '/stock-dashboard',
    icon: '🌍',
    titleKey: 'stockDashboard',
    descKey: 'stockDashboardDesc',
    color: '#0f172a',
  },
  {
    id: 'operations',
    path: '/operations',
    icon: '🎯',
    titleKey: 'operations',
    descKey: 'warehouseOperations',
    color: '#3b82f6',
  },
  {
    id: 'inventory',
    path: '/inventory',
    icon: '📦',
    titleKey: 'inventory',
    descKey: 'stockLocationQuery',
    color: '#10b981',
  },
  {
    id: 'reports',
    path: '/reports',
    icon: '📊',
    titleKey: 'reports',
    descKey: 'reportsDesc',
    color: '#8b5cf6',
  },
  {
    id: 'transactions',
    path: '/transactions',
    icon: '📋',
    titleKey: 'history',
    descKey: 'transactionHistory',
    color: '#f59e0b',
  },
  {
    id: 'products',
    path: '/products',
    icon: '🏷️',
    titleKey: 'products',
    descKey: 'manageProducts',
    color: '#ec4899',
  },
  {
    id: 'locations',
    path: '/locations',
    icon: '📍',
    titleKey: 'locations',
    descKey: 'manageLocations',
    color: '#06b6d4',
  },
  {
    id: 'containers',
    path: '/containers',
    icon: '🗃️',
    titleKey: 'containers',
    descKey: 'containersDesc',
    color: '#06b6d4',
  },
  {
    id: 'orders',
    path: '/orders',
    icon: '🛒',
    titleKey: 'orders',
    descKey: 'ordersDesc',
    color: '#8b5cf6',
    adminOnly: true,
  },
  {
    id: 'shipments',
    path: '/shipments',
    icon: '🚚',
    titleKey: 'shipments',
    descKey: 'shipmentsDesc',
    color: '#14b8a6',
    adminOnly: true,
  },
  {
    id: 'returns',
    path: '/returns',
    icon: '↩️',
    titleKey: 'returns',
    descKey: 'returnsDesc',
    color: '#f59e0b',
    adminOnly: true,
  },
  {
    id: 'analytics',
    path: '/analytics',
    icon: '📈',
    titleKey: 'analytics',
    descKey: 'analyticsDesc',
    color: '#7c3aed',
    adminOnly: true,
  },
  {
    id: 'admin',
    path: '/admin',
    icon: '⚙️',
    titleKey: 'admin',
    descKey: 'adminDesc',
    color: '#64748b',
    adminOnly: true,
  },
];

function Home() {
  const { language, currentWarehouse } = useStore();
  const { wmsUser: user } = useSSOStore();
  const t = translations[language];
  const [health, setHealth] = useState<{ success: boolean; data?: { database?: string } } | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  useEffect(() => {
    const load = async () => {
      try {
        const [healthRes, statsRes] = await Promise.all([
          apiClient.health(),
          api.get('/dashboard/stats', { params: { warehouse_code: currentWarehouse } }).then(r => r.data).catch(() => null),
        ]);
        setHealth(healthRes);
        if (statsRes?.success) setStats(statsRes.data);
      } catch (error) {
        console.error('Dashboard load failed:', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [currentWarehouse]);

  const filteredModules = modules.filter(m => !m.adminOnly || isAdminOrManager);

  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)] bg-slate-100 p-4 gap-4 max-w-[800px] mx-auto">
      {/* Status Bar */}
      <div className="flex justify-between items-center bg-white p-4 px-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <span className="bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold text-[0.9375rem] tracking-wide">{currentWarehouse}</span>
          <span className="text-slate-600 text-[0.9375rem]">
            {language === 'tr' ? 'Merhaba' : 'Hello'}, {user?.full_name || user?.username || 'User'}
          </span>
        </div>
        <div className="flex items-center">
          {loading ? (
            <span className="text-warning-500 text-[1.375rem] leading-none animate-pulse">...</span>
          ) : health?.success ? (
            <span className="text-success-500 text-[1.375rem] leading-none">●</span>
          ) : (
            <span className="text-error-500 text-[1.375rem] leading-none">●</span>
          )}
        </div>
      </div>

      {/* KPI Stats */}
      {stats && (
        <div className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-200 flex flex-col gap-2.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-primary-50 rounded-[10px] p-3 text-center border border-primary-200 no-underline text-inherit">
              <div className="text-2xl font-extrabold text-slate-800 leading-tight">{stats.today.total}</div>
              <div className="text-[0.65rem] text-slate-400 uppercase font-semibold tracking-wide mt-0.5">{language === 'tr' ? 'Bugün Hareket' : "Today's Moves"}</div>
              <div className="flex justify-center gap-1 mt-1.5">
                <span className="text-[0.575rem] px-1.5 py-0.5 rounded-[3px] font-bold bg-green-100 text-green-600">IN {stats.today.in}</span>
                <span className="text-[0.575rem] px-1.5 py-0.5 rounded-[3px] font-bold bg-red-100 text-red-600">OUT {stats.today.out}</span>
                <span className="text-[0.575rem] px-1.5 py-0.5 rounded-[3px] font-bold bg-blue-100 text-blue-700">TRF {stats.today.transfer}</span>
              </div>
            </div>
            <Link to="/orders" className="bg-slate-50 rounded-[10px] p-3 text-center border border-slate-200 no-underline text-inherit transition-all duration-200 hover:border-blue-500 hover:bg-blue-50 hover:-translate-y-px">
              <div className="text-2xl font-extrabold text-slate-800 leading-tight">{stats.pending_orders}</div>
              <div className="text-[0.65rem] text-slate-400 uppercase font-semibold tracking-wide mt-0.5">{language === 'tr' ? 'Bekleyen Sipariş' : 'Pending Orders'}</div>
            </Link>
            <Link to="/shipments" className="bg-slate-50 rounded-[10px] p-3 text-center border border-slate-200 no-underline text-inherit transition-all duration-200 hover:border-blue-500 hover:bg-blue-50 hover:-translate-y-px">
              <div className="text-2xl font-extrabold text-slate-800 leading-tight">{stats.active_shipments}</div>
              <div className="text-[0.65rem] text-slate-400 uppercase font-semibold tracking-wide mt-0.5">{language === 'tr' ? 'Aktif Sevkiyat' : 'Active Shipments'}</div>
            </Link>
            <div className="bg-slate-50 rounded-[10px] p-3 text-center border border-slate-200 no-underline text-inherit">
              <div className="text-2xl font-extrabold text-amber-600 leading-tight">{stats.low_stock_items}</div>
              <div className="text-[0.65rem] text-slate-400 uppercase font-semibold tracking-wide mt-0.5">{language === 'tr' ? 'Düşük Stok' : 'Low Stock'}</div>
            </div>
          </div>
          <div className="flex justify-around py-1.5 border-t border-slate-100">
            <div className="flex flex-col items-center gap-px">
              <span className="text-[0.9375rem] font-bold text-slate-800">{stats.total_skus}</span>
              <span className="text-[0.575rem] text-slate-400 uppercase font-semibold">SKU</span>
            </div>
            <div className="flex flex-col items-center gap-px">
              <span className="text-[0.9375rem] font-bold text-slate-800">{stats.total_units.toLocaleString()}</span>
              <span className="text-[0.575rem] text-slate-400 uppercase font-semibold">{language === 'tr' ? 'Toplam Adet' : 'Total Units'}</span>
            </div>
            <div className="flex flex-col items-center gap-px">
              <span className="text-[0.9375rem] font-bold text-slate-800">{stats.pending_rmas}</span>
              <span className="text-[0.575rem] text-slate-400 uppercase font-semibold">RMA</span>
            </div>
            <div className="flex flex-col items-center gap-px">
              <span className="text-[0.9375rem] font-bold text-slate-800">{stats.active_counts}</span>
              <span className="text-[0.575rem] text-slate-400 uppercase font-semibold">{language === 'tr' ? 'Sayım' : 'Counts'}</span>
            </div>
          </div>
          {/* Mini trend bar */}
          <div className="flex justify-around items-end h-12 pt-1 px-2 border-t border-slate-100">
            {stats.trend.map((d, i) => {
              const max = Math.max(...stats.trend.map(t => t.count), 1);
              const h = Math.max(4, (d.count / max) * 32);
              return (
                <div key={i} className="flex flex-col items-center gap-0.5 flex-1" title={`${d.date}: ${d.count}`}>
                  <div className="w-full max-w-[28px] bg-gradient-to-b from-blue-500 to-blue-300 rounded-t-[3px] min-h-1 transition-[height] duration-300" style={{ height: `${h}px` }} />
                  <span className="text-[0.5rem] text-slate-400 font-semibold">{new Date(d.date).toLocaleDateString(language === 'tr' ? 'tr' : 'en', { weekday: 'narrow' })}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Module Grid */}
      <div className="flex flex-col gap-3 flex-1 sm:grid sm:grid-cols-2 sm:gap-4">
        {filteredModules.map((module) => (
          <Link
            key={module.id}
            to={module.path}
            className="flex items-center bg-white p-4 rounded-xl no-underline text-inherit shadow-sm border border-slate-200 transition-all duration-150 border-l-4 hover:translate-x-1 hover:shadow-md hover:border-slate-300 sm:flex-col sm:text-center sm:p-6 sm:border-l-0 sm:border-t-4 sm:hover:translate-x-0 sm:hover:-translate-y-1"
            style={{ '--card-color': module.color, borderLeftColor: module.color, borderTopColor: undefined } as React.CSSProperties}
          >
            <div className="text-[1.75rem] w-[52px] h-[52px] flex items-center justify-center bg-slate-100 rounded-lg shrink-0 sm:mx-auto sm:mb-3 sm:w-[60px] sm:h-[60px] sm:text-[2rem]">{module.icon}</div>
            <div className="flex-1 ml-4 min-w-0 sm:ml-0">
              <h3 className="m-0 text-[1.0625rem] font-semibold text-slate-800">{(t as Record<string, string>)[module.titleKey] || module.titleKey}</h3>
              <p className="mt-1 mb-0 text-[0.8125rem] text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis sm:whitespace-normal">{(t as Record<string, string>)[module.descKey] || module.descKey}</p>
            </div>
            <div className="text-[1.125rem] text-slate-400 ml-2 transition-all duration-150 sm:hidden">→</div>
          </Link>
        ))}
      </div>

      {/* System Status Footer */}
      <div className="flex flex-col items-center bg-white p-3 px-4 rounded-xl shadow-sm border border-slate-200 gap-3">
        <div className="flex justify-center gap-6 w-full pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${health?.success ? 'bg-success-500 shadow-[0_0_8px_var(--color-success-400)] animate-pulse' : 'bg-error-500 shadow-[0_0_8px_var(--color-error-400)]'}`}></span>
            <span className="text-xs font-medium text-slate-600">
              {health?.success
                ? (language === 'tr' ? 'Sistem Aktif' : 'System Online')
                : (language === 'tr' ? 'Bağlantı Yok' : 'Offline')
              }
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">🗄️</span>
            <span className="text-xs font-medium text-slate-600">
              {health?.data?.database === 'connected'
                ? (language === 'tr' ? 'Veritabanı OK' : 'Database OK')
                : (language === 'tr' ? 'Veritabanı Hatası' : 'Database Error')
              }
            </span>
          </div>
        </div>
        <div className="flex justify-center items-center gap-6">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[0.6875rem] text-slate-400 uppercase tracking-wide">{language === 'tr' ? 'Aktif Depo' : 'Active Warehouse'}</span>
            <span className="text-sm font-semibold text-slate-600">{currentWarehouse}</span>
          </div>
          <div className="w-px h-7 bg-slate-200" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-[0.6875rem] text-slate-400 uppercase tracking-wide">{language === 'tr' ? 'Kullanıcı' : 'User'}</span>
            <span className="text-sm font-semibold text-slate-600">{user?.role || 'OPERATOR'}</span>
          </div>
          <div className="w-px h-7 bg-slate-200" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-[0.6875rem] text-slate-400 uppercase tracking-wide">{language === 'tr' ? 'Versiyon' : 'Version'}</span>
            <span className="text-sm font-semibold text-slate-600">v1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
