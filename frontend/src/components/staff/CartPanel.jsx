import { ShoppingCart, Minus, Plus, Trash2, Tag, Users, CheckCircle } from 'lucide-react';
import { IMG_FALLBACK } from '../../utils/printUtils';

export default function CartPanel({
  cart, notes, setNotes,
  discountPercent, setDiscountPercent,
  changeQty, placeOrder, placing,
  cartCount, cartTotal, discountAmount, totalAfterDiscount,
  onClear,
  showBulkModal, setShowBulkModal,
  bulkPhone, bulkCustomerName,
}) {
  const DISCOUNT_PRESETS = [0, 5, 10, 15, 20];

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* ── Scrollable area: items + notes + discount + bulk ── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Items */}
        <div className="p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center min-h-[300px]">
              <div className="w-20 h-20 rounded-2xl bg-zinc-800 flex items-center justify-center mb-4">
                <ShoppingCart className="w-9 h-9 text-zinc-600" />
              </div>
              <p className="text-zinc-400 font-semibold text-base mb-1">Cart is empty</p>
              <p className="text-zinc-600 text-sm">Tap any product on the left to add it here</p>
            </div>
          ) : cart.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-zinc-800/60 rounded-xl p-2.5">
              <img src={item.image || IMG_FALLBACK} alt={item.name}
                className="w-12 h-12 rounded-lg object-cover bg-zinc-700 flex-shrink-0"
                onError={e => { e.target.src = IMG_FALLBACK; }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-200 truncate">{item.name}</p>
                <p className="text-xs text-zinc-500">{item.quantityLabel || (item.unit === 'piece' ? `${item.quantity} pcs` : `${item.quantity} kg`)}</p>
                <p className="text-xs text-orange-400 font-medium">₹{(item.price * item.quantity).toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => changeQty(idx, -1)} aria-label={`Decrease ${item.name} quantity`} className="w-9 h-9 rounded-lg bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center"><Minus className="w-3.5 h-3.5 text-zinc-300" aria-hidden="true" /></button>
                <span className="w-6 text-center text-sm font-bold text-white" aria-live="polite">{item.quantity}</span>
                <button onClick={() => changeQty(idx, 1)} aria-label={`Increase ${item.name} quantity`} className="w-9 h-9 rounded-lg bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center"><Plus className="w-3.5 h-3.5 text-zinc-300" aria-hidden="true" /></button>
              </div>
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <div className="px-3 pb-3 space-y-3">
            {/* Notes */}
            <label htmlFor="cart-notes" className="sr-only">Order notes</label>
            <textarea id="cart-notes" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Order notes (optional)..." rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500 resize-none" />

            {/* Discount */}
            <div className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/50">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Tag className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Discount</span>
              </div>
              <div className="flex gap-1.5 mb-2">
                {DISCOUNT_PRESETS.map(d => (
                  <button key={d} onClick={() => setDiscountPercent(d)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      discountPercent === d
                        ? 'bg-orange-500 text-white'
                        : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200'
                    }`}>
                    {d === 0 ? 'None' : `${d}%`}
                  </button>
                ))}
              </div>
              <div className="relative">
                <label htmlFor="cart-discount" className="sr-only">Custom discount percentage</label>
                <input
                  id="cart-discount"
                  type="number"
                  value={discountPercent === 0 ? '' : discountPercent}
                  onChange={e => {
                    const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                    setDiscountPercent(val);
                  }}
                  placeholder="Custom %"
                  min="0" max="100"
                  aria-label="Custom discount percentage"
                  className="w-full bg-zinc-700 border border-zinc-600 focus:border-orange-500 rounded-lg pl-3 pr-8 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-bold" aria-hidden="true">%</span>
              </div>
              {discountPercent > 0 && (
                <div className="mt-2 flex justify-between text-xs">
                  <span className="text-zinc-500">Saving</span>
                  <span className="text-green-400 font-semibold">- ₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Bulk Order Toggle */}
            <button
              onClick={() => setShowBulkModal(true)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-sm font-semibold ${
                showBulkModal
                  ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>Bulk / Advance Order</span>
              </div>
              <div className="flex items-center gap-2">
                {showBulkModal && (bulkCustomerName || bulkPhone) && (
                  <span className="text-xs text-purple-400 font-medium truncate max-w-[100px]">
                    {bulkCustomerName || bulkPhone}
                  </span>
                )}
                <div className={`w-8 h-4 rounded-full transition-colors relative ${showBulkModal ? 'bg-purple-500' : 'bg-zinc-700'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${showBulkModal ? 'left-4' : 'left-0.5'}`} />
                </div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* ── Fixed bottom: Total + Place Order — hamesha visible ── */}
      {cart.length > 0 && (
        <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-900 p-4 space-y-3">
          {/* Totals */}
          <div className="space-y-1">
            {discountPercent > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Subtotal</span>
                <span className="text-zinc-400 line-through">₹{cartTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-sm">
                {discountPercent > 0 ? `After ${discountPercent}% off` : 'Total'}
              </span>
              <span className="text-xl font-extrabold text-white" style={{ fontFamily: 'Sora, sans-serif' }}>
                ₹{totalAfterDiscount.toFixed(2)}
              </span>
            </div>
          </div>

          <button onClick={placeOrder} disabled={placing}
            className="w-full btn-primary py-4 text-base flex items-center justify-center gap-2 disabled:opacity-60">
            {placing
              ? <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
              : <><CheckCircle className="w-5 h-5" /> Place Order</>}
          </button>
          <button onClick={onClear} className="w-full flex items-center justify-center gap-1.5 text-zinc-600 hover:text-red-400 text-sm transition-colors py-1">
            <Trash2 className="w-3.5 h-3.5" /> Clear cart
          </button>
        </div>
      )}
    </div>
  );
}
