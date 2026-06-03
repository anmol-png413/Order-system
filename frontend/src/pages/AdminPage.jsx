import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { Plus, Edit2, Trash2, X, BarChart3, Package, Users, ShoppingBag, Upload, Eye, EyeOff, AlertTriangle, ClipboardList, Clock } from 'lucide-react';

const IMG_FALLBACK = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="%231a1a1a"/><text x="40" y="44" text-anchor="middle" font-size="28" fill="%23444">🍽️</text></svg>';

const TABS = ['Dashboard', 'Products', 'Users', 'Orders'];
const ROLES = ['staff', 'packing', 'counter', 'admin'];

const STATUS_COLORS = {
  pending: 'bg-yellow-500/15 text-yellow-400',
  'in-progress': 'bg-blue-500/15 text-blue-400',
  completed: 'bg-green-500/15 text-green-400',
};

export default function AdminPage() {
  const [tab, setTab] = useState('Dashboard');
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Product modal
  const [productModal, setProductModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', price: '', category: '', description: '', isAvailable: true, unit: 'kg' });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [saving, setSaving] = useState(false);

  // Orders tab
  const [orders, setOrders] = useState([]);
  const [deletingOrder, setDeletingOrder] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, name }

  // User modal
  const [userModal, setUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', username: '', password: '', role: 'staff' });
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (tab === 'Dashboard') fetchStats();
    if (tab === 'Products') fetchProducts();
    if (tab === 'Users') fetchUsers();
    if (tab === 'Orders') fetchOrders();
  }, [tab]);

  const fetchOrders = async () => {
    setLoading(true);
    try { const res = await axios.get('/api/orders'); setOrders(res.data); }
    catch { toast.error('Failed to load orders'); }
    finally { setLoading(false); }
  };

  const deleteOrder = async (orderId, tokenNumber) => {
    setDeletingOrder(orderId);
    try {
      await axios.delete(`/api/orders/${orderId}`);
      setOrders(prev => prev.filter(o => o._id !== orderId));
      toast.success(`Token #${tokenNumber} deleted`);
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete order');
    } finally { setDeletingOrder(null); }
  };

  const bulkDelete = async (count) => {
    const label = count === 'all' ? 'ALL orders' : `${count} oldest orders`;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    setBulkLoading(true);
    try {
      const res = await axios.delete('/api/orders/bulk', { data: { count } });
      toast.success(res.data.message);
      fetchOrders();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk delete failed');
    } finally { setBulkLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get('/api/orders/stats');
      setStats(res.data);
    } catch { toast.error('Failed to load stats'); }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try { const res = await axios.get('/api/products'); setProducts(res.data); }
    catch { toast.error('Failed to load products'); }
    finally { setLoading(false); }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try { const res = await axios.get('/api/auth/users'); setUsers(res.data); }
    catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  const openProductModal = (product = null) => {
    setEditProduct(product);
    setProductForm(product
      ? { name: product.name, price: product.price, category: product.category, description: product.description || '', isAvailable: product.isAvailable, unit: product.unit || 'kg' }
      : { name: '', price: '', category: '', description: '', isAvailable: true, unit: 'kg' });
    setImageFile(null);
    setImagePreview(product?.image || '');
    setProductModal(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const saveProduct = async () => {
    if (!productForm.name || !productForm.price || !productForm.category)
      return toast.error('Name, price and category are required');
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(productForm).forEach(([k, v]) => fd.append(k, v));
      if (imageFile) fd.append('image', imageFile);

      if (editProduct) {
        const res = await axios.put(`/api/products/${editProduct._id}`, fd);
        setProducts(prev => prev.map(p => p._id === editProduct._id ? res.data : p));
        toast.success('Product updated');
      } else {
        const res = await axios.post('/api/products', fd);
        setProducts(prev => [res.data, ...prev]);
        toast.success('Product added');
      }
      setProductModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save product');
    } finally { setSaving(false); }
  };

  const confirmDelete = (id, name) => setDeleteConfirm({ id, name });

  const deleteProduct = async () => {
    if (!deleteConfirm) return;
    try {
      await axios.delete(`/api/products/${deleteConfirm.id}`);
      setProducts(prev => prev.filter(p => p._id !== deleteConfirm.id));
      toast.success('Product deleted');
    } catch { toast.error('Failed to delete'); }
    finally { setDeleteConfirm(null); }
  };

  const saveUser = async () => {
    if (!userForm.name || !userForm.username || !userForm.password)
      return toast.error('All fields are required');
    try {
      const res = await axios.post('/api/auth/users', userForm);
      setUsers(prev => [res.data.user, ...prev]);
      toast.success('User created');
      setUserModal(false);
      setUserForm({ name: '', username: '', password: '', role: 'staff' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    }
  };

  const deleteUser = async (id) => {
    if (!confirm('Deactivate this user?')) return;
    try {
      await axios.delete(`/api/auth/users/${id}`);
      setUsers(prev => prev.filter(u => u._id !== id));
      toast.success('User deactivated');
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar title="Admin Panel" subtitle="Manage your system" />

      {/* Tabs */}
      <div className="border-b border-zinc-800 sticky top-16 z-40 bg-zinc-950 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 flex gap-0 pt-1 min-w-max">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-3 sm:px-5 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors min-h-[44px] whitespace-nowrap ${
                tab === t ? 'border-orange-500 text-orange-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`} style={{ fontFamily: 'Sora, sans-serif' }}>
              {t === 'Dashboard' && <BarChart3 className="w-3.5 h-3.5" />}
              {t === 'Products' && <Package className="w-3.5 h-3.5" />}
              {t === 'Users' && <Users className="w-3.5 h-3.5" />}
              {t === 'Orders' && <ClipboardList className="w-3.5 h-3.5" />}
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">

        {/* ── DASHBOARD TAB ── */}
        {tab === 'Dashboard' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Sora, sans-serif' }}>Today's Overview</h2>
            {stats ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Orders', value: stats.today.total, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
                    { label: 'Pending', value: stats.today.pending, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
                    { label: 'In Progress', value: stats.today.inProgress, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
                    { label: 'Completed', value: stats.today.completed, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
                  ].map(s => (
                    <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
                      <p className="text-zinc-500 text-xs uppercase tracking-wide mb-2">{s.label}</p>
                      <p className={`text-3xl sm:text-4xl font-extrabold ${s.color}`} style={{ fontFamily: 'Sora, sans-serif' }}>{s.value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="card p-4 sm:p-6">
                    <p className="text-zinc-500 text-sm mb-2">Revenue Today</p>
                    <p className="text-2xl sm:text-4xl font-extrabold text-orange-400 break-all" style={{ fontFamily: 'Sora, sans-serif' }}>₹{stats.revenue.toFixed(2)}</p>
                  </div>
                  <div className="card p-4 sm:p-6 border-orange-500/30 bg-orange-500/5">
                    <p className="text-zinc-500 text-sm mb-2">Total Revenue (All Time)</p>
                    <p className="text-2xl sm:text-4xl font-extrabold text-orange-400 break-all" style={{ fontFamily: 'Sora, sans-serif' }}>₹{stats.totalRevenue.toFixed(2)}</p>
                  </div>
                </div>
                <div className="card p-5">
                  <h3 className="font-semibold text-zinc-300 mb-1" style={{ fontFamily: 'Sora, sans-serif' }}>Quick Setup</h3>
                  <p className="text-xs text-zinc-600 mb-4">First time? Seed the database with demo accounts</p>
                  <button onClick={async () => {
                    try { await axios.post('/api/auth/seed'); toast.success('Demo accounts created!'); }
                    catch (err) { toast.error(err.response?.data?.message || 'Seed failed'); }
                  }} className="btn-ghost text-sm">Seed Demo Data</button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* ── PRODUCTS TAB ── */}
        {tab === 'Products' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Sora, sans-serif' }}>Products</h2>
              <button onClick={() => openProductModal()} className="btn-primary flex items-center gap-2 min-h-[44px]">
                <Plus className="w-4 h-4" /> Add Product
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24">
                <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {products.map(p => (
                  <div key={p._id} className={`card overflow-hidden ${!p.isAvailable ? 'opacity-50' : ''}`}>
                    <div className="aspect-video bg-zinc-800 overflow-hidden relative">
                      <img src={p.image || IMG_FALLBACK} alt={p.name}
                        className="w-full h-full object-cover" onError={e => { e.target.src = IMG_FALLBACK; }} />
                      {/* Unit badge */}
                      <span className="absolute top-2 left-2 bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                        {p.unit === 'piece' ? 'P/p' : '/kg'}
                      </span>
                      {!p.isAvailable && <span className="absolute top-2 right-2 bg-zinc-900/80 text-zinc-400 text-xs px-2 py-0.5 rounded-lg">Hidden</span>}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-zinc-200 text-sm leading-tight mb-0.5" style={{ fontFamily: 'Sora, sans-serif' }}>{p.name}</h3>
                      <p className="text-xs text-zinc-600 mb-1">{p.category}</p>
                      <p className="text-orange-400 font-bold">₹{p.price.toFixed(2)} <span className="text-zinc-600 text-xs font-normal">{p.unit === 'piece' ? '/piece' : '/kg'}</span></p>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => openProductModal(p)}
                          className="flex-1 btn-ghost text-xs py-2.5 flex items-center justify-center gap-1 min-h-[40px]">
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button onClick={() => confirmDelete(p._id, p.name)}
                          className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1 min-h-[40px]">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {products.length === 0 && (
                  <div className="col-span-full text-center py-16 text-zinc-600">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No products yet. Add your first product!</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── ORDERS TAB ── */}
        {tab === 'Orders' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Sora, sans-serif' }}>
                All Orders
                <span className="ml-3 text-sm font-normal text-zinc-500">{orders.length} total</span>
              </h2>
              <div className="flex items-center gap-2">
                <button onClick={fetchOrders} className="btn-ghost text-sm min-h-[44px]">Refresh</button>
                {/* Bulk delete dropdown */}
                <div className="relative group">
                  <button
                    disabled={bulkLoading}
                    className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all min-h-[44px] disabled:opacity-50"
                    style={{ fontFamily: 'Sora, sans-serif' }}
                  >
                    {bulkLoading ? (
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Delete
                    <span className="text-xs">▾</span>
                  </button>
                  {/* Dropdown */}
                  <div className="absolute right-0 top-full mt-1 w-44 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    {[
                      { label: 'Delete 10 orders', count: 10 },
                      { label: 'Delete 50 orders', count: 50 },
                      { label: 'Delete ALL orders', count: 'all' },
                    ].map(opt => (
                      <button key={opt.count}
                        onClick={() => bulkDelete(opt.count)}
                        className={`w-full text-left px-4 py-3 text-sm transition-colors hover:bg-zinc-800 ${opt.count === 'all' ? 'text-red-400 font-semibold border-t border-zinc-800' : 'text-zinc-300'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24">
                <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-16 text-zinc-600">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No orders today</p>
              </div>
            ) : (
              <div className="space-y-2">
                {orders.map(order => (
                  <div key={order._id} className="card px-3 py-3 flex items-start gap-3">
                    {/* Token */}
                    <div className="w-11 h-11 bg-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-extrabold text-sm" style={{ fontFamily: 'Sora, sans-serif' }}>
                        #{order.tokenNumber}
                      </span>
                    </div>

                    {/* Items + time */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 min-w-0">
                            <div className="w-6 h-6 rounded-md bg-zinc-800 overflow-hidden flex-shrink-0">
                              <img src={item.image || IMG_FALLBACK} alt={item.name} loading="lazy"
                                className="w-full h-full object-cover"
                                onError={e => { e.target.src = IMG_FALLBACK; }} />
                            </div>
                            <span className="text-zinc-300 text-xs truncate max-w-[100px]">{item.name}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-zinc-600 text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(order.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-orange-400 text-xs font-semibold">₹{order.totalAmount?.toFixed(2)}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}>
                          {order.status}
                        </span>
                      </div>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => deleteOrder(order._id, order.tokenNumber)}
                      disabled={deletingOrder === order._id}
                      className="w-9 h-9 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all flex-shrink-0 disabled:opacity-50 mt-0.5"
                    >
                      {deletingOrder === order._id
                        ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── USERS TAB ── */}
        {tab === 'Users' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Sora, sans-serif' }}>Staff Accounts</h2>
              <button onClick={() => setUserModal(true)} className="btn-primary flex items-center gap-2 min-h-[44px]">
                <Plus className="w-4 h-4" /> Add User
              </button>
            </div>
            {/* Mobile: cards, Desktop: table */}
            <div className="sm:hidden space-y-2">
              {users.map(u => (
                <div key={u._id} className="card px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-200 font-medium text-sm">{u.name}</p>
                    <p className="text-zinc-500 text-xs font-mono">{u.username}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
                    u.role === 'admin' ? 'bg-purple-500/15 text-purple-400'
                    : u.role === 'staff' ? 'bg-orange-500/15 text-orange-400'
                    : u.role === 'packing' ? 'bg-blue-500/15 text-blue-400'
                    : 'bg-green-500/15 text-green-400'
                  }`}>{u.role}</span>
                  <button onClick={() => deleteUser(u._id)} className="text-zinc-600 hover:text-red-400 transition-colors p-1 flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="hidden sm:block card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      {['Name', 'Username', 'Role', 'Created', ''].map(h => (
                        <th key={h} className="text-left text-xs text-zinc-500 uppercase tracking-wide px-5 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u._id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                        <td className="px-5 py-3.5 text-zinc-200 font-medium">{u.name}</td>
                        <td className="px-5 py-3.5 text-zinc-400 font-mono text-xs">{u.username}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            u.role === 'admin' ? 'bg-purple-500/15 text-purple-400'
                            : u.role === 'staff' ? 'bg-orange-500/15 text-orange-400'
                            : u.role === 'packing' ? 'bg-blue-500/15 text-blue-400'
                            : 'bg-green-500/15 text-green-400'
                          }`}>{u.role}</span>
                        </td>
                        <td className="px-5 py-3.5 text-zinc-600 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td className="px-5 py-3.5">
                          <button onClick={() => deleteUser(u._id)} className="text-zinc-600 hover:text-red-400 transition-colors p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── DELETE CONFIRM MODAL ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-pop">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-500/15 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-white" style={{ fontFamily: 'Sora, sans-serif' }}>Delete Product?</h3>
                <p className="text-zinc-500 text-sm">This cannot be undone</p>
              </div>
            </div>
            <p className="text-zinc-300 text-sm mb-6 bg-zinc-800 rounded-xl px-4 py-3">
              <span className="font-semibold text-white">"{deleteConfirm.name}"</span> will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 btn-ghost min-h-[44px]">Cancel</button>
              <button onClick={deleteProduct}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 rounded-xl transition-colors min-h-[44px]"
                style={{ fontFamily: 'Sora, sans-serif' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRODUCT MODAL ── */}
      {productModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md my-8 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-white text-lg" style={{ fontFamily: 'Sora, sans-serif' }}>
                {editProduct ? 'Edit Product' : 'Add Product'}
              </h3>
              <button onClick={() => setProductModal(false)} className="text-zinc-500 hover:text-zinc-300 w-9 h-9 flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Image Upload */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wide">Product Image</label>
              <div className="aspect-video bg-zinc-800 rounded-xl overflow-hidden mb-2 flex items-center justify-center">
                {imagePreview
                  ? <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                  : <Upload className="w-8 h-8 text-zinc-600" />}
              </div>
              <input type="file" accept="image/*" onChange={handleImageChange}
                className="block w-full text-sm text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-orange-500 file:text-white hover:file:bg-orange-600 cursor-pointer" />
            </div>

            <div className="space-y-3">
              {[
                { label: 'Product Name', key: 'name', placeholder: 'e.g. Ladoo' },
                { label: 'Price (₹)', key: 'price', placeholder: 'e.g. 480', type: 'number' },
                { label: 'Description', key: 'description', placeholder: 'Optional description' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wide">{f.label}</label>
                  <input type={f.type || 'text'} value={productForm[f.key]}
                    onChange={e => setProductForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-orange-500 text-sm min-h-[44px]" />
                </div>
              ))}

              {/* Category dropdown */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wide">Category</label>
                <select
                  value={productForm.category}
                  onChange={e => setProductForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:border-orange-500 text-sm min-h-[44px]"
                >
                  <option value="">-- Select Category --</option>
                  <option value="Counter 1">Counter 1</option>
                  <option value="Counter 2">Counter 2</option>
                  <option value="Counter 3">Counter 3</option>
                </select>
              </div>

              {/* Unit Toggle */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wide">Unit / Pricing Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button"
                    onClick={() => setProductForm(p => ({ ...p, unit: 'kg' }))}
                    className={`py-3 rounded-xl font-semibold text-sm transition-all min-h-[44px] ${
                      productForm.unit === 'kg'
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-900/30'
                        : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200'
                    }`} style={{ fontFamily: 'Sora, sans-serif' }}>
                    ⚖️ Per Kg
                  </button>
                  <button type="button"
                    onClick={() => setProductForm(p => ({ ...p, unit: 'piece' }))}
                    className={`py-3 rounded-xl font-semibold text-sm transition-all min-h-[44px] ${
                      productForm.unit === 'piece'
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-900/30'
                        : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200'
                    }`} style={{ fontFamily: 'Sora, sans-serif' }}>
                    🔢 Per Piece (P/p)
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer py-1">
                <input type="checkbox" checked={productForm.isAvailable}
                  onChange={e => setProductForm(p => ({ ...p, isAvailable: e.target.checked }))}
                  className="w-5 h-5 rounded accent-orange-500" />
                <span className="text-sm text-zinc-300">Available for ordering</span>
              </label>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setProductModal(false)} className="flex-1 btn-ghost min-h-[48px]">Cancel</button>
              <button onClick={saveProduct} disabled={saving} className="flex-1 btn-primary min-h-[48px]">
                {saving ? 'Saving…' : editProduct ? 'Update' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── USER MODAL ── */}
      {userModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-white text-lg" style={{ fontFamily: 'Sora, sans-serif' }}>Add Staff Account</h3>
              <button onClick={() => setUserModal(false)} className="text-zinc-500 hover:text-zinc-300 w-9 h-9 flex items-center justify-center"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Full Name', key: 'name', placeholder: 'e.g. Ravi Kumar' },
                { label: 'Username', key: 'username', placeholder: 'e.g. ravi01' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wide">{f.label}</label>
                  <input value={userForm[f.key]} onChange={e => setUserForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-orange-500 text-sm min-h-[44px]" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wide">Password</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={userForm.password}
                    onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="Set password"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 pr-12 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-orange-500 text-sm min-h-[44px]" />
                  <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 p-1">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wide">Role</label>
                <select value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:border-orange-500 text-sm min-h-[44px]">
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setUserModal(false)} className="flex-1 btn-ghost min-h-[48px]">Cancel</button>
              <button onClick={saveUser} className="flex-1 btn-primary min-h-[48px]">Create User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
