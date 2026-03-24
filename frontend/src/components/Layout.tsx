import { type ReactNode, useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../stores/appStore';
import { useSSO } from '../hooks/useSSO';
import { alertApi } from '../lib/api/alerts';
import api from '../lib/api';
import './Layout.css';

interface Alert {
  alert_id: number;
  alert_type: string;
  severity: string;
  title: string;
  message?: string;
  is_read: boolean;
  created_at: string;
}

interface LayoutProps {
  children: ReactNode;
}

function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentWarehouse, language, setCurrentWarehouse, setLanguage } = useStore();
  const { user, logout } = useSSO();
  const [warehouses, setWarehouses] = useState<{ code: string; name: string; is_active: boolean }[]>([]);

  // Alerts
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAlerts, setShowAlerts] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);

  const isHomePage = location.pathname === '/';

  useEffect(() => {
    api.get('/warehouses?all=true').then((res) => {
      if (res.data?.success && Array.isArray(res.data.data)) {
        const list: { code: string; name: string; is_active: boolean }[] = res.data.data;
        setWarehouses(list);
        const validCodes = list.map((w) => w.code);
        if (!validCodes.includes(currentWarehouse)) {
          const firstActive = list.find((w) => w.is_active);
          if (firstActive) setCurrentWarehouse(firstActive.code);
        }
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load alerts on mount + every 60s
  useEffect(() => {
    const loadAlerts = () => {
      alertApi.getAll().then(res => {
        if (res.success) {
          setAlerts(res.data || []);
          setUnreadCount(res.unread_count || 0);
        }
      }).catch(() => {});
    };

    loadAlerts();
    const interval = setInterval(loadAlerts, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (alertRef.current && !alertRef.current.contains(e.target as Node)) {
        setShowAlerts(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleMarkRead = async (alertId: number) => {
    await alertApi.markRead(alertId);
    setAlerts(prev => prev.map(a => a.alert_id === alertId ? { ...a, is_read: true } : a));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    await alertApi.markAllRead();
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
    setUnreadCount(0);
  };

  const handleWarehouseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentWarehouse(e.target.value);
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as 'tr' | 'en');
  };

  const handleHomeClick = () => {
    navigate('/');
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'WARNING': return '#f59e0b';
      case 'ERROR': return '#dc2626';
      default: return '#3b82f6';
    }
  };

  const formatAlertTime = useCallback((dateStr: string) => {
    const now = performance.timeOrigin + performance.now();
    const diff = now - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return language === 'tr' ? 'Az önce' : 'Just now';
    if (mins < 60) return `${mins}${language === 'tr' ? 'dk' : 'm'}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}${language === 'tr' ? 'sa' : 'h'}`;
    return `${Math.floor(hours / 24)}${language === 'tr' ? 'g' : 'd'}`;
  }, [language]);

  return (
    <div className={`layout layout-minimal theme-${currentWarehouse}`}>
      <header className={`header header-minimal theme-${currentWarehouse}`}>
        <div className="header-content">
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

            {/* Alerts Bell */}
            <div ref={alertRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowAlerts(!showAlerts)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  position: 'relative',
                  padding: '4px 8px',
                  color: '#94a3b8',
                }}
                title={language === 'tr' ? 'Bildirimler' : 'Notifications'}
              >
                🔔
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '0',
                    right: '2px',
                    background: '#dc2626',
                    color: 'white',
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    fontSize: '10px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showAlerts && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  width: '320px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  background: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                  border: '1px solid #e2e8f0',
                  zIndex: 1000,
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom: '1px solid #f1f5f9',
                  }}>
                    <span style={{ fontWeight: '600', fontSize: '14px', color: '#1e293b' }}>
                      {language === 'tr' ? 'Bildirimler' : 'Notifications'}
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#3b82f6',
                          fontSize: '12px',
                          cursor: 'pointer',
                          fontWeight: '500',
                        }}
                      >
                        {language === 'tr' ? 'Tümünü oku' : 'Mark all read'}
                      </button>
                    )}
                  </div>

                  {alerts.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                      {language === 'tr' ? 'Bildirim yok' : 'No notifications'}
                    </div>
                  ) : (
                    alerts.slice(0, 20).map(alert => (
                      <div
                        key={alert.alert_id}
                        onClick={() => !alert.is_read && handleMarkRead(alert.alert_id)}
                        style={{
                          padding: '10px 16px',
                          borderBottom: '1px solid #f8fafc',
                          cursor: alert.is_read ? 'default' : 'pointer',
                          background: alert.is_read ? 'white' : '#fffbeb',
                          transition: 'background 0.2s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '12px',
                              fontWeight: alert.is_read ? '400' : '600',
                              color: '#1e293b',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}>
                              <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: alert.is_read ? '#e2e8f0' : getSeverityColor(alert.severity),
                                flexShrink: 0,
                              }} />
                              {alert.title}
                            </div>
                            {alert.message && (
                              <div style={{
                                fontSize: '11px',
                                color: '#64748b',
                                marginTop: '2px',
                                paddingLeft: '12px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}>
                                {alert.message}
                              </div>
                            )}
                          </div>
                          <span style={{
                            fontSize: '10px',
                            color: '#94a3b8',
                            flexShrink: 0,
                            marginLeft: '8px',
                          }}>
                            {formatAlertTime(alert.created_at)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

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
