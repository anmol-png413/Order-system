const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Order = require('../models/Order');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');

// GET /api/orders — filtered by role
router.get('/', protect, async (req, res) => {
  try {
    let filter = {};
    const { status, date } = req.query;

    if (req.user.role === 'packing') {
      filter.status = { $in: ['pending', 'in-progress', 'completed'] };
    } else if (req.user.role === 'counter') {
      filter.status = 'completed';
      // Last 2 hours for counter
      filter.packedAt = { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) };
    }

    if (status && req.user.role === 'admin') filter.status = status;

    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: d, $lte: end };
    } else if (req.user.role !== 'admin') {
      // Default: today's orders
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filter.createdAt = { $gte: today };
    }

    const orders = await Order.find(filter)
      .populate('items.product', 'name image')
      .populate('createdBy', 'name')
      .populate('packedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(req.user.role === 'admin' ? 200 : 100);

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/orders — public (customers) or authenticated staff/admin
router.post('/', async (req, res) => {
  try {
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer')) {
      try {
        const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('_id');
        if (user) userId = user._id;
      } catch {}
    }

    const { items, notes, discountPercent = 0, bulk } = req.body;
    if (!items || items.length === 0)
      return res.status(400).json({ message: 'Order must have at least one item' });

    const parsedDiscount = Number(discountPercent) || 0;
    if (parsedDiscount < 0 || parsedDiscount > 100)
      return res.status(400).json({ message: 'Discount percent must be between 0 and 100' });

    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountAmount = +(totalAmount * (parsedDiscount / 100)).toFixed(2);
    const payableAmount = +(totalAmount - discountAmount).toFixed(2);

    const bulkInfo = bulk ? {
      phone: bulk.phone || '',
      advance: Number(bulk.advance) || 0,
      schedule: bulk.schedule ? new Date(bulk.schedule) : undefined,
      balance: +(payableAmount - (Number(bulk.advance) || 0)).toFixed(2),
    } : undefined;

    const order = await Order.create({
      items,
      totalAmount,
      notes,
      discountPercent: parsedDiscount,
      discountAmount,
      payableAmount,
      bulk: bulkInfo,
      ...(userId && { createdBy: userId }),
    });

    if (userId) await order.populate('createdBy', 'name');

    req.io.to('packing').emit('new-order', order);
    req.io.to('admin').emit('new-order', order);

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/orders/:id/status — Packing team updates status
router.patch('/:id/status', protect, restrictTo('packing', 'admin'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'in-progress', 'completed'].includes(status))
      return res.status(400).json({ message: 'Invalid status' });

    const updateData = { status };
    if (status === 'completed') {
      updateData.packedBy = req.user._id;
      updateData.packedAt = new Date();
    }

    const order = await Order.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate('createdBy', 'name')
      .populate('packedBy', 'name');

    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Emit status update to all relevant rooms
    req.io.to('packing').emit('order-updated', order);
    req.io.to('counter').emit('order-updated', order);
    req.io.to('admin').emit('order-updated', order);
    req.io.to('staff').emit('order-updated', order);

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/orders/bulk — Admin bulk delete (MUST be before /:id)
router.delete('/bulk', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { count } = req.body;
    let deleted = 0;
    if (count === 'all') {
      const result = await Order.deleteMany({});
      deleted = result.deletedCount;
    } else {
      const n = parseInt(count);
      if (!n || n <= 0) return res.status(400).json({ message: 'Invalid count' });
      const oldest = await Order.find({}).sort({ createdAt: 1 }).limit(n).select('_id').lean();
      const ids = oldest.map(o => o._id);
      const result = await Order.deleteMany({ _id: { $in: ids } });
      deleted = result.deletedCount;
    }
    res.json({ message: `${deleted} orders deleted` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/orders/:id — Staff/Admin delete a completed order
router.delete('/:id', protect, restrictTo('staff', 'admin'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'completed')
      return res.status(400).json({ message: 'Only completed orders can be deleted' });

    await Order.findByIdAndDelete(req.params.id);

    req.io.to('packing').emit('order-deleted', { _id: req.params.id });
    req.io.to('counter').emit('order-deleted', { _id: req.params.id });
    req.io.to('admin').emit('order-deleted', { _id: req.params.id });

    res.json({ message: 'Order deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/orders/stats — Admin dashboard stats
router.get('/stats', protect, restrictTo('admin'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, pending, inProgress, completed, revenue, totalRevenue] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: today } }),
      Order.countDocuments({ createdAt: { $gte: today }, status: 'pending' }),
      Order.countDocuments({ createdAt: { $gte: today }, status: 'in-progress' }),
      Order.countDocuments({ createdAt: { $gte: today }, status: 'completed' }),
      Order.aggregate([
        { $match: { createdAt: { $gte: today }, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Order.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
    ]);

    res.json({
      today: { total, pending, inProgress, completed },
      revenue: revenue[0]?.total || 0,
      totalRevenue: totalRevenue[0]?.total || 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
