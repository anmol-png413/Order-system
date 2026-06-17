import { X, Package, Bell, Clock, Trash2, Users, Phone, Calendar, Wallet, CheckCircle } from 'lucide-react';
import { IMG_FALLBACK, fmtQty } from '../../utils/printUtils';
import useFocusTrap from '../../hooks/useFocusTrap';

export default function StatusModal({ type, orders, onClose, onDelete, deleting, onMarkPaid, markingPaid }) {
  const modalRef = useFocusTrap(onClose);
  const isPacking = type === 'packing';
  const filtered = isPacking
    ? orders.filter(o => o.status === 'pending' || o.status === 'in-progress')
    : orders.filter(o => o.status === 'completed');

  const timeSince = (date) => {
    const mins = Math.floor((Date.now() - new Date(date)) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  const statusLabel = (status) => {
    if (status === 'completed') return 'Ready for pickup';
    if (status === 'in-progress') return 'Currently packing';
    return 'Pending';
  };

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-modal-title"
      className="fixed inset-0 z-50 bg-black/90 flex flex-col"
    >
      <div className={`flex items-center justify-between px-4 py-4 border-b border-zinc-800 ${isPacking ? 'bg-blue-500/10' : 'bg-green-500/10'}`}>
        <div className="flex items-center gap-3">
          {isPacking
            ? <Package className="w-6 h-6 text-blue-400" aria-hidden="true" />
            : <Bell className="w-6 h-6 text-green-400" aria-hidden="true" />}
          <h2 id="status-modal-title" className="text-xl font-bold text-white" style={{ fontFamily: 'Sora, sans-serif' }}>
            {isPacking ? 'Packing Status' : 'Ready for Pickup'}
          </h2>
          <span
            className={`text-sm font-bold px-2.5 py-1 rounded-full ${isPacking ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300'}`}
            aria-label={`${filtered.length} orders`}
          >
            {filtered.length}
          </span>
        </div>
        <button onClick={onClose} aria-label="Close status panel" className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 rounded-xl flex items-center justify-center text-zinc-300">
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600 py-16">
            {isPacking
              ? <Package className="w-16 h-16 mb-4 opacity-20" aria-hidden="true" />
              : <Bell className="w-16 h-16 mb-4 opacity-20" aria-hidden="true" />}
            <p className="text-lg">{isPacking ? 'No orders in queue' : 'No orders ready yet'}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(order => (
              <div key={order._id} className={`rounded-2xl border overflow-hidden ${
                order.status === 'completed' ? 'border-green-500/30 bg-green-500/5'
                : order.status === 'in-progress' ? 'border-blue-500/30 bg-blue-500/5'
                : 'border-zinc-700 bg-zinc-900'
              }`}>
                <div
                  className={`px-4 py-2 flex items-center justify-between text-sm font-bold ${
                    order.status === 'completed' ? 'bg-green-500 text-white'
                    : order.status === 'in-progress' ? 'bg-blue-500 text-white'
                    : 'bg-yellow-500 text-zinc-900'
                  }`}
                  aria-label={statusLabel(order.status)}
                >
                  <span aria-hidden="true">
                    {order.status === 'completed' ? '✓ READY' : order.status === 'in-progress' ? '⚙ PACKING' : '⏳ PENDING'}
                  </span>
                  <span className="text-xs opacity-80">
                    {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-4xl font-extrabold text-white" style={{ fontFamily: 'Sora, sans-serif' }}>
                      #{order.tokenNumber}
                    </div>
                    {!isPacking && (
                      <button
                        onClick={() => onDelete(order._id, order.tokenNumber)}
                        disabled={deleting === order._id}
                        aria-label={`Delete order #${order.tokenNumber}`}
                        className="w-9 h-9 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl transition-all disabled:opacity-50 flex-shrink-0"
                      >
                        {deleting === order._id
                          ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" aria-label="Deleting…" />
                          : <Trash2 className="w-4 h-4" aria-hidden="true" />}
                      </button>
                    )}
                  </div>

                  {order.packedAt && (
                    <p className="text-xs text-green-400 flex items-center gap-1 mb-2">
                      <Clock className="w-3 h-3" aria-hidden="true" />{timeSince(order.packedAt)}
                    </p>
                  )}

                  {/* Bulk badge */}
                  {(order.bulk?.phone || order.bulk?.customerName) && (
                    <div className="mb-2 bg-purple-500/10 border border-purple-500/20 rounded-lg px-2 py-1.5 space-y-1">
                      {order.bulk.customerName && (
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3 h-3 text-purple-400 flex-shrink-0" aria-hidden="true" />
                          <span className="text-xs text-purple-200 font-semibold">{order.bulk.customerName}</span>
                        </div>
                      )}
                      {order.bulk.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-purple-400 flex-shrink-0" aria-hidden="true" />
                          <span className="text-xs text-purple-300 font-medium">{order.bulk.phone}</span>
                        </div>
                      )}
                      {order.bulk.schedule && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-orange-400 flex-shrink-0" aria-hidden="true" />
                          <span className="text-xs text-orange-300 font-semibold">
                            {new Date(order.bulk.schedule).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      )}
                      {order.bulk.advance > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Wallet className="w-3 h-3 text-green-400 flex-shrink-0" aria-hidden="true" />
                          <span className="text-xs text-green-300">Advance: ₹{order.bulk.advance?.toFixed(2)}</span>
                          {order.bulk.balance > 0 && !order.bulk.balancePaid && (
                            <span className="text-xs text-yellow-300">| Due: ₹{order.bulk.balance?.toFixed(2)}</span>
                          )}
                          {order.bulk.balancePaid && (
                            <span className="text-xs text-green-400 flex items-center gap-0.5"><CheckCircle className="w-3 h-3" aria-hidden="true" /> Paid</span>
                          )}
                        </div>
                      )}
                      {/* Collect balance button — shown on ready-for-pickup completed orders */}
                      {!isPacking && order.bulk?.balance > 0 && !order.bulk?.balancePaid && onMarkPaid && (
                        <button
                          onClick={() => onMarkPaid(order._id)}
                          disabled={markingPaid === order._id}
                          className="mt-1 w-full text-xs font-bold bg-orange-500 hover:bg-orange-400 text-white py-2 rounded-lg transition-colors disabled:opacity-60"
                        >
                          {markingPaid === order._id ? '…' : `Collect ₹${order.bulk.balance.toFixed(0)}`}
                        </button>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-[30px] h-[30px] rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0">
                          <img src={item.image || IMG_FALLBACK} alt={item.name} loading="lazy"
                            className="w-full h-full object-cover"
                            onError={e => { e.target.src = IMG_FALLBACK; }} />
                        </div>
                        <span className="text-zinc-300 text-sm truncate flex-1">{item.name}</span>
                        <span className="text-zinc-500 text-sm flex-shrink-0">
                          {fmtQty(item.quantity, item.quantityLabel, item.unit)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
