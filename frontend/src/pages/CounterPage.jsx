import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { CheckCircle, Clock, Package, Bell, Printer, ShoppingCart } from 'lucide-react';

const IMG_FALLBACK = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="%231a1a1a"/><text x="40" y="44" text-anchor="middle" font-size="28" fill="%23444">🍽️</text></svg>';

function fmtUnit(item) {
  if (item.unit === 'piece') return `${item.quantity} pcs`;
  if (item.quantityLabel) {
    return item.quantity > 1 ? `${item.quantityLabel} × ${item.quantity}` : item.quantityLabel;
  }
  return `${item.quantity} kg`;
}

function printSlip(order) {
  const now = new Date(order.packedAt || order.createdAt);
  const win = window.open('', '_blank', 'width=320,height=640');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Courier New',monospace;width:290px;margin:auto;padding:12px;font-size:13px}
    .center{text-align:center}.bold{font-weight:bold}
    .big{font-size:32px;font-weight:900;letter-spacing:2px}
    .line{border-top:1px dashed #555;margin:8px 0}
    table{width:100%;border-collapse:collapse}
    td{padding:3px 0;vertical-align:top}
    .right{text-align:right}
    .total-row td{font-weight:bold;font-size:15px;padding-top:6px}
  </style></head><body>
  <div class="center bold" style="font-size:20px;letter-spacing:1px">Green Sweets</div>
  <div class="center" style="font-size:11px">${now.toLocaleDateString('en-IN')} &nbsp; ${now.toLocaleTimeString('en-IN')}</div>
  <div class="line"></div>
  <div class="center bold" style="font-size:11px;letter-spacing:3px">TOKEN NUMBER</div>
  <div class="center big">#${order.tokenNumber}</div>
  <div class="line"></div>
  <table>
    <tr><td class="bold" style="font-size:11px">ITEM</td><td class="right bold" style="font-size:11px">AMT</td></tr>
    <tr><td colspan="2"><div class="line"></div></td></tr>
    ${order.items.map(i => `<tr>
      <td style="font-size:12px">${i.name}<br>
        <span style="color:#555;font-size:11px">${fmtUnit(i)} @ ₹${i.price.toFixed(2)}</span></td>
      <td class="right">₹${(i.price * i.quantity).toFixed(2)}</td>
    </tr>`).join('')}
    <tr><td colspan="2"><div class="line"></div></td></tr>
    <tr class="total-row"><td>TOTAL</td><td class="right">₹${order.totalAmount.toFixed(2)}</td></tr>
  </table>
  <div class="line"></div>
  <div class="center" style="font-size:12px;font-weight:bold">✓ READY FOR PICKUP</div>
  <div class="center" style="font-size:11px;margin-top:4px">Thank you! Visit again</div>
  </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 300);
}

export default function CounterPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingPaid, setMarkingPaid] = useState(null);

  const fetchOrders = useCallback((showError = false) => {
    axios.get('/api/orders').then(res =>
      setOrders(res.data.filter(o => o.status === 'completed'))
    ).catch(() => { if (showError) toast.error('Failed to load orders'); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchOrders(true);
    const interval = setInterval(() => fetchOrders(false), 3000);
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
          duration: 8000, icon: '✅',
          style: { background: '#14532d', border: '1px solid #16a34a', color: '#bbf7d0' },
        });
      }
    },
    'order-deleted': ({ _id }) => setOrders(prev => prev.filter(o => o._id !== _id)),
  });

  const markBalancePaid = async (orderId) => {
    setMarkingPaid(orderId);
    try {
      const res = await axios.patch(`/api/orders/${orderId}/mark-paid`);
      setOrders(prev => prev.map(o => o._id === orderId ? res.data : o));
      toast.success('Balance collected!', { icon: '💰' });
    } catch {
      toast.error('Failed to update');
    } finally {
      setMarkingPaid(null);
    }
  };

  const timeSince = (date) => {
    if (!date) return 'Just now';
    const mins = Math.floor((Date.now() - new Date(date)) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar title="Pickup Counter" subtitle="Completed orders for handover" />

      {/* Quick switcher */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex gap-2 overflow-x-auto">
        <button onClick={() => navigate('/staff')}
          className="flex-shrink-0 flex items-center gap-2 bg-zinc-800 hover:bg-orange-500/20 hover:text-orange-400 text-zinc-400 text-sm font-semibold px-4 py-2 rounded-xl transition-all border border-zinc-700">
          <ShoppingCart className="w-4 h-4" /> Counter
        </button>
        <button onClick={() => navigate('/packing')}
          className="flex-shrink-0 flex items-center gap-2 bg-zinc-800 hover:bg-blue-500/20 hover:text-blue-400 text-zinc-400 text-sm font-semibold px-4 py-2 rounded-xl transition-all border border-zinc-700">
          <Package className="w-4 h-4" /> Packing
        </button>
        <button className="flex-shrink-0 flex items-center gap-2 bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-xl" style={{ fontFamily: 'Sora, sans-serif' }}>
          <Bell className="w-4 h-4" /> Ready
        </button>
      </div>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-6" aria-label="Ready orders for pickup">
        {/* Header stat */}
        <div className="flex items-center justify-between mb-6">
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl px-5 py-3 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-green-400 font-semibold text-lg" style={{ fontFamily: 'Sora, sans-serif' }}>
              {orders.length} ready for pickup
            </span>
          </div>
          <p className="text-xs text-zinc-600 hidden sm:block">Last 2 hours · Auto-refreshes</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-24 text-zinc-600">
            <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-xl font-medium">No completed orders yet</p>
            <p className="text-sm mt-1">Completed orders appear here automatically</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map(order => (
              <div key={order._id} className="card p-5 border-green-500/30 bg-green-500/5 animate-slide-up">
                {/* Token — large green */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-20 bg-green-500 rounded-2xl flex items-center justify-center shadow-xl shadow-green-900/30 flex-shrink-0">
                      <span className="text-white font-extrabold text-3xl" style={{ fontFamily: 'Sora, sans-serif' }}>
                        #{order.tokenNumber}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Ready to collect</p>
                      <p className="text-sm text-green-400 font-semibold flex items-center gap-1 mt-0.5">
                        <Clock className="w-3.5 h-3.5" />
                        {timeSince(order.packedAt)}
                      </p>
                    </div>
                  </div>
                  <span className="badge-completed">Done</span>
                </div>

                {/* Items with image + name + unit */}
                <div className="space-y-1.5 mb-4">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-[30px] h-[30px] rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0">
                        <img
                          src={item.image || IMG_FALLBACK}
                          alt={item.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={e => { e.target.src = IMG_FALLBACK; }}
                        />
                      </div>
                      <span className="text-zinc-200 text-sm truncate flex-1">{item.name}</span>
                      <span className="text-orange-400 text-sm font-semibold flex-shrink-0">{fmtUnit(item)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-zinc-800 pt-3 flex items-center justify-between mb-3">
                  <span className="text-xs text-zinc-600">Total</span>
                  <span className="font-bold text-white text-lg" style={{ fontFamily: 'Sora, sans-serif' }}>
                    ₹{order.totalAmount.toFixed(2)}
                  </span>
                </div>

                {/* Bulk balance due */}
                {order.bulk?.balance > 0 && !order.bulk?.balancePaid && (
                  <div className="mb-3 bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-orange-300 font-semibold">Balance Due</p>
                      <p className="text-xl font-extrabold text-orange-400">₹{order.bulk.balance.toFixed(2)}</p>
                      {order.bulk.customerName && <p className="text-[11px] text-zinc-500 mt-0.5">{order.bulk.customerName}</p>}
                    </div>
                    <button
                      onClick={() => markBalancePaid(order._id)}
                      disabled={markingPaid === order._id}
                      className="bg-orange-500 hover:bg-orange-400 text-white text-sm font-bold px-4 py-3 rounded-xl min-h-[44px] transition-colors disabled:opacity-60 flex-shrink-0"
                    >
                      {markingPaid === order._id ? '…' : `Collect ₹${order.bulk.balance.toFixed(0)}`}
                    </button>
                  </div>
                )}
                {order.bulk?.balance > 0 && order.bulk?.balancePaid && (
                  <div className="mb-3 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-green-300 font-semibold">Balance Collected</span>
                  </div>
                )}

                {/* Call + Print */}
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center gap-2 bg-green-500/10 rounded-xl px-3 py-2.5">
                    <Bell className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-sm text-green-300 font-semibold">Call #{order.tokenNumber}</span>
                  </div>
                  <button onClick={() => printSlip(order)}
                    className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors min-h-[44px]">
                    <Printer className="w-4 h-4" /> Print
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
