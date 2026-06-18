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

const Spinner = () => (
  <div className="h-screen flex items-center justify-center bg-zinc-950">
    <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

// Logged-in users cannot access login page — redirected to their role
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user) return <Navigate to={`/${user.role}`} replace />;
  return children;
};

// Any authenticated user
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

// Authenticated + correct role
const RoleRoute = ({ allowed, children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
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
              ariaProps: { role: 'status', 'aria-live': 'polite' },
            }}
          />
          <Routes>
            <Route path="/" element={<PrivateRoute><HomePage /></PrivateRoute>} />
            <Route path="/cart" element={<PrivateRoute><CartPage /></PrivateRoute>} />
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
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
