import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { useSocket } from '../hooks/useSocket';
import { Plus, Minus, Trash2, ShoppingCart, CheckCircle, X, Search, Printer, Clock } from 'lucide-react';

const IMG_FALLBACK = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="%231a1a1a"/><text x="40" y="44" text-anchor="middle" font-size="28" fill="%23444">🍽️</text></svg>';

function printSlip(tokenNumber, items, notes) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN');
  const timeStr = now.toLocaleTimeString('en-IN');
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  const win = window.open('', '_blank', 'width=320,height=600');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Courier New',monospace;width:290px;margin:auto;padding:12px;font-size:13px;color:#000}
    .center{text-align:center}.bold{font-weight:bold}
    .big{font-size:28px;font-weight:900}
    .line{border-top:1px dashed #555;margin:8px 0}
    table{width:100%;border-collapse:collapse}
    td{padding:3px 0;vertical-align:top}
    .right{text-align:right}
    .item-name{font-size:12px}
    .total-row td{font-weight:bold;font-size:14px;padding-top:6px}
  </style></head><body>
  <div class="center bold" style="font-size:18px">OrderFlow</div>
  <div class="center" style="font-size:11px">${dateStr} &nbsp; ${timeStr}</div>
  <div class="line"></div>
  <div class="center bold" style="font-size:11px;letter-spacing:2px">TOKEN NUMBER</div>
  <div class="center big">#${tokenNumber}</div>
  <div class="line"></div>
  <table>
    <tr><td class="bold" style="font-size:11px">ITEM</td><td class="right bold" style="font-size:11px">AMOUNT</td></tr>
    <tr><td colspan="2"><div class="line"></div></td></tr>
    ${items.map(i => `
    <tr>
      <td class="item-name">${i.name}${i.quantityLabel ? ' <span style="color:#666">('+i.quantityLabel+')</span>' : ''}<br>
        <span style="color:#666;font-size:11px">x${i.quantity} @ ₹${i.price.toFixed(2)}</span>
      </td>
      <td class="right">₹${(i.price * i.quantity).toFixed(2)}</td>
    </tr>`).join('')}
    <tr><td colspan="2"><div class="line"></div></td></tr>
    <tr class="total-row"><td>TOTAL</td><td class="right">₹${total.toFixed(2)}</td></tr>
  </table>
  ${notes ? `<div class="line"></div><div style="font-size:11px">Note: ${notes}</div>` : ''}
  <div class="line"></div>
  <div class="center" style="font-size:11px">Thank you! Come again ✓</div>
  </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 300);
}

export default function StaffPage() {
  const [view, setView] = useState('order'); // 'order' | 'ready'
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [readyOrders, setReadyOrders] = useState([]);
  const [readyLoading, setReadyLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // Product modal state
  const [modalProduct, setModalProduct] = useState(null);
  const [modalQty, setModalQty] = useState(1);
  const [modalQtyLabel, setModalQtyLabel] = useState('');

  useEffect(() => {
    axios.get('/api/products').then(res => {
      setProducts(res.data);
      setCategories(['All', ...new Set(res.data.map(p => p.category))]);
    }).catch(() => toast.error('Failed to load products'))
      .finally(() => setLoading(false));
  }, []);

  const fetchReadyOrders = useCallback(() => {
    setReadyLoading(true);
    axios.get('/api/orders')
      .then(res => setReadyOrders(res.data.filter(o => o.status === 'completed')))
      .catch(() => toast.error('Failed to load ready orders'))
      .finally(() => setReadyLoading(false));
  }, []);

  useEffect(() => {
    if (view === 'ready') fetchReadyOrders();
  }, [view, fetchReadyOrders]);

  useSocket('staff', {
    'order-updated': (updated) => {
      if (updated.status === 'completed') {
        setReadyOrders(prev => {
          const exists = prev.find(o => o._id === updated._id);
          if (exists) return prev.map(o => o._id === updated._id ? updated : o);
          return [updated, ...prev];
        });
      }
    },
    'order-deleted': ({ _id }) => {
      setReadyOrders(prev => prev.filter(o => o._id !== _id));
    },
  });

  const deleteOrder = async (orderId, tokenNumber) => {
    setDeleting(orderId);
    try {
      await axios.delete(`/api/orders/${orderId}`);
      setReadyOrders(prev => prev.filter(o => o._id !== orderId));
      toast.success(`Token #${tokenNumber} deleted`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const timeSince = (date) => {
    const mins = Math.floor((Date.now() - new Date(date)) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  const filtered = products.filter(p => {
    const inCat = activeCategory === 'All' || p.category === activeCategory;
    const inSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return inCat && inSearch;
  });

  const openModal = (product) => {
    setModalProduct(product);
    setModalQty(1);
    setModalQtyLabel('');
  };

  const addFromModal = () => {
    const item = {
      product: modalProduct._id,
      name: modalProduct.name,
      price: modalProduct.price,
      image: modalProduct.image,
      quantity: modalQty,
      quantityLabel: modalQtyLabel.trim(),
    };
    setCart(prev => {
      const key = `${item.product}-${item.quantityLabel}`;
      const existing = prev.find(i => `${i.product}-${i.quantityLabel}` === key);
      if (existing) {
        return prev.map(i => `${i.product}-${i.quantityLabel}` === key
          ? { ...i, quantity: i.quantity + item.quantity }
          : i);
      }
      return [...prev, item];
    });
    toast.success(`${modalProduct.name}${modalQtyLabel ? ` (${modalQtyLabel})` : ''} added`);
    setModalProduct(null);
  };

  const changeQty = (idx, delta) => {
    setCart(prev => prev.map((i, n) => n === idx
      ? { ...i, quantity: Math.max(0, i.quantity + delta) }
      : i).filter(i => i.quantity > 0));
  };

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const getCartQty = (id) => cart.filter(i => i.product === id).reduce((s, i) => s + i.quantity, 0);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setPlacing(true);
    try {
      const res = await axios.post('/api/orders', { items: cart, notes });
      setSuccessData({ token: res.data.tokenNumber, items: [...cart], notes });
      setCart([]);
      setNotes('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <Navbar title="OrderFlow" subtitle="Staff — Order Taking" />

      {/* Tab toggle */}
      <div className="sticky top-16 z-30 bg-zinc-950 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 py-2">
            <button
              onClick={() => setView('order')}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${view === 'order' ? 'bg-orange-500 text-white shadow-lg shadow-orange-900/30' : 'text-zinc-400 hover:text-zinc-200'}`}
              style={{ fontFamily: 'Sora, sans-serif' }}
            >
              New Order
            </button>
            <button
              onClick={() => setView('ready')}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${view === 'ready' ? 'bg-orange-500 text-white shadow-lg shadow-orange-900/30' : 'text-zinc-400 hover:text-zinc-200'}`}
              style={{ fontFamily: 'Sora, sans-serif' }}
            >
              Ready Orders
              {readyOrders.length > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md min-w-[20px] text-center ${view === 'ready' ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                  {readyOrders.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {successData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-orange-500 to-pink-500" />
          <button
            onClick={() => setSuccessData(null)}
            className="absolute top-5 right-5 w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="relative text-center max-w-xs w-full animate-pop">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-5">
              <div className="w-16 h-16 bg-white/25 rounded-full flex items-center justify-center">
                <CheckCircle className="w-9 h-9 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <p className="text-white/80 text-xs font-bold uppercase tracking-widest mb-1">Order Placed</p>
            <div className="text-white font-extrabold leading-none mb-2" style={{ fontFamily: 'Sora, sans-serif', fontSize: '80px' }}>
              #{successData.token}
            </div>
            <p className="text-white/70 text-sm mb-6">Sent to packing 📦</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => printSlip(successData.token, successData.items, successData.notes)}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 border border-white/30 text-white font-semibold px-5 py-3 rounded-xl transition-all"
                style={{ fontFamily: 'Sora, sans-serif' }}
              >
                <Printer className="w-4 h-4" /> Print Slip
              </button>
              <button
                onClick={() => setSuccessData(null)}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 border border-white/30 text-white font-semibold px-5 py-3 rounded-xl transition-all"
                style={{ fontFamily: 'Sora, sans-serif' }}
              >
                New Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Modal */}
      {modalProduct && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setModalProduct(null)}>
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm overflow-hidden animate-slide-up relative flex flex-col"
            style={{ maxHeight: '88vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* X button - top right of modal, above image */}
            <button
              onClick={() => setModalProduct(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Image - full width, no crop */}
            <div className="w-full bg-zinc-800 flex-shrink-0">
              <img
                src={modalProduct.image || IMG_FALLBACK}
                alt={modalProduct.name}
                className="w-full object-contain"
                style={{ maxHeight: '220px' }}
                onError={e => { e.target.src = IMG_FALLBACK; }}
              />
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 p-4">
              <h3 className="font-bold text-white text-lg leading-tight mb-0.5" style={{ fontFamily: 'Sora, sans-serif' }}>{modalProduct.name}</h3>
              <p className="text-orange-400 font-bold text-xl mb-4">₹{modalProduct.price.toFixed(2)} <span className="text-zinc-500 text-sm font-normal">/ piece</span></p>

              <div className="mb-4">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">
                  Size / Label <span className="normal-case text-zinc-600">(e.g. 250g, 1kg)</span>
                </label>
                <input
                  value={modalQtyLabel}
                  onChange={e => setModalQtyLabel(e.target.value)}
                  placeholder="Optional"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-sm font-medium">Quantity</span>
                <div className="flex items-center gap-3 bg-zinc-800 rounded-xl p-1">
                  <button onClick={() => setModalQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-lg hover:bg-zinc-700 flex items-center justify-center text-zinc-300">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-white font-bold text-lg w-8 text-center" style={{ fontFamily: 'Sora, sans-serif' }}>{modalQty}</span>
                  <button onClick={() => setModalQty(q => q + 1)} className="w-8 h-8 rounded-lg hover:bg-zinc-700 flex items-center justify-center text-zinc-300">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Fixed Add to Cart button */}
            <div className="p-4 flex-shrink-0 border-t border-zinc-800">
              <button onClick={addFromModal} className="w-full btn-primary py-3 flex items-center justify-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Add to Cart — ₹{(modalProduct.price * modalQty).toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Ready Orders View */}
      {view === 'ready' && (
        <div className="max-w-7xl mx-auto w-full px-4 py-6">
          {readyLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : readyOrders.length === 0 ? (
            <div className="text-center py-24 text-zinc-600">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">No ready orders</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {readyOrders.map(order => (
                <div key={order._id} className="card p-5 border-green-500/30 bg-green-500/5 animate-slide-up">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center shadow-xl shadow-green-900/30">
                        <span className="text-white font-extrabold text-xl" style={{ fontFamily: 'Sora, sans-serif' }}>
                          #{order.tokenNumber}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Ready to collect</p>
                        <p className="text-xs text-green-400 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />{timeSince(order.packedAt)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteOrder(order._id, order.tokenNumber)}
                      disabled={deleting === order._id}
                      className="w-9 h-9 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl transition-all disabled:opacity-50"
                    >
                      {deleting === order._id
                        ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="space-y-1.5 mb-3">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-zinc-400 truncate max-w-[70%]">{item.name}{item.quantityLabel ? ` (${item.quantityLabel})` : ''}</span>
                        <span className="text-zinc-300 font-medium">×{item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-zinc-800 pt-3 flex items-center justify-between">
                    <span className="text-xs text-zinc-600">Total</span>
                    <span className="font-bold text-white" style={{ fontFamily: 'Sora, sans-serif' }}>₹{order.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={`flex-1 flex overflow-hidden max-w-7xl mx-auto w-full px-4 gap-6 py-6 ${view === 'ready' ? 'hidden' : ''}`}>
        {/* Left — Products */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search products..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    activeCategory === cat
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-900/30'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 content-start pb-4">
              {filtered.map(product => {
                const qty = getCartQty(product._id);
                return (
                  <button key={product._id} onClick={() => openModal(product)}
                    className={`card overflow-hidden text-left group transition-all duration-200 hover:border-orange-500/50 active:scale-95 ${qty > 0 ? 'border-orange-500/60 bg-orange-500/5' : ''}`}>
                    <div className="aspect-square overflow-hidden bg-zinc-800 relative">
                      <img src={product.image || IMG_FALLBACK} alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={e => { e.target.src = IMG_FALLBACK; }} />
                      {qty > 0 && (
                        <div className="absolute top-2 right-2 w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg animate-pop">
                          {qty}
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold text-zinc-200 leading-tight line-clamp-2" style={{ fontFamily: 'Sora, sans-serif' }}>
                        {product.name}
                      </p>
                      <p className="text-orange-400 font-bold text-sm mt-1">₹{product.price.toFixed(2)}</p>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-full text-center py-16 text-zinc-600">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No products found</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right — Cart */}
        <div className="w-80 flex-shrink-0 flex flex-col card overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="font-bold text-white" style={{ fontFamily: 'Sora, sans-serif' }}>Cart</h3>
            <span className="bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">{cartCount} items</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600 py-10">
                <ShoppingCart className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">Tap products to add</p>
              </div>
            ) : cart.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-zinc-800/60 rounded-xl p-2.5">
                <img src={item.image || IMG_FALLBACK} alt={item.name}
                  className="w-10 h-10 rounded-lg object-cover bg-zinc-700 flex-shrink-0"
                  onError={e => { e.target.src = IMG_FALLBACK; }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-200 truncate">{item.name}</p>
                  {item.quantityLabel && (
                    <p className="text-xs text-zinc-500">{item.quantityLabel}</p>
                  )}
                  <p className="text-xs text-orange-400 font-medium">₹{(item.price * item.quantity).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => changeQty(idx, -1)} className="w-6 h-6 rounded-lg bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center">
                    <Minus className="w-3 h-3 text-zinc-300" />
                  </button>
                  <span className="w-6 text-center text-sm font-bold text-white">{item.quantity}</span>
                  <button onClick={() => changeQty(idx, 1)} className="w-6 h-6 rounded-lg bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center">
                    <Plus className="w-3 h-3 text-zinc-300" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {cart.length > 0 && (
            <div className="p-4 border-t border-zinc-800 space-y-3">
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Order notes (optional)..."
                rows={2}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500 resize-none" />
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-sm">Total</span>
                <span className="text-xl font-bold text-white" style={{ fontFamily: 'Sora, sans-serif' }}>₹{cartTotal.toFixed(2)}</span>
              </div>
              <button onClick={placeOrder} disabled={placing}
                className="w-full btn-primary py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-60">
                {placing ? (
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : <><CheckCircle className="w-5 h-5" /> Place Order</>}
              </button>
              <button onClick={() => setCart([])} className="w-full flex items-center justify-center gap-1.5 text-zinc-500 hover:text-red-400 text-sm transition-colors py-1">
                <Trash2 className="w-3.5 h-3.5" /> Clear cart
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
