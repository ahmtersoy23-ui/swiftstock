import { type ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../stores/appStore';
import { useSSO } from '../hooks/useSSO';
import api from '../lib/api';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentWarehouse, language, setCurrentWarehouse, setLanguage } = useStore();
  const { user, logout } = useSSO();
  const [warehouses, setWarehouses] = useState<{ code: string; name: string; is_active: boolean }[]>([]);

  const isHomePage = location.pathname === '/';

  useEffect(() => {
    api.get('/warehouses?all=true').then((res) => {
      if (res.data?.success && Array.isArray(res.data.data)) {
        const list: { code: string; name: string; is_active: boolean }[] = res.data.data;
        setWarehouses(list);
        // Eski localStorage değeri (TUR/USA/FAB) geçersizse ilk aktif depoya sıfırla
        const validCodes = list.map((w) => w.code);
        if (!validCodes.includes(currentWarehouse)) {
          const firstActive = list.find((w) => w.is_active);
          if (firstActive) setCurrentWarehouse(firstActive.code);
        }
      }
    }).catch(() => { /* fail silently */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleWarehouseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentWarehouse(e.target.value);
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as 'tr' | 'en');
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
            {user && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginRight: '12px',
                fontSize: '14px',
                color: '#94a3b8',
              }}>
                {user.picture && (
                  <img
                    src={user.picture}
                    alt={user.name}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      border: '2px solid #3b82f6',
                    }}
                  />
                )}
                <span style={{ fontWeight: '500' }}>{user.name}</span>
              </div>
            )}
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
              {warehouses.length > 0 ? (
                warehouses.map((w) => (
                  <option key={w.code} value={w.code} disabled={!w.is_active}>
                    {w.code}{!w.is_active ? ' (yakında)' : ''}
                  </option>
                ))
              ) : (
                <option value={currentWarehouse}>{currentWarehouse}</option>
              )}
            </select>
            <button
              onClick={logout}
              className="logout-btn"
              title="Logout"
              style={{
                padding: '6px 12px',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              →
            </button>
          </div>
        </div>
      </header>

      <main className="main main-full">{children}</main>
    </div>
  );
}

export default Layout;
