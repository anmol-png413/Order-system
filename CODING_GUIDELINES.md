# Coding Guidelines — Green Sweets Order System

Ye guidelines is project mein kaam karte waqt follow karni hain. Inka goal hai ki code readable, fast, aur maintainable rahe.

---

## 1. Backend Architecture — MVC Pattern

Backend ko **Model → Controller → Route** ke teen layers mein organize karo.

```
backend/
  models/        ← Mongoose schemas (data + DB logic)
  controllers/   ← Business logic (kya karna hai)
  routes/        ← URL mapping (kahan jaana hai)
  middleware/    ← Auth, validation, error handling
  utils/         ← Reusable helpers
```

### Model (models/)
- Sirf schema aur DB-level logic rakhein.
- Schema mein `required`, `default`, `min/max` validators zaroor likho.
- Computed fields ya aggregations model mein nahi — controller mein.

```js
// SAHI — model sirf data shape define karta hai
const orderItemSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  price:         { type: Number, required: true, min: 0 },
  quantity:      { type: Number, required: true, min: 1 },
  unit:          { type: String, default: 'kg' },
}, { _id: false });
```

### Controller (controllers/)
- Route handler ka actual kaam controller mein hoga.
- `req`, `res` sirf controller tak. Uske andar helper functions `req/res` nahi lenge.
- Ek controller function = ek kaam.

```js
// controllers/orderController.js
exports.createOrder = async (req, res) => {
  const { items, notes } = req.body;
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const order = await Order.create({ items, notes, totalAmount: total });
  req.io.to('packing').emit('new-order', order);
  res.status(201).json(order);
};
```

### Route (routes/)
- Sirf URL + middleware + controller ka mapping.
- Business logic route file mein nahi likhni.

```js
// routes/orders.js
const { createOrder, getOrders } = require('../controllers/orderController');

router.get('/',    protect, getOrders);
router.post('/',   createOrder);
```

---

## 2. Backend — Performance Rules

### DB Queries
- Hamesha `lean()` use karo jab sirf data read karna ho (update/save nahi):
  ```js
  const orders = await Order.find(filter).lean();  // 2x faster than without lean
  ```
- `select()` se sirf zaruri fields lo:
  ```js
  await User.findById(id).select('name role').lean();
  ```
- Indexes lagao frequently queried fields pe. Is project mein:
  - `Order`: `createdAt`, `status`, `bulk.phone`
  - `Product`: `category`
  - `User`: `username`
- N+1 query se bachao — `populate()` ek hi query mein karo:
  ```js
  // GALAT — loop mein query
  for (const order of orders) {
    order.user = await User.findById(order.createdBy);
  }
  
  // SAHI — ek populate
  await Order.find().populate('createdBy', 'name');
  ```

### API Response
- List endpoints mein hamesha `.limit()` lagao:
  ```js
  .limit(role === 'admin' ? 200 : 100)
  ```
- Date range filter lagao non-admin users ke liye — unlimited data kabhi mat do.
- `Promise.all()` se parallel queries chalaao:
  ```js
  const [total, revenue] = await Promise.all([
    Order.countDocuments(filter),
    Order.aggregate([...]),
  ]);
  ```

### Socket.io
- Sirf zaruri rooms ko emit karo. Broadcast (`io.emit`) kabhi mat karo.
  ```js
  // SAHI — targeted rooms
  req.io.to('packing').emit('new-order', order);
  req.io.to('staff').emit('new-order', order);
  
  // GALAT — sab ko bhej do
  req.io.emit('new-order', order);
  ```
- Socket event names consistent rakho: `new-order`, `order-updated`, `order-deleted`.

---

## 3. Frontend — React Performance

### State Management
- `useState` sirf local UI state ke liye. Shared state ke liye Context use karo.
- Polling + Socket dono saath chalate hain — deduplication zaroor karo:
  ```js
  // Socket handler mein hamesha check karo duplicate to nahi
  'new-order': (order) => {
    setOrders(prev => prev.find(o => o._id === order._id) ? prev : [order, ...prev]);
  }
  ```
- Polling mein `setOrders(res.data)` se state replace hoti hai — agar API empty array de (e.g., midnight filter shift) toh screen blank ho jaayegi. Isliye packing ke liye backend 24-hour rolling window use karta hai.

### useCallback / useEffect
- `fetchOrders` ko `useCallback` mein wrap karo taaki re-renders pe naya function nahi banega:
  ```js
  const fetchOrders = useCallback((showError = false) => {
    axios.get('/api/orders')
      .then(res => setOrders(res.data))
      .catch(() => { if (showError) toast.error('Failed to fetch'); })
      .finally(() => setLoading(false));
  }, []);  // empty deps — function kabhi nahi badlega
  ```
- Cleanup hamesha karo intervals aur socket listeners ka:
  ```js
  useEffect(() => {
    fetchOrders(true);
    const interval = setInterval(() => fetchOrders(false), 3000);
    return () => clearInterval(interval);
  }, [fetchOrders]);
  ```

### Polling Pattern (Fallback)
- Socket.io primary, polling secondary (fallback for Render free tier WebSocket drops).
- Background polls mein errors toast mat karo — sirf first load pe:
  ```js
  // showError=true  → first load, error dikhao
  // showError=false → background poll, silently fail
  const fetchOrders = useCallback((showError = false) => { ... });
  
  fetchOrders(true);                                    // initial
  setInterval(() => fetchOrders(false), 3000);          // background
  ```
- Polling interval: **3 seconds** (1s bahut frequent hai, 10s bahut slow).

### Images
- Hamesha `loading="lazy"` laগاo images pe.
- `onError` fallback zaroor rakho:
  ```jsx
  <img
    src={item.image || IMG_FALLBACK}
    loading="lazy"
    onError={e => { e.target.src = IMG_FALLBACK; }}
  />
  ```
- `IMG_FALLBACK` ek inline SVG use karta hai — external URL mat use karo (extra HTTP request).

---

## 4. Frontend — Code Organization

### File Structure
```
frontend/src/
  pages/          ← Full page components (PackingPage, StaffPage, etc.)
  components/     ← Reusable UI pieces (Navbar, BulkOrderModal, etc.)
  context/        ← Global state (AuthContext, CartContext)
  hooks/          ← Custom hooks (useSocket, useFocusTrap)
  utils/          ← Pure helper functions (printUtils, imageUtils)
```

### Component Rules
- Ek component ka kaam ek hi ho — agar 200+ lines ho jaaye, tod do.
- Page component = data fetching + layout.
- UI component = sirf props se render karna, koi API calls nahi.

### Naming Conventions
- Components: `PascalCase` → `PackingPage`, `BulkOrderModal`
- Hooks: `camelCase` with `use` prefix → `useSocket`, `useFocusTrap`
- Utils: `camelCase` → `fmtUnit`, `printSlip`
- Constants: `UPPER_SNAKE` → `IMG_FALLBACK`, `ALLOWED_ROOMS`

---

## 5. Auth & Security

### JWT + HttpOnly Cookie
- Token sirf httpOnly cookie mein — localStorage mein kabhi nahi.
- Logout pe cookie clear karo backend se (res.clearCookie).
- `protect` middleware har private route pe lagao.

### Role-Based Access
```
admin   → sab kuch
staff   → orders place/delete
packing → order status update
counter → completed orders dekhna
```
- Role check backend mein karo, frontend pe sirf UI hide/show ke liye.
- `restrictTo('admin', 'packing')` middleware use karo route pe.

### Input Validation
- User input backend pe validate karo:
  ```js
  if (!items || items.length === 0)
    return res.status(400).json({ message: 'Order must have at least one item' });
  ```
- Numbers parse karo `Number()` se, trust mat karo client ka type.

---

## 6. Error Handling

### Backend
- Har async route mein try/catch hona chahiye.
- Meaningful HTTP status codes do:
  - `400` — bad request (validation fail)
  - `401` — unauthenticated
  - `403` — unauthorized (role mismatch)
  - `404` — resource not found
  - `500` — server error

### Frontend
- Initial load errors: `toast.error()` dikhao.
- Background polling errors: silently fail (showError pattern).
- Status update failures: toast + optimistic update rollback.

---

## 7. Real-Time Architecture

```
Browser (Socket.io client)
       ↕ WebSocket (primary)
Backend (Socket.io server)
  Rooms: staff, packing, counter, admin

If WebSocket drops (Render free tier):
  → 3s polling fallback takes over
  → Dedup ensures no duplicate entries
```

### Event Types
| Event | Sender | Receivers |
|---|---|---|
| `new-order` | POST /api/orders | packing, admin, staff |
| `order-updated` | PATCH /api/orders/:id/status | packing, counter, admin, staff |
| `order-deleted` | DELETE /api/orders/:id | packing, counter, admin, staff |

### Date Filters (Backend)
| Role | Filter |
|---|---|
| `packing` | Last 24 hours (rolling window) |
| `counter` | Last 2 hours (by `packedAt`) |
| `staff` | Today midnight onwards |
| `admin` | No filter (all data, with date picker) |

> **Packing 24h rule:** `today midnight` filter midnight pe shift ho jaata hai → screen blank. Isliye packing ke liye rolling 24h window use karta hai.

---

## 8. Common Mistakes — Mat Karo

| Galti | Sahi Tarika |
|---|---|
| Business logic route file mein | Controller mein le jaao |
| `io.emit()` broadcast | `io.to('room').emit()` |
| DB query bina `.limit()` | Hamesha limit lagao |
| Manual state add + socket add = duplicate | Socket handler mein dedup check karo |
| `loading=true` polling pe | `setLoading(false)` sirf initial load tak |
| `unit` field schema mein missing | Mongoose strips unknown fields — schema mein zaroori |
| Toast error har poll pe | `showError` parameter pattern use karo |
| Image bina fallback | `onError` hamesha rakho |

---

## 9. Environment Variables

### Backend (.env)
```
MONGO_URI=mongodb+srv://...
JWT_SECRET=strong-random-secret
PORT=5000
CLIENT_URL=https://your-vercel-app.vercel.app
```

### Frontend (Vercel dashboard)
```
VITE_BACKEND_URL=https://your-render-app.onrender.com
```

> `VITE_BACKEND_URL` sirf Socket.io direct connection ke liye hai. API calls Vercel rewrite se `/api` proxy se jaati hain.

---

## 10. Git Workflow

- Commit messages short aur meaningful rakho:
  ```
  fix: packing midnight data wipe
  feat: bulk order balance tracking
  chore: update submodule
  ```
- Root repo (`Order-system`) mein `backend/` + `frontend/` files hain.
- Submodule (`order-system/`) deploy hota hai Render pe — dono mein same fix karo.
- Push order: **submodule pehle → root repo baad mein**.
