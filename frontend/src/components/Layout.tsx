import { type ReactNode, useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../stores/appStore';
import { useSSO } from '../hooks/useSSO';
import { alertApi } from '../lib/api/alerts';
import api from '../lib/api';

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
    if (mins < 1) return language === 'tr' ? 'Az once' : 'Just now';
    if (mins < 60) return `${mins}${language === 'tr' ? 'dk' : 'm'}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}${language === 'tr' ? 'sa' : 'h'}`;
    return `${Math.floor(hours / 24)}${language === 'tr' ? 'g' : 'd'}`;
  }, [language]);

  return (
    <div className={`flex flex-col h-screen bg-slate-50 theme-${currentWarehouse}`}>
      <header className={`relative bg-slate-800 text-white py-3 px-6 shadow-md duration-200 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[3px] after:bg-primary-500 md:py-2 md:px-3 theme-${currentWarehouse}`}>
        <div className="flex justify-between items-center max-w-[1200px] mx-auto relative">
          {!isHomePage && (
            <button
              className="bg-white/10 border border-white/20 text-white w-9 h-9 rounded-lg cursor-pointer flex items-center justify-center duration-150 mr-2 hover:bg-white/20 md:w-8 md:h-8"
              onClick={handleHomeClick}
              title="Ana Sayfa"
            >
              <span className="text-lg">&#x2302;</span>
            </button>
          )}
          <h1
            className="absolute left-1/2 -translate-x-1/2 m-0 text-[1.375rem] font-bold tracking-wider text-white md:text-lg md:tracking-normal"
            onClick={handleHomeClick}
            style={{ cursor: 'pointer' }}
          >
            SWIFTSTOCK
          </h1>
          <div className="flex gap-2 items-center md:gap-1">
            {user && (
              <div className="flex items-center gap-2 mr-3 text-sm text-slate-400">
                {user.picture && (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="w-7 h-7 rounded-full border-2 border-blue-500"
                  />
                )}
                <span className="font-medium">{user.name}</span>
              </div>
            )}

            {/* Alerts Bell */}
            <div ref={alertRef} className="relative">
              <button
                onClick={() => setShowAlerts(!showAlerts)}
                className="bg-transparent border-none cursor-pointer text-lg relative py-1 px-2 text-slate-400"
                title={language === 'tr' ? 'Bildirimler' : 'Notifications'}
              >
                🔔
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0.5 bg-red-600 text-white rounded-full w-4 h-4 text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showAlerts && (
                <div className="absolute top-full right-0 w-80 max-h-[400px] overflow-y-auto bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] border border-slate-200 z-[1000]">
                  <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100">
                    <span className="font-semibold text-sm text-slate-800">
                      {language === 'tr' ? 'Bildirimler' : 'Notifications'}
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="bg-transparent border-none text-blue-500 text-xs cursor-pointer font-medium"
                      >
                        {language === 'tr' ? 'Tumunu oku' : 'Mark all read'}
                      </button>
                    )}
                  </div>

                  {alerts.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-[13px]">
                      {language === 'tr' ? 'Bildirim yok' : 'No notifications'}
                    </div>
                  ) : (
                    alerts.slice(0, 20).map(alert => (
                      <div
                        key={alert.alert_id}
                        onClick={() => !alert.is_read && handleMarkRead(alert.alert_id)}
                        className={`px-4 py-2.5 border-b border-slate-50 duration-200 ${alert.is_read ? 'bg-white cursor-default' : 'bg-amber-50 cursor-pointer'}`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className={`text-xs text-slate-800 flex items-center gap-1.5 ${alert.is_read ? 'font-normal' : 'font-semibold'}`}>
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: alert.is_read ? '#e2e8f0' : getSeverityColor(alert.severity) }}
                              />
                              {alert.title}
                            </div>
                            {alert.message && (
                              <div className="text-[11px] text-slate-500 mt-0.5 pl-3 whitespace-nowrap overflow-hidden text-ellipsis">
                                {alert.message}
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0 ml-2">
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
              className="bg-white/10 text-white border border-white/20 py-2 px-3 rounded-lg text-sm font-medium cursor-pointer duration-150 hover:bg-white/20 focus:outline-none focus:bg-white/20 focus:border-white/40 md:py-1 md:px-2 md:text-xs [&_option]:bg-slate-800 [&_option]:text-white"
              title="Language / Dil"
            >
              <option value="tr">TR</option>
              <option value="en">EN</option>
            </select>
            <select
              value={currentWarehouse}
              onChange={handleWarehouseChange}
              className="bg-white/10 text-white border border-white/20 py-2 px-3 rounded-lg text-sm font-medium cursor-pointer duration-150 hover:bg-white/20 focus:outline-none focus:bg-white/20 focus:border-white/40 md:py-1 md:px-2 md:text-xs [&_option]:bg-slate-800 [&_option]:text-white"
            >
              {warehouses.length > 0 ? (
                warehouses.map((w) => (
                  <option key={w.code} value={w.code} disabled={!w.is_active}>
                    {w.code}{!w.is_active ? ' (yakinda)' : ''}
                  </option>
                ))
              ) : (
                <option value={currentWarehouse}>{currentWarehouse}</option>
              )}
            </select>
            <button
              onClick={logout}
              className="py-1.5 px-3 bg-red-600 text-white border-none rounded-md cursor-pointer text-sm font-medium"
              title="Logout"
            >
              →
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-0 max-w-full w-full overflow-y-auto">{children}</main>
    </div>
  );
}

export default Layout;
