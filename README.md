# OrderFlow — Smart Order Management System

A full-stack MERN app with real-time order management for restaurants/food counters.

## 🏗️ Tech Stack
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express.js
- **Database**: MongoDB + Mongoose
- **Real-time**: Socket.io (WebSockets)
- **Auth**: JWT + bcrypt (role-based)

## 👤 Roles
| Role | Access |
|------|--------|
| `admin` | Full access — dashboard, products, users, all orders |
| `staff` | Image-based order taking, generates token |
| `packing` | Live order queue, status updates (Pending → In Progress → Completed) |
| `counter` | View completed orders, hand over by token number |

---

## 🚀 Setup Instructions

### 1. Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)
- npm

### 2. Clone & Install

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Configure Backend

```bash
cd backend
cp .env.example .env
```

Edit `.env`:
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/order-system
JWT_SECRET=change_this_to_a_long_random_string
CLIENT_URL=http://localhost:5173
```

### 4. Start the App

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

App runs at: `http://localhost:5173`

### 5. Seed Demo Accounts (First Time Only)

Open the app → Login page → Click any demo account → Or call:
```
POST http://localhost:5000/api/auth/seed
```

Or use the Admin Dashboard → "Seed Demo Data" button.

**Demo Credentials:**
| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin |
| staff1 | staff123 | Staff |
| packer1 | packer123 | Packing |
| counter1 | counter123 | Counter |

> ⚠️ Change passwords after first login in production!

---

## 📱 Screen Guide

### Staff Screen (`/staff`)
- Browse products by category with images
- Tap to add to cart (quantity shown on card)
- Adjust quantities in cart
- Add notes, place order
- Token number shown in popup → give to customer

### Packing Screen (`/packing`)
- Live incoming orders (Socket.io — no refresh needed)
- Audio alert on new order
- Tap **Start Packing** → status goes In Progress (blue)
- Tap **Mark Completed** → order disappears from queue

### Counter Screen (`/counter`)
- Shows completed orders from last 2 hours
- Token number prominently displayed (green)
- Auto-updates via Socket.io

### Admin Screen (`/admin`)
- **Dashboard**: Today's stats + revenue
- **Products**: Add/edit/delete with image upload
- **Users**: Create staff accounts with roles

---

## 📁 Project Structure

```
order-system/
├── backend/
│   ├── models/
│   │   ├── User.js
│   │   ├── Product.js
│   │   └── Order.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── products.js
│   │   └── orders.js
│   ├── middleware/
│   │   └── auth.js
│   ├── uploads/        ← product images stored here
│   ├── .env.example
│   └── server.js
└── frontend/
    └── src/
        ├── context/
        │   └── AuthContext.jsx
        ├── hooks/
        │   └── useSocket.js
        ├── components/
        │   └── Navbar.jsx
        └── pages/
            ├── LoginPage.jsx
            ├── StaffPage.jsx
            ├── PackingPage.jsx
            ├── CounterPage.jsx
            └── AdminPage.jsx
```

---

## 🌐 Deployment Notes

### MongoDB Atlas (Cloud)
Replace `MONGO_URI` in `.env` with your Atlas connection string.

### Run on same machine, different screens
All screens can be open simultaneously in different browser tabs/windows — they share real-time state via Socket.io.

### For tablet/kiosk use
- Staff: tablet at order counter
- Packing: tablet/monitor in kitchen
- Counter: monitor at handover desk
- Admin: desktop/laptop

---

## 🔧 API Endpoints

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| POST | /api/auth/login | Public | Login |
| GET | /api/auth/me | Any | Current user |
| POST | /api/auth/seed | Public | Seed demo data |
| GET | /api/auth/users | Admin | List users |
| POST | /api/auth/users | Admin | Create user |
| GET | /api/products | Any | List products |
| POST | /api/products | Admin | Add product |
| PUT | /api/products/:id | Admin | Update product |
| DELETE | /api/products/:id | Admin | Delete product |
| GET | /api/orders | Any | List orders (role-filtered) |
| POST | /api/orders | Staff/Admin | Place order |
| PATCH | /api/orders/:id/status | Packing/Admin | Update status |
| GET | /api/orders/stats | Admin | Today's stats |
