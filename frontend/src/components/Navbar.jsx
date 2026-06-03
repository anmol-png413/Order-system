import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, LogOut, User } from 'lucide-react';
import toast from 'react-hot-toast';

const ROLE_COLORS = {
  admin: 'text-purple-400',
  staff: 'text-orange-400',
  packing: 'text-blue-400',
  counter: 'text-green-400',
};

export default function Navbar({ title, subtitle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur border-b border-zinc-800" role="banner">
      <nav className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4" aria-label="Main navigation">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0" aria-hidden="true">
            <ShoppingBag className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="font-bold text-white leading-none text-lg" style={{ fontFamily: 'Sora, sans-serif' }}>
              {title}
            </h1>
            {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <div className="hidden sm:flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5" aria-label={`Logged in as ${user.name}, role: ${user.role}`}>
              <User className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
              <span className="text-sm text-zinc-300">{user.name}</span>
              <span className={`text-xs font-semibold uppercase tracking-wide ${ROLE_COLORS[user.role]}`}>
                {user.role}
              </span>
            </div>
          )}
          <button
            onClick={handleLogout}
            aria-label="Logout"
            className="flex items-center gap-1.5 text-zinc-500 hover:text-red-400 transition-colors text-sm px-3 py-2 rounded-xl hover:bg-red-500/10"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </nav>
    </header>
  );
}
