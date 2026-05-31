const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const Product = require('../models/Product');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/products');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `product-${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only images allowed'), false);
    }
    cb(null, true);
  },
});

// GET /api/products — public; admins see all, everyone else sees only available
router.get('/', async (req, res) => {
  try {
    let isAdmin = false;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer')) {
      try {
        const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('role');
        if (user?.role === 'admin') isAdmin = true;
      } catch {}
    }
    const products = await Product.find(isAdmin ? {} : { isAvailable: true })
      .sort({ category: 1, sortOrder: 1, name: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/products — Admin only
router.post('/', protect, restrictTo('admin'), upload.single('image'), async (req, res) => {
  try {
    const { name, price, category, description, isAvailable, sortOrder } = req.body;
    const product = await Product.create({
      name,
      price: parseFloat(price),
      category,
      description,
      isAvailable: isAvailable !== 'false',
      sortOrder: parseInt(sortOrder) || 0,
      image: req.file ? `/uploads/products/${req.file.filename}` : '',
    });
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/products/:id — Admin only
router.put('/:id', protect, restrictTo('admin'), upload.single('image'), async (req, res) => {
  try {
    const { name, price, category, description, isAvailable, sortOrder } = req.body;
    const updateData = {
      name, price: parseFloat(price), category, description,
      isAvailable: isAvailable !== 'false',
      sortOrder: parseInt(sortOrder) || 0,
    };
    if (req.file) updateData.image = `/uploads/products/${req.file.filename}`;

    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/products/:id — Admin only
router.delete('/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
