import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useStore } from '../store/useStore';
import { translations } from '../i18n/translations';
import './Home.css';

function Home() {
  const { language } = useStore();
  const t = translations[language];
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="home">
      <div className="welcome-card">
        <h2>{t.welcomeMessage}</h2>
        <p>Barcode scanning and inventory management</p>

        {loading ? (
          <div className="status loading">{t.loading}</div>
        ) : health?.success ? (
          <div className="status success">
            {t.backendConnected}
            <small>{health.message}</small>
          </div>
        ) : (
          <div className="status error">{t.backendFailed}</div>
        )}
      </div>

      <div className="quick-actions">
        <h3>{t.quickActions}</h3>
        <div className="action-grid">
          <Link to="/operations" className="action-card featured">
            <div className="action-icon">🎯</div>
            <h4>{t.operations}</h4>
            <p>{t.warehouseOperations}</p>
          </Link>

          <Link to="/inventory" className="action-card">
            <div className="action-icon">📦</div>
            <h4>{t.inventory}</h4>
            <p>{t.stockLocationQuery}</p>
          </Link>

          <Link to="/locations" className="action-card">
            <div className="action-icon">📍</div>
            <h4>{t.locations}</h4>
            <p>{t.manageLocations}</p>
          </Link>

          <Link to="/products" className="action-card">
            <div className="action-icon">🏷️</div>
            <h4>{t.products}</h4>
            <p>{t.manageProducts}</p>
          </Link>

          <Link to="/transactions" className="action-card">
            <div className="action-icon">📋</div>
            <h4>{t.history}</h4>
            <p>{t.transactionHistory}</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Home;
