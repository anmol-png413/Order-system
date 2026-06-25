import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

// withCredentials globally — cookies automatically sent with every request
axios.defaults.withCredentials = true;

// Global 401 interceptor — redirect to login on session expiry
axios.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/api/auth/')) {
      // Session expired — hard redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if already logged in via cookie
    axios.get('/api/auth/me')
      .then(res => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    // Server sets httpOnly cookie automatically in response
    const res = await axios.post('/api/auth/login', { username, password });
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    await axios.post('/api/auth/logout').catch(() => {});
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
