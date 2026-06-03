import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { Bell, CheckCircle, Loader2, Package, Clock, ShoppingCart } from 'lucide-react';

const IMG_FALLBACK = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="%231a1a1a"/><text x="40" y="44" text-anchor="middle" font-size="28" fill="%23444">🍽️</text></svg>';

function fmtUnit(item) {
  if (item.quantityLabel) return item.quantityLabel;
  if (item.unit === 'piece') return `${item.quantity} pcs`;
  return `${item.quantity} kg`;
}

export default function PackingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canUpdate = user?.role === 'packing' || user?.role === 'admin';
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [filter, setFilter] = useState('all');
  const [now, setNow] = useState(Date.now());

  // Live timer
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = (createdAt) => {
    const secs = Math.floor((now - new Date(createdAt)) / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h`;
  };

  const fetchOrders = useCallback(() => {
    axios.get('/api/orders').then(res => {
      // Only show pending and in-progress
      setOrders(res.data.filter(o => o.status !== 'completed'));
    }).catch(() => toast.error('Failed to fetch orders'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useSocket('packing', {
    'new-order': (order) => {
      setOrders(prev => [order, ...prev]);
      toast.success(`New order! Token #${order.tokenNumber}`, { duration: 5000, icon: '🔔' });
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } catch {}
    },
    'order-updated': (updated) => {
      if (updated.status === 'completed') {
        // Auto-remove completed orders
        setOrders(prev => prev.filter(o => o._id !== updated._id));
        toast.success(`Token #${updated.tokenNumber} ready for pickup!`, { icon: '✅' });
      } else {
        setOrders(prev => prev.map(o => o._id === updated._id ? updated : o));
      }
    },
  });

  const updateStatus = async (order) => {
    const next = { pending: 'in-progress', 'in-progress': 'completed' };
    const newStatus = next[order.status];
    if (!newStatus) return;
    setUpdating(order._id);
    try {
      await axios.patch(`/api/orders/${order._id}/status`, { status: newStatus });
      if (newStatus === 'completed') {
        setOrders(prev => prev.filter(o => o._id !== order._id));
        toast.success(`Token #${order.tokenNumber} marked complete!`);
      } else {
        setOrders(prev => prev.map(o => o._id === order._id ? { ...o, status: newStatus } : o));
      }
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdating(null);
    }
  };

  const pending = orders.filter(o => o.status === 'pending');
  const inProgress = orders.filter(o => o.status === 'in-progress');

  const displayed = filter === 'all' ? orders
    : filter === 'new' ? pending
    : inProgress;

  const sorted = [...displayed].sort((a, b) => {
    const ord = { 'in-progress': 0, pending: 1 };
    return (ord[a.status] ?? 2) - (ord[b.status] ?? 2);
  });

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar title="Packing Area" subtitle="Real-time order queue" />

      {/* Combined nav + filter tabs — single row */}
      <div className="sticky top-16 z-30 bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex items-center justify-between gap-2">
        {/* Left: page navigation */}
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => navigate('/staff')}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-orange-500/20 hover:text-orange-400 text-zinc-400 text-sm font-semibold px-3 py-2 rounded-xl transition-all border border-zinc-700">
            <ShoppingCart className="w-4 h-4" /> Counter
          </button>
          <button className="flex items-center gap-1.5 bg-blue-500 text-white text-sm font-semibold px-3 py-2 rounded-xl" style={{ fontFamily: 'Sora, sans-serif' }}>
            <Package className="w-4 h-4" /> Packing
          </button>
          <button onClick={() => navigate('/counter')}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-green-500/20 hover:text-green-400 text-zinc-400 text-sm font-semibold px-3 py-2 rounded-xl transition-all border border-zinc-700">
            <Bell className="w-4 h-4" /> Ready
          </button>
        </div>

        {/* Right: filter tabs */}
        <div className="flex gap-1 flex-shrink-0">
          {[
            { key: 'all', label: 'All', count: orders.length },
            { key: 'new', label: 'New', count: pending.length },
            { key: 'packing', label: 'Packing', count: inProgress.length },
          ].map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                filter === tab.key ? 'bg-orange-500 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`} style={{ fontFamily: 'Sora, sans-serif' }}>
              {tab.label}
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${filter === tab.key ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-3" aria-label="Packing orders">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-24 text-zinc-600">
            <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-xl font-medium">No orders in queue</p>
            <p className="text-sm mt-1">New orders appear here instantly</p>
          </div>
        ) : (
          <div className="space-y-0 divide-y divide-zinc-800">
            {sorted.map(order => {
              const isPending = order.status === 'pending';
              const isInProgress = order.status === 'in-progress';
              return (
                <div key={order._id}
                  className={`flex overflow-hidden animate-slide-up ${
                    isInProgress ? 'bg-yellow-500/5' : isPending ? 'bg-zinc-900' : 'bg-green-500/5'
                  }`}>

                  {/* LEFT — Token + time */}
                  <div className={`flex flex-col items-center justify-center px-2.5 py-2 min-w-[58px] flex-shrink-0 ${
                    isInProgress ? 'bg-yellow-500' : isPending ? 'bg-zinc-800' : 'bg-green-500'
                  }`}>
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${isInProgress ? 'text-yellow-900' : isPending ? 'text-zinc-500' : 'text-green-900'}`}>
                      TOKEN
                    </span>
                    <span className={`text-2xl font-black leading-none ${isInProgress ? 'text-yellow-950' : isPending ? 'text-white' : 'text-green-950'}`}
                      style={{ fontFamily: 'Sora, sans-serif' }}>
                      {order.tokenNumber}
                    </span>
                    <div className={`flex items-center gap-0.5 text-[9px] font-semibold mt-0.5 ${isInProgress ? 'text-yellow-800' : isPending ? 'text-zinc-500' : 'text-green-800'}`}>
                      <Clock className="w-2.5 h-2.5" />
                      {elapsed(order.createdAt)}
                    </div>
                  </div>

                  {/* RIGHT — Status + items + action */}
                  <div className="flex-1 min-w-0">
                    {/* Status header row */}
                    <div className={`flex items-center justify-between px-3 py-1.5 border-b ${
                      isInProgress ? 'border-yellow-500/30 bg-yellow-500/10'
                      : isPending ? 'border-zinc-800 bg-zinc-800/50'
                      : 'border-green-500/20 bg-green-500/10'
                    }`}>
                      <div className="flex items-center gap-1.5">
                        {isInProgress
                          ? <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />
                          : isPending
                            ? <Bell className="w-3 h-3 text-zinc-400" />
                            : <CheckCircle className="w-3 h-3 text-green-400" />}
                        <span className={`text-[11px] font-bold tracking-wide ${
                          isInProgress ? 'text-yellow-300' : isPending ? 'text-zinc-300' : 'text-green-300'
                        }`}>
                          {isInProgress ? 'IN PROGRESS' : isPending ? 'PENDING' : 'DONE'}
                        </span>
                      </div>

                      {/* Action button */}
                      {canUpdate ? (
                        <button
                          onClick={() => updateStatus(order)}
                          disabled={updating === order._id}
                          className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all active:scale-95 disabled:opacity-50 ${
                            isPending
                              ? 'bg-blue-500 hover:bg-blue-400 text-white'
                              : isInProgress
                                ? 'bg-green-500 hover:bg-green-400 text-white'
                                : 'bg-zinc-700 text-zinc-400'
                          }`}
                        >
                          {updating === order._id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : isPending
                              ? <><Package className="w-3 h-3" /> TAP TO START</>
                              : isInProgress
                                ? <><CheckCircle className="w-3 h-3" /> TAP TO FINISH</>
                                : 'COMPLETED'
                          }
                        </button>
                      ) : (
                        <span className="text-[11px] text-zinc-600 font-medium">View only</span>
                      )}
                    </div>

                    {/* Products horizontal scroll */}
                    <div className="flex gap-2 px-3 py-2 overflow-x-auto">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex flex-col items-center flex-shrink-0 w-16">
                          <div className="w-16 h-16 rounded-xl bg-zinc-800 overflow-hidden mb-1">
                            <img
                              src={item.image || IMG_FALLBACK}
                              alt={item.name}
                              loading="lazy"
                              width="48" height="48"
                              className="w-full h-full object-cover"
                              onError={e => { e.target.src = IMG_FALLBACK; }}
                            />
                          </div>
                          <p className="text-zinc-200 text-[11px] font-semibold text-center leading-tight line-clamp-2 w-full">{item.name}</p>
                          <p className="text-orange-400 text-[11px] font-bold mt-0.5">{fmtUnit(item)}</p>
                        </div>
                      ))}
                    </div>

                    {order.notes && (
                      <div className="mx-3 mb-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-2.5 py-1.5">
                        <p className="text-xs text-yellow-300">📝 {order.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
