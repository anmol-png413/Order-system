import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ShoppingCart, ShoppingBag, Plus, Minus, X } from 'lucide-react';
import { useCart } from '../context/CartContext';

const IMG_FALLBACK = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="%231a1a1a"/><text x="60" y="68" text-anchor="middle" font-size="40" fill="%23444">🍽️</text></svg>';

export default function HomePage() {
  const navigate = useNavigate();
  const { addToCart, totalItems } = useCart();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    axios.get('/api/products')
      .then(res => setProducts(res.data))
      .catch(() => toast.error('Failed to load menu'))
      .finally(() => setLoading(false));
  }, []);

  const categories = [...new Set(products.map(p => p.category))];

  const openModal = (product) => { setSelected(product); setQty(1); };
  const closeModal = () => setSelected(null);

  const handleAddToCart = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-white flex-shrink-0">
              <img src="/image.png" alt="Green Sweets" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-white text-lg" style={{ fontFamily: 'Sora, sans-serif' }}>Green Sweets</span>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="text-sm font-semibold text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 px-4 py-2 rounded-xl transition-all mr-2"
            style={{ fontFamily: 'Sora, sans-serif' }}
          >
            Login
          </button>
          <button
            onClick={() => navigate('/cart')}
            className="relative p-2 text-zinc-400 hover:text-white transition-colors"
          >
            <ShoppingCart className="w-6 h-6" />
            {totalItems > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 bg-orange-500 text-white text-xs font-bold min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center shadow-lg animate-pop"
                style={{ fontFamily: 'Sora, sans-serif' }}
              >
                {totalItems > 9 ? '9+' : totalItems}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: 'Sora, sans-serif' }}>Our Menu</h1>
          <p className="text-zinc-500 text-sm">Tap any item to add it to your cart</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-32 text-zinc-600">
            <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">No items available right now</p>
          </div>
        ) : (
          <div className="space-y-10">
            {categories.map(category => (
              <section key={category}>
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2" style={{ fontFamily: 'Sora, sans-serif' }}>
                  <span className="w-1 h-5 bg-orange-500 rounded-full inline-block" />
                  {category}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {products.filter(p => p.category === category).map(product => (
                    <button
                      key={product._id}
                      onClick={() => openModal(product)}
                      className="card overflow-hidden text-left hover:border-orange-500/40 transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] group"
                    >
                      <div className="aspect-square bg-zinc-800 overflow-hidden">
                        <img
                          src={product.image || IMG_FALLBACK}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={e => { e.target.src = IMG_FALLBACK; }}
                        />
                      </div>
                      <div className="p-3">
                        <h3
                          className="font-semibold text-zinc-200 text-sm leading-tight line-clamp-2 mb-1.5"
                          style={{ fontFamily: 'Sora, sans-serif' }}
                        >
                          {product.name}
                        </h3>
                        <p className="text-orange-400 font-bold text-sm">₹{product.price.toFixed(2)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Product Detail Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={closeModal}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md animate-slide-up overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Large image */}
            <div className="aspect-video bg-zinc-800 relative overflow-hidden">
              <img
                src={selected.image || IMG_FALLBACK}
                alt={selected.name}
                className="w-full h-full object-cover"
                onError={e => { e.target.src = IMG_FALLBACK; }}
              />
              <button
                onClick={closeModal}
                className="absolute top-3 right-3 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5">
              <h2 className="text-xl font-bold text-white mb-1 leading-tight" style={{ fontFamily: 'Sora, sans-serif' }}>
                {selected.name}
              </h2>
              {selected.description && (
                <p className="text-zinc-500 text-sm mb-3 leading-relaxed">{selected.description}</p>
              )}
              <p className="text-orange-400 font-bold text-2xl mb-5" style={{ fontFamily: 'Sora, sans-serif' }}>
                ₹{selected.price.toFixed(2)}
              </p>

              {/* Qty Selector */}
              <div className="flex items-center justify-between mb-5">
                <span className="text-zinc-400 text-sm font-medium">Quantity</span>
                <div className="flex items-center gap-3 bg-zinc-800 rounded-xl p-1">
                  <button
                    onClick={() => setQty(q => Math.max(1, q - 1))}
                    className="w-8 h-8 rounded-lg hover:bg-zinc-700 flex items-center justify-center text-zinc-300 transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-white font-bold text-lg w-8 text-center" style={{ fontFamily: 'Sora, sans-serif' }}>
                    {qty}
                  </span>
                  <button
                    onClick={() => setQty(q => q + 1)}
                    className="w-8 h-8 rounded-lg hover:bg-zinc-700 flex items-center justify-center text-zinc-300 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <button onClick={handleAddToCart} className="w-full btn-primary py-3.5 flex items-center justify-center gap-2 text-base">
                <ShoppingCart className="w-5 h-5" />
                Add to Cart — ₹{(selected.price * qty).toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
