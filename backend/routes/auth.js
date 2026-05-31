const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: 'Username and password required' });

    const user = await User.findOne({ username, isActive: true });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Invalid credentials' });

    const token = signToken(user._id);
    res.json({
      token,
      user: { id: user._id, name: user.name, username: user.username, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
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
    const users = await User.find().select('-password').sort({ createdAt: -1 });
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

// POST /api/auth/seed — One-time admin setup
router.post('/seed', async (req, res) => {
  try {
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
