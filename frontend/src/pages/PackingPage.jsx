import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import { Bell, CheckCircle, Loader2, Package, Clock } from 'lucide-react';

const STATUS_CONFIG = {
  pending: {
    label: 'NEW',
    banner: 'bg-yellow-400',
    bannerText: 'text-yellow-950',
    Icon: Bell,
    btn: 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-900/30',
    btnLabel: 'Mark Packing',
  },
  'in-progress': {
    label: 'PACKING',
    banner: 'bg-blue-500',
    bannerText: 'text-white',
    Icon: Loader2,
    btn: 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-900/30',
    btnLabel: 'Mark Complete',
  },
  completed: {
    label: 'READY',
    banner: 'bg-green-500',
    bannerText: 'text-white',
    Icon: CheckCircle,
    btn: null,
    btnLabel: null,
  },
};

const STATUS_SORT = { 'in-progress': 0, pending: 1, completed: 2 };

function elapsed(createdAt, now) {
  const secs = Math.floor((now - new Date(createdAt)) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}

export default function PackingPage() {
  const { user } = useAuth();
  const canUpdate = user?.role === 'packing' || user?.role === 'admin';
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const fetchOrders = useCallback(() => {
    axios.get('/api/orders')
      .then(res => setOrders(res.data))
      .catch(() => toast.error('Failed to fetch orders'))
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
      setOrders(prev => prev.map(o => o._id === updated._id ? updated : o));
    },
  });

  const updateStatus = async (order) => {
    const next = { pending: 'in-progress', 'in-progress': 'completed' };
    const newStatus = next[order.status];
    if (!newStatus) return;
    setUpdating(order._id);
    try {
      await axios.patch(`/api/orders/${order._id}/status`, { status: newStatus });
      setOrders(prev => prev.map(o => o._id === order._id ? { ...o, status: newStatus } : o));
      if (newStatus === 'completed') toast.success(`Token #${order.tokenNumber} ready! ✓`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdating(null);
    }
  };

  const counts = {
    all: orders.length,
    new: orders.filter(o => o.status === 'pending').length,
    packing: orders.filter(o => o.status === 'in-progress').length,
    ready: orders.filter(o => o.status === 'completed').length,
  };

  const filtered = orders
    .filter(o => {
      if (activeFilter === 'new') return o.status === 'pending';
      if (activeFilter === 'packing') return o.status === 'in-progress';
      if (activeFilter === 'ready') return o.status === 'completed';
      return true;
    })
    .sort((a, b) => (STATUS_SORT[a.status] ?? 3) - (STATUS_SORT[b.status] ?? 3));

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'New' },
    { key: 'packing', label: 'Packing' },
    { key: 'ready', label: 'Ready' },
  ];

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar title="Packing Station" subtitle="Real-time order queue" />

      {/* Filter tabs */}
      <div className="sticky top-16 z-30 bg-zinc-950 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 py-2 overflow-x-auto">
            {FILTERS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all flex-shrink-0 ${
                  activeFilter === tab.key
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-900/30'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                style={{ fontFamily: 'Sora, sans-serif' }}
              >
                {tab.label}
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md min-w-[20px] text-center ${
                  activeFilter === tab.key ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-500'
                }`}>
                  {counts[tab.key]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-zinc-600">
            <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No orders here</p>
            <p className="text-sm mt-1">New orders will appear instantly via socket</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(order => {
              const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
              const { Icon } = cfg;
              return (
                <div key={order._id} className="card overflow-hidden animate-slide-up">
                  {/* Colored status banner */}
                  <div className={`${cfg.banner} ${cfg.bannerText} px-4 py-2.5 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 flex-shrink-0 ${order.status === 'in-progress' ? 'animate-spin' : ''}`} />
                      <span className="font-bold text-sm tracking-wider" style={{ fontFamily: 'Sora, sans-serif' }}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-semibold opacity-80">
                      <Clock className="w-3 h-3" />
                      {elapsed(order.createdAt, now)}
                    </div>
                  </div>

                  <div className="p-4">
                    {/* Token + amount */}
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className="text-4xl font-extrabold text-white leading-none"
                        style={{ fontFamily: 'Sora, sans-serif' }}
                      >
                        #{order.tokenNumber}
                      </div>
                      <div className="text-right">
                        <p className="text-orange-400 font-bold text-sm">₹{order.totalAmount?.toFixed(2)}</p>
                        <p className="text-zinc-600 text-xs mt-0.5">
                          {order.createdBy?.name || 'Customer'}
                        </p>
                      </div>
                    </div>

                    {/* Items list */}
                    <div className="space-y-2 mb-4">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-zinc-800 flex-shrink-0 overflow-hidden">
                            {item.image && (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-full h-full object-cover"
                                onError={e => { e.target.style.display = 'none'; }}
                              />
                            )}
                          </div>
                          <p className="flex-1 text-sm text-zinc-300 truncate">{item.name}</p>
                          <span className="text-sm font-bold text-white bg-zinc-800 px-2 py-0.5 rounded-lg flex-shrink-0">
                            ×{item.quantity}
                          </span>
                        </div>
                      ))}
                    </div>

                    {order.notes && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2 mb-4">
                        <p className="text-xs text-yellow-300">📝 {order.notes}</p>
                      </div>
                    )}

                    {/* Action button — only packing/admin can change status */}
                    {canUpdate && cfg.btn ? (
                      <button
                        onClick={() => updateStatus(order)}
                        disabled={updating === order._id}
                        className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60 ${cfg.btn}`}
                        style={{ fontFamily: 'Sora, sans-serif' }}
                      >
                        {updating === order._id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <><CheckCircle className="w-4 h-4" /> {cfg.btnLabel}</>
                        )}
                      </button>
                    ) : !cfg.btn ? (
                      <div className="w-full py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-semibold text-center"
                        style={{ fontFamily: 'Sora, sans-serif' }}>
                        ✓ Ready for Pickup
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
