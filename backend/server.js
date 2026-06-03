const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Support multiple origins from comma-separated CLIENT_URL env var
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Make io accessible in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room: ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Sync token counter with the highest existing tokenNumber in DB
async function syncTokenCounter() {
  const Counter = require('./models/Counter');
  const Order = require('./models/Order');
  const lastOrder = await Order.findOne({}, { tokenNumber: 1 }).sort({ tokenNumber: -1 }).lean();
  const maxToken = lastOrder?.tokenNumber || 0;
  const counter = await Counter.findOne({ _id: 'tokenNumber' });
  if (!counter) {
    await Counter.create({ _id: 'tokenNumber', seq: maxToken });
    console.log(`Token counter initialized at ${maxToken}`);
  } else if (counter.seq < maxToken) {
    await Counter.updateOne({ _id: 'tokenNumber' }, { $set: { seq: maxToken } });
    console.log(`Token counter synced to ${maxToken}`);
  }
}

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(async () => {
    console.log('MongoDB connected');
    await syncTokenCounter();
    server.listen(process.env.PORT || 5000, () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

module.exports = { io };
