import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { translations } from '../i18n/translations';
import './Home.css';

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
    id: 'shipments',
    path: '/shipments',
    icon: '🚚',
    titleKey: 'shipments',
    descKey: 'shipmentsDesc',
    color: '#14b8a6',
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
  const { user } = useAuthStore();
  const t = translations[language];
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await apiClient.health();
        setHealth(response);
      } catch (error) {
        console.error('Health check failed:', error);
      } finally {
        setLoading(false);
      }
    };

    checkHealth();
  }, []);

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
              <h3 className="module-title">{(t as any)[module.titleKey] || module.titleKey}</h3>
              <p className="module-desc">{(t as any)[module.descKey] || module.descKey}</p>
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
