import { X, Users, Phone, Wallet, Calendar } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';

export default function BulkOrderModal({
  onClose,
  bulkCustomerName, setBulkCustomerName,
  bulkPhone, setBulkPhone,
  bulkAdvance, setBulkAdvance,
  bulkSchedule, setBulkSchedule,
  cartTotal, discountPercent,
}) {
  const modalRef = useFocusTrap(onClose);

  const discount = +(cartTotal * (discountPercent / 100)).toFixed(2);
  const payable = +(cartTotal - discount).toFixed(2);
  const advance = parseFloat(bulkAdvance) || 0;
  const balance = +(payable - advance).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4" onClick={onClose}>
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-modal-title"
        className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-sm flex flex-col animate-slide-up"
        style={{ maxHeight: '90dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header — fixed, doesn't scroll */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-purple-500/10 flex-shrink-0 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-purple-400" aria-hidden="true" />
            </div>
            <div>
              <h3 id="bulk-modal-title" className="font-bold text-white text-base" style={{ fontFamily: 'Sora, sans-serif' }}>Bulk Order</h3>
              <p className="text-xs text-zinc-500">Advance booking details</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close bulk order modal" className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center justify-center text-zinc-400">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable form body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Customer Name */}
          <div>
            <label htmlFor="bulk-customer-name" className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
              <Users className="w-3 h-3" aria-hidden="true" /> Customer Name
            </label>
            <input
              id="bulk-customer-name"
              type="text"
              value={bulkCustomerName}
              onChange={e => setBulkCustomerName(e.target.value)}
              placeholder="e.g. Ramesh Sharma"
              className="w-full bg-zinc-800 border border-zinc-700 focus:border-purple-500 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none transition-colors"
            />
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="bulk-phone" className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
              <Phone className="w-3 h-3" aria-hidden="true" /> Customer Phone
            </label>
            <input
              id="bulk-phone"
              type="tel"
              value={bulkPhone}
              onChange={e => setBulkPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full bg-zinc-800 border border-zinc-700 focus:border-purple-500 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none transition-colors"
            />
          </div>

          {/* Advance */}
          <div>
            <label htmlFor="bulk-advance" className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
              <Wallet className="w-3 h-3" aria-hidden="true" /> Advance Payment
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold" aria-hidden="true">₹</span>
              <input
                id="bulk-advance"
                type="number"
                value={bulkAdvance}
                onChange={e => setBulkAdvance(e.target.value)}
                placeholder="0"
                min="0"
                aria-label="Advance payment in rupees"
                className="w-full bg-zinc-800 border border-zinc-700 focus:border-purple-500 rounded-xl pl-8 pr-4 py-3 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Schedule */}
          <div>
            <label htmlFor="bulk-schedule" className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
              <Calendar className="w-3 h-3" aria-hidden="true" /> Pickup / Delivery Schedule
            </label>
            <input
              id="bulk-schedule"
              type="date"
              value={bulkSchedule}
              onChange={e => setBulkSchedule(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full bg-zinc-800 border border-zinc-700 focus:border-purple-500 rounded-xl px-4 py-3 text-zinc-100 text-sm focus:outline-none transition-colors [color-scheme:dark]"
            />
          </div>

          {/* Summary card */}
          {advance > 0 && (
            <div className="bg-zinc-800/60 rounded-xl p-4 space-y-2 border border-zinc-700" aria-label="Payment summary">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Order Total</span>
                <span className="text-white font-semibold">₹{payable.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Advance Paid</span>
                <span className="text-green-400 font-semibold">- ₹{advance.toFixed(2)}</span>
              </div>
              <div className="border-t border-zinc-700 pt-2 flex justify-between">
                <span className="text-zinc-300 font-semibold">Balance Due</span>
                <span className={`font-bold text-base ${balance > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                  ₹{balance.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer — fixed at bottom, doesn't scroll */}
        <div className="px-5 pb-5 pt-3 border-t border-zinc-800 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition-colors"
            style={{ fontFamily: 'Sora, sans-serif' }}
          >
            Save Bulk Details
          </button>
        </div>
      </div>
    </div>
  );
}
