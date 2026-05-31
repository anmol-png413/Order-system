import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { Plus, Minus, Trash2, ShoppingCart, CheckCircle, X, Search } from 'lucide-react';

const API = '/api';
const IMG_FALLBACK = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="%231a1a1a"/><text x="40" y="44" text-anchor="middle" font-size="28" fill="%23444">🍽️</text></svg>';

export default function StaffPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [token, setToken] = useState(null);

  useEffect(() => {
    axios.get(`${API}/products`).then(res => {
      setProducts(res.data);
      const cats = ['All', ...new Set(res.data.map(p => p.category))];
      setCategories(cats);
    }).catch(() => toast.error('Failed to load products'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = products.filter(p => {
    const inCat = activeCategory === 'All' || p.category === activeCategory;
    const inSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return inCat && inSearch;
  });

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product === product._id);
      if (existing) return prev.map(i => i.product === product._id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product: product._id, name: product.name, price: product.price, image: product.image, quantity: 1 }];
    });
  };

  const changeQty = (productId, delta) => {
    setCart(prev => prev.map(i => i.product === productId
      ? { ...i, quantity: Math.max(0, i.quantity + delta) }
      : i).filter(i => i.quantity > 0));
  };

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setPlacing(true);
    try {
      const res = await axios.post(`${API}/orders`, { items: cart, notes });
      setToken(res.data.tokenNumber);
      setCart([]);
      setNotes('');
      toast.success(`Order placed! Token #${res.data.tokenNumber}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  const getCartQty = (id) => cart.find(i => i.product === id)?.quantity || 0;

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <Navbar title="OrderFlow" subtitle="Staff — Order Taking" />

      {/* Token Success Modal — full-screen gradient */}
      {token && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-orange-500 to-pink-500" />
          <button
            onClick={() => setToken(null)}
            className="absolute top-5 right-5 w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="relative text-center max-w-xs w-full animate-pop">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <div className="w-16 h-16 bg-white/25 rounded-full flex items-center justify-center">
                <CheckCircle className="w-9 h-9 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <p className="text-white/80 text-xs font-bold uppercase tracking-widest mb-2">Order Placed</p>
            <div
              className="text-white font-extrabold mb-2 leading-none"
              style={{ fontFamily: 'Sora, sans-serif', fontSize: '80px' }}
            >
              #{token}
            </div>
            <p className="text-white/70 text-sm mb-8">Sent to packing 📦</p>
            <button
              onClick={() => setToken(null)}
              className="bg-white/20 hover:bg-white/30 border border-white/30 backdrop-blur text-white font-semibold px-8 py-3.5 rounded-2xl transition-all text-base"
              style={{ fontFamily: 'Sora, sans-serif' }}
            >
              New Order
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full px-4 gap-6 py-6">
        {/* Left — Products */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search products..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500 transition-all" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
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

          {/* Products Grid */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 content-start pb-4">
              {filtered.map(product => {
                const qty = getCartQty(product._id);
                return (
                  <div key={product._id}
                    className={`card overflow-hidden cursor-pointer group transition-all duration-200 hover:border-orange-500/50 active:scale-95 ${qty > 0 ? 'border-orange-500/60 bg-orange-500/5' : ''}`}
                    onClick={() => addToCart(product)}>
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
                  </div>
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
            <h3 className="font-bold text-white" style={{ fontFamily: 'Sora, sans-serif' }}>
              Cart
            </h3>
            <span className="bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {cartCount} items
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600 py-10">
                <ShoppingCart className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">Tap products to add</p>
              </div>
            ) : cart.map(item => (
              <div key={item.product} className="flex items-center gap-3 bg-zinc-800/60 rounded-xl p-2.5">
                <img src={item.image || IMG_FALLBACK} alt={item.name}
                  className="w-10 h-10 rounded-lg object-cover bg-zinc-700 flex-shrink-0"
                  onError={e => { e.target.src = IMG_FALLBACK; }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-200 truncate">{item.name}</p>
                  <p className="text-xs text-orange-400 font-medium">₹{(item.price * item.quantity).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => changeQty(item.product, -1)}
                    className="w-6 h-6 rounded-lg bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors">
                    <Minus className="w-3 h-3 text-zinc-300" />
                  </button>
                  <span className="w-6 text-center text-sm font-bold text-white">{item.quantity}</span>
                  <button onClick={() => changeQty(item.product, 1)}
                    className="w-6 h-6 rounded-lg bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors">
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
                <span className="text-xl font-bold text-white" style={{ fontFamily: 'Sora, sans-serif' }}>
                  ₹{cartTotal.toFixed(2)}
                </span>
              </div>

              <button onClick={placeOrder} disabled={placing}
                className="w-full btn-primary py-3.5 text-base flex items-center justify-center gap-2">
                {placing ? (
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : <>
                  <CheckCircle className="w-5 h-5" /> Place Order
                </>}
              </button>

              <button onClick={() => setCart([])}
                className="w-full flex items-center justify-center gap-1.5 text-zinc-500 hover:text-red-400 text-sm transition-colors py-1">
                <Trash2 className="w-3.5 h-3.5" /> Clear cart
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
