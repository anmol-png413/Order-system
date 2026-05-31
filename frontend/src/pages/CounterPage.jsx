import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { useSocket } from '../hooks/useSocket';
import { CheckCircle, Clock, Package, Bell } from 'lucide-react';

export default function CounterPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(() => {
    axios.get('/api/orders').then(res => setOrders(res.data))
      .catch(() => toast.error('Failed to load orders'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Auto-refresh every 30 seconds as backup
  useEffect(() => {
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  useSocket('counter', {
    'order-updated': (updated) => {
      if (updated.status === 'completed') {
        setOrders(prev => {
          const exists = prev.find(o => o._id === updated._id);
          if (exists) return prev.map(o => o._id === updated._id ? updated : o);
          return [updated, ...prev];
        });
        toast.success(`Token #${updated.tokenNumber} is ready!`, {
          duration: 8000,
          icon: '✅',
          style: { background: '#14532d', border: '1px solid #16a34a', color: '#bbf7d0' },
        });
      }
    },
  });

  const timeSince = (date) => {
    const mins = Math.floor((Date.now() - new Date(date)) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar title="Counter" subtitle="Completed orders for handover" />

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header stat */}
        <div className="flex items-center justify-between mb-6">
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl px-6 py-3 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-green-400 font-semibold" style={{ fontFamily: 'Sora, sans-serif' }}>
              {orders.length} ready for handover
            </span>
          </div>
          <p className="text-xs text-zinc-600">Last 2 hours · Auto-refreshes</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-24 text-zinc-600">
            <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No completed orders yet</p>
            <p className="text-sm mt-1">Completed orders will appear here automatically</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map(order => (
              <div key={order._id}
                className="card p-5 border-green-500/30 bg-green-500/5 animate-slide-up">
                {/* Token */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center shadow-xl shadow-green-900/30">
                      <span className="text-white font-extrabold text-2xl" style={{ fontFamily: 'Sora, sans-serif' }}>
                        #{order.tokenNumber}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Ready to collect</p>
                      <p className="text-xs text-green-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeSince(order.packedAt)}
                      </p>
                    </div>
                  </div>
                  <span className="badge-completed">Done</span>
                </div>

                {/* Items summary */}
                <div className="space-y-1.5 mb-4">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400 truncate max-w-[70%]">{item.name}</span>
                      <span className="text-zinc-300 font-medium">×{item.quantity}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-zinc-800 pt-3 flex items-center justify-between">
                  <span className="text-xs text-zinc-600">Total</span>
                  <span className="font-bold text-white" style={{ fontFamily: 'Sora, sans-serif' }}>
                    ₹{order.totalAmount.toFixed(2)}
                  </span>
                </div>

                {/* Handover indicator */}
                <div className="mt-3 flex items-center gap-2 bg-green-500/10 rounded-xl px-3 py-2">
                  <Bell className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-xs text-green-300 font-medium">Call Token #{order.tokenNumber}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
