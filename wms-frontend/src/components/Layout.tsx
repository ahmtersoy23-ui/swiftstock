import { type ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useStore } from '../stores/appStore';
import { apiClient } from '../lib/api';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearAuth, refreshToken } = useAuthStore();
  const { currentWarehouse, language, setCurrentWarehouse, setLanguage } = useStore();
  const [loggingOut, setLoggingOut] = useState(false);

  const isHomePage = location.pathname === '/';

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

  const handleHomeClick = () => {
    navigate('/');
  };

  return (
    <div className={`layout layout-minimal theme-${currentWarehouse}`}>
      <header className={`header header-minimal theme-${currentWarehouse}`}>
        <div className="header-content">
          {/* Home button - only show when not on home page */}
          {!isHomePage && (
            <button className="home-btn" onClick={handleHomeClick} title="Ana Sayfa">
              <span className="home-icon">&#x2302;</span>
            </button>
          )}
          <h1 className="logo" onClick={handleHomeClick} style={{ cursor: 'pointer' }}>
            SWIFTSTOCK
          </h1>
          <div className="user-info">
            <select
              value={language}
              onChange={handleLanguageChange}
              className="language-select"
              title="Language / Dil"
            >
              <option value="tr">TR</option>
              <option value="en">EN</option>
            </select>
            <select
              value={currentWarehouse}
              onChange={handleWarehouseChange}
              className="warehouse-select"
            >
              <option value="USA">USA</option>
              <option value="TUR">TUR</option>
              <option value="FAB">FAB</option>
            </select>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="logout-btn"
              title="Cikis Yap"
            >
              {loggingOut ? '...' : '->'}
            </button>
          </div>
        </div>
      </header>

      <main className="main main-full">{children}</main>
    </div>
  );
}

export default Layout;
