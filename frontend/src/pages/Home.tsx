import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api/client';
import { apiClient } from '../lib/api';
import { useStore } from '../stores/appStore';
import { useSSOStore } from '../stores/ssoStore';
import { translations } from '../i18n/translations';
import './Home.css';

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
    <div className="home-dashboard">
      {/* Status Bar */}
      <div className="dashboard-status">
        <div className="status-left">
          <span className="warehouse-badge-large">{currentWarehouse}</span>
          <span className="user-greeting">
            {language === 'tr' ? 'Merhaba' : 'Hello'}, {user?.full_name || user?.username || 'User'}
          </span>
        </div>
        <div className="status-right">
          {loading ? (
            <span className="connection-status loading">...</span>
          ) : health?.success ? (
            <span className="connection-status connected">●</span>
          ) : (
            <span className="connection-status disconnected">●</span>
          )}
        </div>
      </div>

      {/* KPI Stats */}
      {stats && (
        <div className="kpi-section">
          <div className="kpi-grid">
            <div className="kpi-card kpi-primary">
              <div className="kpi-value">{stats.today.total}</div>
              <div className="kpi-label">{language === 'tr' ? 'Bugün Hareket' : "Today's Moves"}</div>
              <div className="kpi-breakdown">
                <span className="kpi-tag kpi-in">IN {stats.today.in}</span>
                <span className="kpi-tag kpi-out">OUT {stats.today.out}</span>
                <span className="kpi-tag kpi-trf">TRF {stats.today.transfer}</span>
              </div>
            </div>
            <Link to="/orders" className="kpi-card kpi-clickable">
              <div className="kpi-value">{stats.pending_orders}</div>
              <div className="kpi-label">{language === 'tr' ? 'Bekleyen Sipariş' : 'Pending Orders'}</div>
            </Link>
            <Link to="/shipments" className="kpi-card kpi-clickable">
              <div className="kpi-value">{stats.active_shipments}</div>
              <div className="kpi-label">{language === 'tr' ? 'Aktif Sevkiyat' : 'Active Shipments'}</div>
            </Link>
            <div className="kpi-card kpi-warn">
              <div className="kpi-value">{stats.low_stock_items}</div>
              <div className="kpi-label">{language === 'tr' ? 'Düşük Stok' : 'Low Stock'}</div>
            </div>
          </div>
          <div className="kpi-row-secondary">
            <div className="kpi-mini">
              <span className="kpi-mini-value">{stats.total_skus}</span>
              <span className="kpi-mini-label">SKU</span>
            </div>
            <div className="kpi-mini">
              <span className="kpi-mini-value">{stats.total_units.toLocaleString()}</span>
              <span className="kpi-mini-label">{language === 'tr' ? 'Toplam Adet' : 'Total Units'}</span>
            </div>
            <div className="kpi-mini">
              <span className="kpi-mini-value">{stats.pending_rmas}</span>
              <span className="kpi-mini-label">RMA</span>
            </div>
            <div className="kpi-mini">
              <span className="kpi-mini-value">{stats.active_counts}</span>
              <span className="kpi-mini-label">{language === 'tr' ? 'Sayım' : 'Counts'}</span>
            </div>
          </div>
          {/* Mini trend bar */}
          <div className="kpi-trend">
            {stats.trend.map((d, i) => {
              const max = Math.max(...stats.trend.map(t => t.count), 1);
              const h = Math.max(4, (d.count / max) * 32);
              return (
                <div key={i} className="trend-bar-wrap" title={`${d.date}: ${d.count}`}>
                  <div className="trend-bar" style={{ height: `${h}px` }} />
                  <span className="trend-day">{new Date(d.date).toLocaleDateString(language === 'tr' ? 'tr' : 'en', { weekday: 'narrow' })}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Module Grid */}
      <div className="module-grid">
        {filteredModules.map((module) => (
          <Link
            key={module.id}
            to={module.path}
            className="module-card"
            style={{ '--card-color': module.color } as React.CSSProperties}
          >
            <div className="module-icon">{module.icon}</div>
            <div className="module-info">
              <h3 className="module-title">{(t as Record<string, string>)[module.titleKey] || module.titleKey}</h3>
              <p className="module-desc">{(t as Record<string, string>)[module.descKey] || module.descKey}</p>
            </div>
            <div className="module-arrow">→</div>
          </Link>
        ))}
      </div>

      {/* System Status Footer */}
      <div className="dashboard-footer enhanced">
        <div className="footer-status-row">
          <div className="footer-status-item">
            <span className={`status-indicator ${health?.success ? 'online' : 'offline'}`}></span>
            <span className="status-text">
              {health?.success
                ? (language === 'tr' ? 'Sistem Aktif' : 'System Online')
                : (language === 'tr' ? 'Bağlantı Yok' : 'Offline')
              }
            </span>
          </div>
          <div className="footer-status-item">
            <span className="status-icon">🗄️</span>
            <span className="status-text">
              {health?.data?.database === 'connected'
                ? (language === 'tr' ? 'Veritabanı OK' : 'Database OK')
                : (language === 'tr' ? 'Veritabanı Hatası' : 'Database Error')
              }
            </span>
          </div>
        </div>
        <div className="footer-info-row">
          <div className="footer-info">
            <span className="footer-label">{language === 'tr' ? 'Aktif Depo' : 'Active Warehouse'}</span>
            <span className="footer-value">{currentWarehouse}</span>
          </div>
          <div className="footer-divider" />
          <div className="footer-info">
            <span className="footer-label">{language === 'tr' ? 'Kullanıcı' : 'User'}</span>
            <span className="footer-value">{user?.role || 'OPERATOR'}</span>
          </div>
          <div className="footer-divider" />
          <div className="footer-info">
            <span className="footer-label">{language === 'tr' ? 'Versiyon' : 'Version'}</span>
            <span className="footer-value">v1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
