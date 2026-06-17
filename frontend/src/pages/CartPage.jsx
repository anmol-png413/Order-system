import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag, CheckCircle } from 'lucide-react';
import { useCart } from '../context/CartContext';

const IMG_FALLBACK = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="%231a1a1a"/><text x="40" y="46" text-anchor="middle" font-size="28" fill="%23444">🍽️</text></svg>';

export default function CartPage() {
  const navigate = useNavigate();
  const { cart, updateQty, removeItem, clearCart, totalAmount } = useCart();
  const [placing, setPlacing] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setPlacing(true);
    try {
      const items = cart.map(item => ({
        product: item._id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image || '',
      }));
      const res = await axios.post('/api/orders', { items, notes: '' });
      clearCart();
      setSuccessOrder(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place order. Try again.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-white text-lg leading-tight" style={{ fontFamily: 'Sora, sans-serif' }}>Your Cart</h1>
            {cart.length > 0 && (
              <p className="text-zinc-600 text-xs">{cart.length} item{cart.length !== 1 ? 's' : ''}</p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {cart.length === 0 ? (
          <div className="text-center py-32">
            <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-zinc-800" />
            <p className="text-zinc-500 text-lg mb-2">Your cart is empty</p>
            <p className="text-zinc-700 text-sm mb-6">Add items from the menu to get started</p>
            <button onClick={() => navigate('/')} className="btn-primary">
              Browse Menu
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Cart Items */}
            {cart.map(item => (
              <div key={item._id} className="card p-4 flex gap-4 items-start">
                <div className="w-20 h-20 rounded-xl bg-zinc-800 overflow-hidden flex-shrink-0">
                  <img
                    src={item.image || IMG_FALLBACK}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={e => { e.target.src = IMG_FALLBACK; }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <h3 className="font-semibold text-zinc-200 text-sm leading-snug" style={{ fontFamily: 'Sora, sans-serif' }}>
                      {item.name}
                    </h3>
                    <button
                      onClick={() => removeItem(item._id)}
                      className="text-zinc-700 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-zinc-600 text-xs mb-3">₹{item.price.toFixed(2)} each</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 bg-zinc-800 rounded-lg p-0.5">
                      <button
                        onClick={() => updateQty(item._id, item.quantity - 1)}
                        aria-label={`Decrease ${item.name} quantity`}
                        className="w-9 h-9 rounded-md hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <span className="text-white font-semibold text-sm w-5 text-center" aria-live="polite">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item._id, item.quantity + 1)}
                        aria-label={`Increase ${item.name} quantity`}
                        className="w-9 h-9 rounded-md hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                    <p className="text-orange-400 font-bold text-sm" style={{ fontFamily: 'Sora, sans-serif' }}>
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Order Summary + CTA */}
            <div className="card p-5 mt-2">
              <div className="space-y-2 mb-4">
                {cart.map(item => (
                  <div key={item._id} className="flex justify-between text-xs text-zinc-600">
                    <span>{item.name} × {item.quantity}</span>
                    <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-zinc-800 pt-4 flex items-center justify-between mb-5">
                <span className="text-zinc-300 font-semibold">Grand Total</span>
                <span className="text-2xl font-extrabold text-orange-400" style={{ fontFamily: 'Sora, sans-serif' }}>
                  ₹{totalAmount.toFixed(2)}
                </span>
              </div>
              <button
                onClick={placeOrder}
                disabled={placing}
                className="w-full btn-primary py-3.5 text-base disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {placing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Placing Order…
                  </span>
                ) : 'Place Order'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Success Modal */}
      {successOrder && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm text-center animate-pop shadow-2xl">
            {/* Token */}
            <div className="flex justify-center mb-4">
              <div className="token-chip">{successOrder.tokenNumber}</div>
            </div>
            <div className="flex items-center justify-center gap-2 mb-1">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Sora, sans-serif' }}>Order Placed!</h2>
            </div>
            <p className="text-zinc-500 text-sm mb-5">
              Show token <span className="text-orange-400 font-bold text-base">#{successOrder.tokenNumber}</span> to collect your order
            </p>

            {/* Order Summary */}
            <div className="bg-zinc-800/50 rounded-xl p-4 mb-5 text-left space-y-2">
              {successOrder.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-zinc-400 truncate pr-2">{item.name} × {item.quantity}</span>
                  <span className="text-zinc-300 flex-shrink-0">₹{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-zinc-700 pt-2 mt-2 flex justify-between font-semibold">
                <span className="text-zinc-300">Total</span>
                <span className="text-orange-400">₹{successOrder.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => { setSuccessOrder(null); navigate('/'); }}
              className="w-full btn-primary py-3"
            >
              Back to Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
