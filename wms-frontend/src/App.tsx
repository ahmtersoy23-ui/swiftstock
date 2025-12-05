import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Layout from './components/Layout';
import Login from './pages/Login';
import Inventory from './pages/Inventory';
import Transactions from './pages/Transactions';
import Products from './pages/Products';
import Locations from './pages/Locations';
import Operations from './pages/Operations';
import Admin from './pages/Admin';

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<Login />} />

        {/* Protected routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Operations />} />
                  <Route path="/operations" element={<Operations />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/locations" element={<Locations />} />
                  <Route path="/admin" element={<Admin />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
