const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const jwt = require('jsonwebtoken');
const Product = require('../models/Product');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer → Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'order-system/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
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
    const { name, price, category, description, isAvailable, sortOrder, unit } = req.body;
    const product = await Product.create({
      name,
      price: parseFloat(price),
      category,
      description,
      isAvailable: isAvailable !== 'false',
      sortOrder: parseInt(sortOrder) || 0,
      unit: unit || 'kg',
      image: req.file ? req.file.path : '',
    });
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/products/:id — Admin only
router.put('/:id', protect, restrictTo('admin'), upload.single('image'), async (req, res) => {
  try {
    const { name, price, category, description, isAvailable, sortOrder, unit } = req.body;
    const updateData = {
      name, price: parseFloat(price), category, description,
      isAvailable: isAvailable !== 'false',
      sortOrder: parseInt(sortOrder) || 0,
      unit: unit || 'kg',
    };
    if (req.file) updateData.image = req.file.path;

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
