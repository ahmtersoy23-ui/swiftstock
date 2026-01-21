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
import { useSSO } from './hooks/useSSO';

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
          <Route path="/admin" element={<Admin />} />
          <Route path="/shipments" element={<Shipments />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
