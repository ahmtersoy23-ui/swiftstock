import { type ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useStore } from '../store/useStore';
import { translations } from '../i18n/translations';
import { apiClient } from '../lib/api';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, clearAuth, refreshToken } = useAuthStore();
  const { currentWarehouse, language, setCurrentWarehouse, setLanguage } = useStore();
  const [loggingOut, setLoggingOut] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const t = translations[language];
  const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const handleWarehouseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentWarehouse(e.target.value);
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as 'tr' | 'en');
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      await apiClient.logout(refreshToken || undefined);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuth();
      navigate('/login');
      setLoggingOut(false);
    }
  };

  return (
    <div className={`layout theme-${currentWarehouse}`}>
      <header className={`header theme-${currentWarehouse}`}>
        <div className="header-content">
          <h1 className="logo">SWIFTSTOCK</h1>
          <div className="user-info">
            <select
              value={language}
              onChange={handleLanguageChange}
              className="language-select"
              title="Language / Dil"
            >
              <option value="tr">🇹🇷 TR</option>
              <option value="en">🇬🇧 EN</option>
            </select>
            <select
              value={currentWarehouse}
              onChange={handleWarehouseChange}
              className="warehouse-select"
            >
              <option value="USA">🇺🇸 USA</option>
              <option value="TUR">🇹🇷 TUR</option>
              <option value="FAB">🏭 FAB</option>
            </select>
            <span className="user">{user?.full_name || user?.username || 'User'}</span>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="logout-btn"
              title="Çıkış Yap"
            >
              {loggingOut ? '...' : '🚪'}
            </button>
          </div>
        </div>
      </header>

      <div className="nav-wrapper">
        <nav className="nav">
          <Link to="/operations" className={isActive('/') || isActive('/operations') ? 'active' : ''}>
            {t.operations}
          </Link>
          <Link to="/inventory" className={isActive('/inventory') ? 'active' : ''}>
            {t.inventory}
          </Link>
          <Link to="/transactions" className={isActive('/transactions') ? 'active' : ''}>
            {t.history}
          </Link>
          <Link to="/products" className={isActive('/products') ? 'active' : ''}>
            {t.products}
          </Link>
          <Link to="/locations" className={isActive('/locations') ? 'active' : ''}>
            {t.locations}
          </Link>
          {isAdminOrManager && (
            <Link to="/admin" className={isActive('/admin') ? 'active' : ''}>
              {t.admin}
            </Link>
          )}
        </nav>
      </div>

      <main className="main">{children}</main>
    </div>
  );
}

export default Layout;
