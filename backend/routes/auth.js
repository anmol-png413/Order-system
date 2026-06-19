const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1y' });

// Max 10 login attempts per IP per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again after 15 minutes.' },
  skipSuccessfulRequests: true, // successful logins don't count against limit
});

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
};

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: 'Username and password required' });

    const user = await User.findOne({ username, isActive: true });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Invalid credentials' });

    const token = signToken(user._id);

    // Set token in httpOnly cookie (JS se access nahi hoga)
    res.cookie('token', token, COOKIE_OPTIONS);

    res.json({
      user: { id: user._id, name: user.name, username: user.username, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token', COOKIE_OPTIONS);
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me
router.get('/me', protect, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      username: req.user.username,
      role: req.user.role,
    },
  });
});

// POST /api/auth/users — Admin only: create users
router.post('/users', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { name, username, password, role } = req.body;
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ message: 'Username already taken' });

    const user = await User.create({ name, username, password, role });
    res.status(201).json({
      user: { id: user._id, name: user.name, username: user.username, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/users — Admin only: list all users
router.get('/users', protect, restrictTo('admin'), async (req, res) => {
  try {
    const users = await User.find({ isActive: { $ne: false } }).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/auth/users/:id — Admin only
router.delete('/users/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'User deactivated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/seed — One-time setup, requires SEED_SECRET from env
router.post('/seed', async (req, res) => {
  try {
    const secret = req.headers['x-seed-secret'];
    if (!secret || secret !== process.env.SEED_SECRET) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const count = await User.countDocuments();
    if (count > 0) return res.status(400).json({ message: 'Database already seeded' });

    await User.create([
      { name: 'Admin', username: 'admin', password: 'admin123', role: 'admin' },
      { name: 'Staff 1', username: 'staff1', password: 'staff123', role: 'staff' },
      { name: 'Packer 1', username: 'packer1', password: 'packer123', role: 'packing' },
      { name: 'Counter 1', username: 'counter1', password: 'counter123', role: 'counter' },
    ]);

    res.json({ message: 'Seeded successfully', note: 'Change passwords after first login!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
