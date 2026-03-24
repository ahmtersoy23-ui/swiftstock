import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Inventory from './pages/Inventory';
import Transactions from './pages/Transactions';
import Products from './pages/Products';
import Locations from './pages/Locations';
import Operations from './pages/Operations';
import Reports from './pages/Reports';
import Admin from './pages/Admin';
import Shipments from './pages/Shipments';
import Orders from './pages/Orders';
import Returns from './pages/Returns';
import Containers from './pages/Containers';
import StockDashboard from './pages/StockDashboard';
import Analytics from './pages/Analytics';
import { useSSO } from './hooks/useSSO';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';

// SSO authentication integrated
function App() {
  const { initAuth, isAuthenticated } = useSSO();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const authenticate = async () => {
      await initAuth();
      setIsLoading(false);
    };

    authenticate();
  }, []);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#1e293b',
        color: '#ffffff',
        fontSize: '18px',
      }}>
        <div>
          <div style={{ marginBottom: '10px' }}>🔐 Authenticating...</div>
          <div style={{ fontSize: '14px', color: '#94a3b8' }}>SwiftStock WMS</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#1e293b',
        color: '#ffffff',
        fontSize: '18px',
      }}>
        <div>
          <div style={{ marginBottom: '10px' }}>🔄 Redirecting to SSO...</div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/operations" element={<Operations />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/products" element={<Products />} />
            <Route path="/locations" element={<Locations />} />
            <Route path="/admin" element={
              <ProtectedRoute requiredRole={['ADMIN', 'MANAGER']}>
                <Admin />
              </ProtectedRoute>
            } />
            <Route path="/shipments" element={<Shipments />} />
            <Route path="/containers" element={<Containers />} />
            <Route path="/stock-dashboard" element={<StockDashboard />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/orders" element={
              <ProtectedRoute requiredRole={['ADMIN', 'MANAGER']}>
                <Orders />
              </ProtectedRoute>
            } />
            <Route path="/returns" element={
              <ProtectedRoute requiredRole={['ADMIN', 'MANAGER']}>
                <Returns />
              </ProtectedRoute>
            } />
          </Routes>
        </Layout>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
