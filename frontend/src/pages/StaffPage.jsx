import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useSocket } from '../hooks/useSocket';
import {
  Plus, Minus, Trash2, ShoppingCart, CheckCircle, X,
  Search, Printer, Package, Bell, ChevronDown, Clock
} from 'lucide-react';

const IMG_FALLBACK = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="%231a1a1a"/><text x="40" y="44" text-anchor="middle" font-size="28" fill="%23444">🍽️</text></svg>';

// Parse "500g" → 0.5, "1.5kg" → 1.5, "250" → 0.25 (assumes grams if no unit and <10)
function parseWeightToKg(input) {
  const s = input.trim().toLowerCase().replace(/\s/g, '');
  if (!s) return null;
  if (s.endsWith('kg')) { const n = parseFloat(s); return isNaN(n) ? null : n; }
  if (s.endsWith('g'))  { const n = parseFloat(s); return isNaN(n) ? null : n / 1000; }
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return n < 10 ? n : n / 1000; // bare number: <10 assume kg, else grams
}

function fmtQty(quantity, quantityLabel, unit) {
  if (quantityLabel) return quantityLabel;
  if (unit === 'piece') return `${quantity} pcs`;
  return `${quantity} kg`;
}

function buildSlipHTML(tokenNumber, items, notes) {
  const now = new Date();
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Green Sweets</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    @page{margin:4mm}
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
  <div class="center big">#${tokenNumber}</div>
  <div class="line"></div>
  <table>
    <tr><td class="bold" style="font-size:11px">ITEM</td><td class="right bold" style="font-size:11px">AMT</td></tr>
    <tr><td colspan="2"><div class="line"></div></td></tr>
    ${items.map(i => {
      const isKg = i.unit !== 'piece';
      const weightLabel = i.quantityLabel || (isKg ? i.quantity + ' kg' : '');
      const qtyLabel = isKg
        ? (i.quantity > 1 ? `${weightLabel} × ${i.quantity} pkt @ ₹${i.price.toFixed(2)}` : `${weightLabel} @ ₹${i.price.toFixed(2)}`)
        : `${i.quantity} pcs @ ₹${i.price.toFixed(2)}`;
      return `<tr>
        <td style="font-size:12px">${i.name}<br>
          <span style="color:#555;font-size:11px">${qtyLabel}</span>
        </td>
        <td class="right">₹${(i.price * i.quantity).toFixed(2)}</td>
      </tr>`;
    }).join('')}
    <tr><td colspan="2"><div class="line"></div></td></tr>
    <tr class="total-row"><td>TOTAL</td><td class="right">₹${total.toFixed(2)}</td></tr>
  </table>
  ${notes ? `<div class="line"></div><div style="font-size:11px">Note: ${notes}</div>` : ''}
  <div class="line"></div>
  <div class="center" style="font-size:12px;font-weight:bold">Thank you! Visit again ✓</div>
  <div class="center" style="font-size:10px;margin-top:4px;color:#555">+91 98880 77154</div>
  </body></html>`;
}

function writeAndPrint(win, html) {
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.onafterprint = () => setTimeout(() => win.close(), 1500);
    setTimeout(() => { if (!win.closed) win.close(); }, 5000);
  }, 300);
}

function printSlip(tokenNumber, items, notes) {
  const html = buildSlipHTML(tokenNumber, items, notes);
  const win = window.open('', '_blank', 'width=320,height=640');
  if (!win) return;
  writeAndPrint(win, html);
}

// ── Live Status Modal ────────────────────────────────────────────
function StatusModal({ type, orders, onClose, onDelete, deleting }) {
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

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-4 border-b border-zinc-800 ${isPacking ? 'bg-blue-500/10' : 'bg-green-500/10'}`}>
        <div className="flex items-center gap-3">
          {isPacking
            ? <Package className="w-6 h-6 text-blue-400" />
            : <Bell className="w-6 h-6 text-green-400" />}
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Sora, sans-serif' }}>
            {isPacking ? 'Packing Status' : 'Ready for Pickup'}
          </h2>
          <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${isPacking ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300'}`}>
            {filtered.length}
          </span>
        </div>
        <button onClick={onClose} className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 rounded-xl flex items-center justify-center text-zinc-300">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Orders */}
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600 py-16">
            {isPacking ? <Package className="w-16 h-16 mb-4 opacity-20" /> : <Bell className="w-16 h-16 mb-4 opacity-20" />}
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
                {/* Status banner */}
                <div className={`px-4 py-2 flex items-center justify-between text-sm font-bold ${
                  order.status === 'completed' ? 'bg-green-500 text-white'
                  : order.status === 'in-progress' ? 'bg-blue-500 text-white'
                  : 'bg-yellow-500 text-zinc-900'
                }`}>
                  <span>{order.status === 'completed' ? '✓ READY' : order.status === 'in-progress' ? '⚙ PACKING' : '⏳ PENDING'}</span>
                  <span className="text-xs opacity-80">{new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-4xl font-extrabold text-white" style={{ fontFamily: 'Sora, sans-serif' }}>
                      #{order.tokenNumber}
                    </div>
                    {/* Delete button — only for completed orders */}
                    {!isPacking && (
                      <button
                        onClick={() => onDelete(order._id, order.tokenNumber)}
                        disabled={deleting === order._id}
                        className="w-9 h-9 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl transition-all disabled:opacity-50 flex-shrink-0"
                      >
                        {deleting === order._id
                          ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          : <Trash2 className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                  {order.packedAt && (
                    <p className="text-xs text-green-400 flex items-center gap-1 mb-2">
                      <Clock className="w-3 h-3" />{timeSince(order.packedAt)}
                    </p>
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
                          {item.quantityLabel || (item.unit === 'piece' ? `${item.quantity} pcs` : `${item.quantity} kg`)}
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

// ── Main Component ───────────────────────────────────────────────
export default function StaffPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['All']);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [cartOpen, setCartOpen] = useState(false); // mobile drawer
  const [statusModal, setStatusModal] = useState(null); // 'packing' | 'counter' | null

  // Product modal
  const [modalProduct, setModalProduct] = useState(null);
  const [modalQty, setModalQty] = useState(1);
  const [modalWeight, setModalWeight] = useState(''); // for kg products e.g. "500g", "1kg"

  // Live orders for status modals
  const [liveOrders, setLiveOrders] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [showFloating, setShowFloating] = useState(true);

  const fetchLiveOrders = useCallback(() => {
    axios.get('/api/orders').then(res => setLiveOrders(res.data)).catch(() => {});
  }, []);

  const openStatusModal = (type) => {
    fetchLiveOrders();
    setStatusModal(type);
  };

  useEffect(() => {
    let timer;
    const onScroll = () => {
      setShowFloating(false);
      clearTimeout(timer);
      timer = setTimeout(() => setShowFloating(true), 4000);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(timer); };
  }, []);

  useEffect(() => {
    fetchLiveOrders();
    axios.get('/api/products').then(res => {
      setProducts(res.data);
      const cats = ['All', ...new Set(res.data.map(p => p.category))];
      // Filter to only show Counter 1, Counter 2 categories + All
      const allowed = cats.filter(c => c === 'All' || c.toLowerCase().startsWith('counter'));
      setCategories(allowed.length > 1 ? allowed : cats);
    }).catch(() => toast.error('Failed to load products'))
      .finally(() => setLoading(false));
  }, []);

  // Real-time updates via "staff" room
  useSocket('staff', {
    'new-order': (order) => {
      setLiveOrders(prev => [order, ...prev]);
    },
    'order-updated': (updated) => {
      setLiveOrders(prev => prev.map(o => o._id === updated._id ? updated : o));
    },
    'order-deleted': ({ _id }) => {
      setLiveOrders(prev => prev.filter(o => o._id !== _id));
    },
  });

  const deleteOrder = async (orderId, tokenNumber) => {
    setDeleting(orderId);
    try {
      await axios.delete(`/api/orders/${orderId}`);
      setLiveOrders(prev => prev.filter(o => o._id !== orderId));
      toast.success(`Token #${tokenNumber} deleted`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const packingCount = liveOrders.filter(o => o.status === 'pending' || o.status === 'in-progress').length;
  const readyCount = liveOrders.filter(o => o.status === 'completed').length;

  const filtered = products.filter(p => {
    const inCat = activeCategory === 'All' || p.category === activeCategory;
    const inSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return inCat && inSearch;
  }).sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0));

  const openModal = (product) => {
    setModalProduct(product);
    setModalQty(1);
    setModalWeight('');
  };

  const addFromModal = () => {
    const isKg = modalProduct.unit !== 'piece';
    let item;

    if (isKg) {
      const kg = parseWeightToKg(modalWeight);
      if (!kg || kg <= 0) { toast.error('Enter a valid weight (e.g. 500g, 1kg)'); return; }
      const calculatedPrice = parseFloat((modalProduct.price * kg).toFixed(2));
      const label = modalWeight.trim().toLowerCase().endsWith('g') || modalWeight.trim().toLowerCase().endsWith('kg')
        ? modalWeight.trim()
        : `${modalWeight.trim()}g`;
      item = {
        product: modalProduct._id,
        name: modalProduct.name,
        price: calculatedPrice,
        image: modalProduct.image,
        unit: modalProduct.unit,
        quantity: modalQty,
        quantityLabel: label,
      };
    } else {
      item = {
        product: modalProduct._id,
        name: modalProduct.name,
        price: modalProduct.price,
        image: modalProduct.image,
        unit: modalProduct.unit,
        quantity: modalQty,
        quantityLabel: `${modalQty} pcs`,
      };
    }

    setCart(prev => {
      const key = `${item.product}-${item.quantityLabel}`;
      const existing = prev.find(i => `${i.product}-${i.quantityLabel}` === key);
      if (existing) return prev.map(i => `${i.product}-${i.quantityLabel}` === key ? { ...i, quantity: i.quantity + item.quantity } : i);
      return [...prev, item];
    });
    toast.success(`${modalProduct.name} added`);
    setModalProduct(null);
  };

  const changeQty = (idx, delta) => {
    setCart(prev => prev.map((i, n) => n === idx ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0));
  };

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const getCartQty = (id) => cart.filter(i => i.product === id).reduce((s, i) => s + i.quantity, 0);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setPlacing(true);
    // Open print window SYNCHRONOUSLY here (direct user gesture) — required for iOS Safari
    const printWin = window.open('', '_blank', 'width=320,height=640');
    try {
      const res = await axios.post('/api/orders', { items: cart, notes });
      const orderData = { token: res.data.tokenNumber, items: [...cart], notes };
      setSuccessData(orderData);
      setTimeout(() => setSuccessData(null), 2000);
      // Write content to already-opened window and print
      if (printWin && !printWin.closed) {
        writeAndPrint(printWin, buildSlipHTML(orderData.token, orderData.items, orderData.notes));
      }
      setCart([]);
      setNotes('');
      setCartOpen(false);
    } catch (err) {
      if (printWin && !printWin.closed) printWin.close();
      toast.error(err.response?.data?.message || 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <Navbar title="OrderFlow" subtitle="Order Counter" />

      {/* Quick screen switcher */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex gap-2 overflow-x-auto">
        <button className="flex-shrink-0 flex items-center gap-2 bg-orange-500 text-white text-sm font-semibold px-4 py-2 rounded-xl" style={{ fontFamily: 'Sora, sans-serif' }}>
          <ShoppingCart className="w-4 h-4" /> Counter
        </button>
        <button onClick={() => openStatusModal('packing')}
          className="flex-shrink-0 flex items-center gap-2 bg-zinc-800 hover:bg-blue-500/20 hover:text-blue-400 text-zinc-400 text-sm font-semibold px-4 py-2 rounded-xl transition-all border border-zinc-700">
          <Package className="w-4 h-4" /> Packing
          {packingCount > 0 && <span className="bg-blue-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{packingCount}</span>}
        </button>
        <button onClick={() => openStatusModal('counter')}
          className="flex-shrink-0 flex items-center gap-2 bg-zinc-800 hover:bg-green-500/20 hover:text-green-400 text-zinc-400 text-sm font-semibold px-4 py-2 rounded-xl transition-all border border-zinc-700">
          <Bell className="w-4 h-4" /> Ready
          {readyCount > 0 && <span className="bg-green-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{readyCount}</span>}
        </button>
      </div>

      {/* ── SUCCESS MODAL ── */}
      {successData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-orange-500 to-pink-500" />
          <button onClick={() => setSuccessData(null)} className="absolute top-5 right-5 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white">
            <X className="w-5 h-5" />
          </button>
          <div className="relative text-center max-w-xs w-full animate-pop">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-14 h-14 bg-white/25 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <p className="text-white/80 text-xs font-bold uppercase tracking-widest mb-1">Order Placed</p>
            <div className="text-white font-extrabold leading-none mb-2" style={{ fontFamily: 'Sora, sans-serif', fontSize: '80px' }}>
              #{successData.token}
            </div>
            <p className="text-white/70 text-sm mb-6">Sent to packing 📦</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button onClick={() => printSlip(successData.token, successData.items, successData.notes)}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 border border-white/30 text-white font-semibold px-4 py-3 rounded-xl transition-all text-sm">
                <Printer className="w-4 h-4" /> Print Slip
              </button>
              <button onClick={() => { setSuccessData(null); openStatusModal('packing'); }}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 border border-white/30 text-white font-semibold px-4 py-3 rounded-xl transition-all text-sm">
                <Package className="w-4 h-4" /> Packing Status
              </button>
              <button onClick={() => { setSuccessData(null); openStatusModal('counter'); }}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 border border-white/30 text-white font-semibold px-4 py-3 rounded-xl transition-all text-sm">
                <Bell className="w-4 h-4" /> Counter Status
              </button>
              <button onClick={() => setSuccessData(null)}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 border border-white/30 text-white font-semibold px-4 py-3 rounded-xl transition-all text-sm">
                New Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STATUS MODALS ── */}
      {statusModal && (
        <StatusModal
          type={statusModal}
          orders={liveOrders}
          onClose={() => setStatusModal(null)}
          onDelete={deleteOrder}
          deleting={deleting}
        />
      )}

      {/* ── PRODUCT MODAL ── */}
      {modalProduct && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-start justify-center px-4 pb-4 pt-20 overflow-y-auto" onClick={() => setModalProduct(null)}>
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm flex flex-col animate-slide-up relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Header bar with X button - always visible above image */}
            <div className="flex items-center justify-end px-3 py-2 flex-shrink-0 rounded-t-2xl bg-zinc-900">
              <button
                onClick={() => setModalProduct(null)}
                className="w-9 h-9 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center text-zinc-300 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Image - full, no crop */}
            <div className="w-full bg-zinc-800 flex-shrink-0">
              <img
                src={modalProduct.image || IMG_FALLBACK}
                alt={modalProduct.name}
                className="w-full object-contain"
                style={{ maxHeight: '180px' }}
                onError={e => { e.target.src = IMG_FALLBACK; }}
              />
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 p-4 pr-4">
              <h3 className="font-bold text-white text-xl mb-0.5 pr-8" style={{ fontFamily: 'Sora, sans-serif' }}>{modalProduct.name}</h3>
              <p className="text-zinc-500 text-sm mb-4">
                ₹{modalProduct.price.toFixed(2)} / {modalProduct.unit === 'piece' ? 'piece' : 'kg'}
              </p>

              {modalProduct.unit !== 'piece' ? (
                <div className="mb-2">
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">
                    Enter Weight <span className="normal-case text-zinc-600">(or select below)</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {['150g', '500g', '1kg', '2kg'].map(w => (
                      <button key={w} type="button" onClick={() => setModalWeight(w)}
                        className={`py-2 rounded-xl text-sm font-bold transition-all ${
                          modalWeight === w ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
                        }`} style={{ fontFamily: 'Sora, sans-serif' }}>
                        {w}
                      </button>
                    ))}
                  </div>
                  <input
                    value={modalWeight}
                    onChange={e => setModalWeight(e.target.value)}
                    placeholder="Or type: e.g. 250g"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-600 text-lg focus:outline-none focus:border-orange-500"
                  />

                  {/* Quantity counter for kg products */}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-zinc-400 text-sm font-medium">Quantity</span>
                    <div className="flex items-center gap-3 bg-zinc-800 rounded-xl p-1">
                      <button onClick={() => setModalQty(q => Math.max(1, q - 1))} className="w-10 h-10 rounded-lg hover:bg-zinc-700 flex items-center justify-center text-zinc-300">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-white font-bold text-xl w-10 text-center" style={{ fontFamily: 'Sora, sans-serif' }}>{modalQty}</span>
                      <button onClick={() => setModalQty(q => q + 1)} className="w-10 h-10 rounded-lg hover:bg-zinc-700 flex items-center justify-center text-zinc-300">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-400 text-sm font-medium">Quantity</span>
                  <div className="flex items-center gap-3 bg-zinc-800 rounded-xl p-1">
                    <button onClick={() => setModalQty(q => Math.max(1, q - 1))} className="w-10 h-10 rounded-lg hover:bg-zinc-700 flex items-center justify-center text-zinc-300">
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-white font-bold text-xl w-10 text-center" style={{ fontFamily: 'Sora, sans-serif' }}>{modalQty}</span>
                    <button onClick={() => setModalQty(q => q + 1)} className="w-10 h-10 rounded-lg hover:bg-zinc-700 flex items-center justify-center text-zinc-300">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Fixed Add to Cart button */}
            <div className="p-4 border-t border-zinc-800 flex-shrink-0">
              <button onClick={addFromModal} className="w-full btn-primary py-4 flex items-center justify-center gap-2 text-base">
                <ShoppingCart className="w-5 h-5" />
                {modalProduct.unit !== 'piece'
                  ? `Add${modalQty > 1 ? ` ×${modalQty}` : ''} — ${parseWeightToKg(modalWeight) ? `₹${(modalProduct.price * parseWeightToKg(modalWeight) * modalQty).toFixed(2)}` : 'enter weight'}`
                  : `Add to Cart — ₹${(modalProduct.price * modalQty).toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN LAYOUT ── */}
      <main className="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full px-3 sm:px-4 gap-4 py-4" aria-label="Order taking">

        {/* LEFT — Products */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Search + Category */}
          <div className="flex flex-col gap-2 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search products..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-base text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className={`flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    activeCategory === cat ? 'bg-orange-500 text-white shadow-lg shadow-orange-900/30' : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`} style={{ fontFamily: 'Sora, sans-serif' }}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 content-start pb-24 sm:pb-4">
              {filtered.map((product, index) => {
                const qty = getCartQty(product._id);
                const isPopular = index < 3 && (product.orderCount || 0) > 0;
                return (
                  <button key={product._id} onClick={() => openModal(product)}
                    className={`card overflow-hidden text-left group transition-all duration-200 hover:border-orange-500/50 active:scale-95 ${qty > 0 ? 'border-orange-500/60 bg-orange-500/5' : ''}`}>
                    <div className="aspect-square overflow-hidden bg-zinc-800 relative">
                      <img src={product.image || IMG_FALLBACK} alt={product.name}
                        loading="lazy" width="200" height="200"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={e => { e.target.src = IMG_FALLBACK; }} />
                      {isPopular && (
                        <div className="absolute top-2 left-2 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-lg">
                          🔥 Popular
                        </div>
                      )}
                      {qty > 0 && (
                        <div className="absolute top-2 right-2 w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg animate-pop">
                          {qty}
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-bold text-zinc-100 leading-tight line-clamp-2 mb-1" style={{ fontFamily: 'Sora, sans-serif' }}>
                        {product.name}
                      </p>
                      <p className="text-orange-400 font-bold text-base">
                        ₹{product.price.toFixed(2)}
                        <span className="text-zinc-500 text-xs font-medium ml-0.5">
                          /{product.unit === 'piece' ? 'p' : 'kg'}
                        </span>
                      </p>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && !loading && (
                <div className="col-span-full text-center py-16 text-zinc-600">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No product found</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — Cart (desktop only) */}
        <div className="hidden sm:flex w-72 lg:w-80 flex-shrink-0 flex-col card overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="font-bold text-white text-lg" style={{ fontFamily: 'Sora, sans-serif' }}>Cart</h3>
            <span className="bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">{cartCount} items</span>
          </div>
          <div className="overflow-y-auto p-3 space-y-2" style={{ maxHeight: '60vh' }}>
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600 py-10">
                <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm">Tap products to add</p>
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
                  <button onClick={() => changeQty(idx, -1)} className="w-7 h-7 rounded-lg bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center"><Minus className="w-3 h-3 text-zinc-300" /></button>
                  <span className="w-6 text-center text-sm font-bold text-white">{item.quantity}</span>
                  <button onClick={() => changeQty(idx, 1)} className="w-7 h-7 rounded-lg bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center"><Plus className="w-3 h-3 text-zinc-300" /></button>
                </div>
              </div>
            ))}
          </div>
          {cart.length > 0 && (
            <div className="p-4 border-t border-zinc-800 space-y-3">
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Order notes (optional)..." rows={2}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500 resize-none" />
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-sm">Total</span>
                <span className="text-xl font-extrabold text-white" style={{ fontFamily: 'Sora, sans-serif' }}>₹{cartTotal.toFixed(2)}</span>
              </div>
              <button onClick={placeOrder} disabled={placing}
                className="w-full btn-primary py-4 text-base flex items-center justify-center gap-2 disabled:opacity-60">
                {placing ? <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                  : <><CheckCircle className="w-5 h-5" /> Place Order</>}
              </button>
              <button onClick={() => setCart([])} className="w-full flex items-center justify-center gap-1.5 text-zinc-600 hover:text-red-400 text-sm transition-colors py-1">
                <Trash2 className="w-3.5 h-3.5" /> Clear cart
              </button>
            </div>
          )}
        </div>
      </main>

      {/* ── MOBILE CART DRAWER ── */}
      <div className="sm:hidden">
        {/* Floating cart button */}
        <button onClick={() => setCartOpen(true)}
          className="fixed bottom-6 right-4 z-30 bg-orange-500 text-white rounded-2xl px-5 py-3.5 flex items-center gap-3 shadow-2xl shadow-orange-900/50 active:scale-95 transition-all">
          <ShoppingCart className="w-5 h-5" />
          <span className="font-bold" style={{ fontFamily: 'Sora, sans-serif' }}>Cart</span>
          {cartCount > 0 && <span className="bg-white text-orange-500 text-xs font-extrabold px-2 py-0.5 rounded-full">{cartCount}</span>}
          {cartCount > 0 && <span className="font-semibold text-sm">₹{cartTotal.toFixed(0)}</span>}
        </button>

        {/* Drawer backdrop */}
        {cartOpen && <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setCartOpen(false)} />}

        {/* Drawer */}
        <div className={`fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 border-t border-zinc-800 rounded-t-3xl transition-transform duration-300 ${cartOpen ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ maxHeight: '80vh' }}>
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <h3 className="font-bold text-white text-lg" style={{ fontFamily: 'Sora, sans-serif' }}>Cart · {cartCount} items</h3>
            <button onClick={() => setCartOpen(false)} aria-label="Close cart" className="w-9 h-9 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400"><X className="w-5 h-5" aria-hidden="true" /></button>
          </div>
          <div className="overflow-y-auto p-3 space-y-2" style={{ maxHeight: 'calc(80vh - 180px)' }}>
            {cart.length === 0 ? (
              <div className="text-center py-10 text-zinc-600"><ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-20" /><p>Tap products to add</p></div>
            ) : cart.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-zinc-800/60 rounded-xl p-3">
                <img src={item.image || IMG_FALLBACK} alt={item.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" onError={e => { e.target.src = IMG_FALLBACK; }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-200 truncate">{item.name}</p>
                  <p className="text-xs text-zinc-500">{item.quantityLabel || (item.unit === 'piece' ? `${item.quantity} pcs` : `${item.quantity} kg`)}</p>
                  <p className="text-sm text-orange-400 font-bold">₹{(item.price * item.quantity).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => changeQty(idx, -1)} className="w-9 h-9 rounded-xl bg-zinc-700 flex items-center justify-center"><Minus className="w-4 h-4 text-zinc-300" /></button>
                  <span className="w-8 text-center font-bold text-white">{item.quantity}</span>
                  <button onClick={() => changeQty(idx, 1)} className="w-9 h-9 rounded-xl bg-zinc-700 flex items-center justify-center"><Plus className="w-4 h-4 text-zinc-300" /></button>
                </div>
              </div>
            ))}
          </div>
          {cart.length > 0 && (
            <div className="p-4 border-t border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Total</span>
                <span className="text-2xl font-extrabold text-white" style={{ fontFamily: 'Sora, sans-serif' }}>₹{cartTotal.toFixed(2)}</span>
              </div>
              <button onClick={placeOrder} disabled={placing}
                className="w-full btn-primary py-4 text-lg flex items-center justify-center gap-2 disabled:opacity-60">
                {placing ? <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                  : <><CheckCircle className="w-6 h-6" /> Place Order</>}
              </button>
            </div>
          )}
        </div>
      {/* </main> */}
      </div>

      {/* ── FLOATING STATUS BUTTONS (left side, show after 4s idle) ── */}
      <div className={`hidden sm:flex fixed bottom-6 left-6 z-30 flex-col gap-2 transition-all duration-300 ${
        showFloating ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'
      }`}>
        <button onClick={() => openStatusModal('counter')}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white rounded-xl px-4 py-3 shadow-xl transition-all active:scale-95">
          <Bell className="w-5 h-5" />
          <span className="font-semibold text-sm" style={{ fontFamily: 'Sora, sans-serif' }}>Ready</span>
          <span className="bg-white/20 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[22px] text-center">{readyCount}</span>
        </button>
        <button onClick={() => openStatusModal('packing')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-3 shadow-xl transition-all active:scale-95">
          <Package className="w-5 h-5" />
          <span className="font-semibold text-sm" style={{ fontFamily: 'Sora, sans-serif' }}>Packing</span>
          <span className="bg-white/20 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[22px] text-center">{packingCount}</span>
        </button>
      </div>
    </div>
  );
}
