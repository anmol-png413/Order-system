import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import CartPage from './pages/CartPage';
import StaffPage from './pages/StaffPage';
import PackingPage from './pages/PackingPage';
import CounterPage from './pages/CounterPage';
import AdminPage from './pages/AdminPage';

const RoleRoute = ({ allowed, children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center text-zinc-400 font-display text-lg">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowed.includes(user.role)) return <Navigate to={`/${user.role}`} replace />;
  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background: '#1a1a1a', color: '#f5f5f5', border: '1px solid #2e2e2e', borderRadius: '12px', fontFamily: 'DM Sans, sans-serif' },
              success: { iconTheme: { primary: '#f97316', secondary: '#fff' } },
            }}
          />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/staff" element={<RoleRoute allowed={['staff', 'admin']}><StaffPage /></RoleRoute>} />
            <Route path="/packing" element={<RoleRoute allowed={['packing', 'admin']}><PackingPage /></RoleRoute>} />
            <Route path="/counter" element={<RoleRoute allowed={['counter', 'admin']}><CounterPage /></RoleRoute>} />
            <Route path="/admin" element={<RoleRoute allowed={['admin']}><AdminPage /></RoleRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
