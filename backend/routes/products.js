const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;
const jwt = require('jsonwebtoken');
const Product = require('../models/Product');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Accept raw upload into memory — sharp will process it before Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only images allowed'), false);
    cb(null, true);
  },
});

function uploadStream(buffer) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder: 'order-system/products', resource_type: 'image' },
      (err, result) => { if (err) reject(err); else resolve(result); }
    ).end(buffer);
  });
}

// Sharp: resize + convert to WebP, then upload to Cloudinary
async function processImage(req, res, next) {
  if (!req.file) return next();
  try {
    const webp = await sharp(req.file.buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    const result = await uploadStream(webp);
    req.file.cloudinaryUrl = result.secure_url;
    next();
  } catch (err) {
    next(err);
  }
}

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
    const products = await Product.find(
      isAdmin ? {} : { isAvailable: true, isDeleted: { $ne: true } }
    ).sort({ category: 1, sortOrder: 1, name: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/products — Admin only
router.post('/', protect, restrictTo('admin'), upload.single('image'), processImage, async (req, res) => {
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
      image: req.file?.cloudinaryUrl || '',
    });
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/products/:id — Admin only
router.put('/:id', protect, restrictTo('admin'), upload.single('image'), processImage, async (req, res) => {
  try {
    const { name, price, category, description, isAvailable, sortOrder, unit } = req.body;
    const updateData = {
      name, price: parseFloat(price), category, description,
      isAvailable: isAvailable !== 'false',
      sortOrder: parseInt(sortOrder) || 0,
      unit: unit || 'kg',
    };
    if (req.file?.cloudinaryUrl) updateData.image = req.file.cloudinaryUrl;

    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/products/:id — Admin only (soft delete — preserves order refs)
router.delete('/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true, isAvailable: false },
      { new: true }
    );
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product archived', product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/products/:id/restore — Admin only
router.patch('/:id/restore', protect, restrictTo('admin'), async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isDeleted: false },
      { new: true }
    );
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
