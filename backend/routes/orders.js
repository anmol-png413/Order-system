const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Order = require('../models/Order');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');

// "250g" -> 0.25, "1kg" -> 1, "0.5kg" -> 0.5; returns null if unparsable
function parseWeightToKg(input) {
  if (!input) return null;
  const s = String(input).trim().toLowerCase().replace(/\s/g, '');
  if (!s) return null;
  if (s.endsWith('kg')) { const n = parseFloat(s); return isNaN(n) ? null : n; }
  if (s.endsWith('g'))  { const n = parseFloat(s); return isNaN(n) ? null : n / 1000; }
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return n < 10 ? n : n / 1000;
}

// Aggregated {_id, revenue, unit, entries:[{quantity, quantityLabel}]} -> {name, quantitySold, unit, revenue}
function summarizeItems(rawItems) {
  return rawItems.map(i => {
    if (i.unit === 'piece') {
      const totalPieces = i.entries.reduce((s, e) => s + (e.quantity || 0), 0);
      return { name: i._id, quantitySold: totalPieces, unit: 'piece', revenue: +i.revenue.toFixed(2) };
    }
    const totalKg = i.entries.reduce((s, e) => {
      const kgPerUnit = parseWeightToKg(e.quantityLabel);
      return s + (kgPerUnit !== null ? kgPerUnit * (e.quantity || 0) : (e.quantity || 0));
    }, 0);
    return { name: i._id, quantitySold: +totalKg.toFixed(3), unit: i.unit, revenue: +i.revenue.toFixed(2) };
  });
}

// GET /api/orders — filtered by role
router.get('/', protect, async (req, res) => {
  try {
    let filter = {};
    const { status, date } = req.query;

    if (req.user.role === 'packing') {
      filter.status = { $in: ['pending', 'in-progress', 'completed'] };
      filter.$or = [
        { createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        { 'bulk.phone': { $exists: true, $ne: '' }, status: { $ne: 'completed' } },
      ];
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
    } else if (req.user.role === 'staff') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filter.$or = [
        { createdAt: { $gte: today } },
        { 'bulk.phone': { $exists: true, $ne: '' }, status: { $ne: 'completed' } },
      ];
    } else if (req.user.role !== 'admin') {
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
      customerName: bulk.customerName || '',
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
    req.io.to('staff').emit('new-order', order);

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
    if (status === 'in-progress') {
      updateData.packedBy = req.user._id; // who claimed the order
    }
    if (status === 'completed') {
      updateData.packedAt = new Date();
      updateData.packedBy = req.user._id; // who finished it (may differ from who claimed)
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
    const { count, month } = req.body;
    let deleted = 0;

    if (month) {
      const [year, mon] = month.split('-').map(Number);
      const start = new Date(year, mon - 1, 1);
      const end   = new Date(year, mon, 1);
      const result = await Order.deleteMany({ createdAt: { $gte: start, $lt: end } });
      deleted = result.deletedCount;
    } else if (count === 'all') {
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

// DELETE /api/orders/:id — Admin can delete any order; staff only completed
router.delete('/:id', protect, restrictTo('staff', 'admin'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (req.user.role !== 'admin' && order.status !== 'completed' && !order.isDelivered)
      return res.status(400).json({ message: 'Only completed or delivered orders can be deleted' });

    await Order.findByIdAndDelete(req.params.id);

    req.io.to('packing').emit('order-deleted', { _id: req.params.id });
    req.io.to('counter').emit('order-deleted', { _id: req.params.id });
    req.io.to('admin').emit('order-deleted', { _id: req.params.id });
    req.io.to('staff').emit('order-deleted', { _id: req.params.id });

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

    const isBulkExpr = { $and: [{ $ne: [{ $ifNull: ['$bulk.customerName', ''] }, ''] }] };
    const collectedExpr = {
      $cond: {
        if: isBulkExpr,
        then: { $ifNull: ['$bulk.advance', 0] },
        else: { $cond: { if: { $eq: ['$status', 'completed'] }, then: '$payableAmount', else: 0 } },
      },
    };

    const [total, pending, inProgress, completed, revenue, deliveredBalToday, totalRev, totalDeliveredBal] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: today } }),
      Order.countDocuments({ createdAt: { $gte: today }, status: 'pending', 'bulk.customerName': { $in: [null, ''] } }),
      Order.countDocuments({ createdAt: { $gte: today }, status: 'in-progress', 'bulk.customerName': { $in: [null, ''] } }),
      Order.countDocuments({ createdAt: { $gte: today }, status: 'completed', 'bulk.customerName': { $in: [null, ''] } }),
      Order.aggregate([
        { $match: { createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: collectedExpr } } },
      ]),
      Order.aggregate([
        { $match: { isDelivered: true, deliveredAt: { $gte: today }, 'bulk.customerName': { $ne: '' } } },
        { $group: { _id: null, bal: { $sum: { $ifNull: ['$bulk.balance', 0] } } } },
      ]),
      Order.aggregate([
        { $group: { _id: null, total: { $sum: collectedExpr } } },
      ]),
      Order.aggregate([
        { $match: { isDelivered: true, 'bulk.customerName': { $ne: '' } } },
        { $group: { _id: null, bal: { $sum: { $ifNull: ['$bulk.balance', 0] } } } },
      ]),
    ]);

    res.json({
      today: { total, pending, inProgress, completed },
      revenue: +((revenue[0]?.total || 0) + (deliveredBalToday[0]?.bal || 0)).toFixed(2),
      totalRevenue: +((totalRev[0]?.total || 0) + (totalDeliveredBal[0]?.bal || 0)).toFixed(2),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/orders/reports — Admin analytics (weekly revenue, best products, staff perf, busy hours, category)
router.get('/reports', protect, restrictTo('admin'), async (req, res) => {
  try {
    const now = new Date();

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const TZ = '+05:30'; // IST

    const [weeklyRevenue, bestProducts, staffPerformance, busyHours, categoryRevenue] = await Promise.all([
      // Daily revenue last 7 days
      Order.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: sevenDaysAgo } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } },
          revenue: { $sum: '$payableAmount' },
          orders: { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
      ]),

      // Best-selling products by quantity, last 30 days
      Order.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $unwind: '$items' },
        { $group: {
          _id: '$items.name',
          totalQty: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        }},
        { $sort: { totalQty: -1 } },
        { $limit: 8 },
      ]),

      // Staff packing performance, last 30 days
      Order.aggregate([
        { $match: { status: 'completed', packedAt: { $gte: thirtyDaysAgo }, packedBy: { $exists: true, $ne: null } } },
        { $group: { _id: '$packedBy', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $project: { name: { $ifNull: ['$user.name', 'Unknown'] }, count: 1 } },
      ]),

      // Orders by hour of day (IST), last 30 days — peak time analysis
      Order.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: {
          _id: { $hour: { date: '$createdAt', timezone: TZ } },
          count: { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
      ]),

      // Revenue by product category, last 30 days
      Order.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: thirtyDaysAgo } } },
        { $unwind: '$items' },
        { $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'prod',
        }},
        { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
        { $group: {
          _id: { $ifNull: ['$prod.category', 'Other'] },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          qty: { $sum: '$items.quantity' },
        }},
        { $sort: { revenue: -1 } },
      ]),
    ]);

    res.json({ weeklyRevenue, bestProducts, staffPerformance, busyHours, categoryRevenue });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/orders/bulk — get all bulk orders (staff + packing)
router.get('/bulk', protect, async (req, res) => {
  try {
    const orders = await Order.find({ 'bulk.phone': { $exists: true, $ne: '' } })
      .populate('items.product', 'name image')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/orders/:id/deliver — mark bulk order as delivered
router.patch('/:id/deliver', protect, restrictTo('staff', 'admin'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!order.bulk?.phone) return res.status(400).json({ message: 'Not a bulk order' });

    const deliveredAt = new Date();
    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      { isDelivered: true, deliveredAt },
      { new: true }
    ).populate('createdBy', 'name').populate('packedBy', 'name');

    req.io.to('staff').emit('order-updated', updated);
    req.io.to('admin').emit('order-updated', updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/orders/:id/bulk-status — update bulk packing status
router.patch('/:id/bulk-status', protect, restrictTo('packing', 'admin'), async (req, res) => {
  try {
    const { bulkStatus } = req.body;
    if (!['pending', 'in-progress', 'finished'].includes(bulkStatus))
      return res.status(400).json({ message: 'Invalid bulk status' });

    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      { bulkStatus },
      { new: true }
    ).populate('createdBy', 'name').populate('packedBy', 'name');

    if (!updated) return res.status(404).json({ message: 'Order not found' });

    req.io.to('packing').emit('order-updated', updated);
    req.io.to('staff').emit('order-updated', updated);
    req.io.to('admin').emit('order-updated', updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/orders/:id/items — update bulk order items
router.put('/:id/items', protect, restrictTo('staff', 'admin'), async (req, res) => {
  try {
    const { items, discountPercent } = req.body;
    if (!items || items.length === 0)
      return res.status(400).json({ message: 'Order must have at least one item' });

    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const parsedDiscount = Number(discountPercent) || 0;
    const discountAmount = +(totalAmount * (parsedDiscount / 100)).toFixed(2);
    const payableAmount = +(totalAmount - discountAmount).toFixed(2);

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const advance = order.bulk?.advance || 0;
    const balance = +(payableAmount - advance).toFixed(2);

    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      { items, totalAmount, discountPercent: parsedDiscount, discountAmount, payableAmount, 'bulk.balance': balance },
      { new: true }
    ).populate('createdBy', 'name').populate('packedBy', 'name');

    req.io.to('packing').emit('order-updated', updated);
    req.io.to('staff').emit('order-updated', updated);
    req.io.to('admin').emit('order-updated', updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/orders/analytics — Admin: today or monthly analytics
router.get('/analytics', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { type = 'monthly', month, date } = req.query;
    const TZ = '+05:30';

    // bulk order ka advance count karo creation day pe, balance count karo delivery day pe
    const isBulk = { $and: [{ $ne: [{ $ifNull: ['$bulk.customerName', ''] }, ''] }] };
    const collectedAmt = {
      $cond: {
        if: isBulk,
        then: { $ifNull: ['$bulk.advance', 0] },
        else: { $cond: { if: { $eq: ['$status', 'completed'] }, then: '$payableAmount', else: 0 } },
      },
    };

    // ── TODAY ──────────────────────────────────────────────────────
    if (type === 'today') {
      let dayStart, dayEnd;
      if (date) {
        dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
        dayEnd   = new Date(date); dayEnd.setHours(23, 59, 59, 999);
      } else {
        dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
        dayEnd   = new Date(); dayEnd.setHours(23, 59, 59, 999);
      }

      const [totals, deliveredBalance, items, peakHours] = await Promise.all([
        Order.aggregate([
          { $match: { createdAt: { $gte: dayStart, $lte: dayEnd } } },
          { $group: { _id: null, totalOrders: { $sum: 1 }, totalSales: { $sum: collectedAmt } } },
        ]),
        // balance collected today from bulk orders delivered today
        Order.aggregate([
          { $match: { isDelivered: true, deliveredAt: { $gte: dayStart, $lte: dayEnd }, 'bulk.customerName': { $ne: '' } } },
          { $group: { _id: null, bal: { $sum: { $ifNull: ['$bulk.balance', 0] } } } },
        ]),
        Order.aggregate([
          { $match: { createdAt: { $gte: dayStart, $lte: dayEnd } } },
          { $unwind: '$items' },
          { $group: {
            _id: '$items.name',
            unit: { $first: '$items.unit' },
            entries: { $push: { quantity: '$items.quantity', quantityLabel: '$items.quantityLabel' } },
            revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          }},
          { $sort: { revenue: -1 } },
        ]),
        Order.aggregate([
          { $match: { createdAt: { $gte: dayStart, $lte: dayEnd } } },
          { $group: {
            _id: { $hour: { date: '$createdAt', timezone: TZ } },
            count: { $sum: 1 },
          }},
          { $sort: { _id: 1 } },
        ]),
      ]);

      const totalSales = +((totals[0]?.totalSales || 0) + (deliveredBalance[0]?.bal || 0)).toFixed(2);

      return res.json({
        type: 'today',
        totalOrders: totals[0]?.totalOrders || 0,
        totalSales,
        items: summarizeItems(items),
        peakHours: peakHours.map(h => ({ hour: h._id, count: h.count })),
      });
    }

    // ── MONTHLY ────────────────────────────────────────────────────
    let start, end;
    if (month) {
      const [year, mon] = month.split('-').map(Number);
      start = new Date(year, mon - 1, 1);
      end   = new Date(year, mon, 1);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
    const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
    const prevEnd   = new Date(start);

    const [totals, deliveredBalance, items, prevTotals, prevDeliveredBalance] = await Promise.all([
      Order.aggregate([
        { $match: { createdAt: { $gte: start, $lt: end } } },
        { $group: { _id: null, totalOrders: { $sum: 1 }, totalRevenue: { $sum: collectedAmt } } },
      ]),
      Order.aggregate([
        { $match: { isDelivered: true, deliveredAt: { $gte: start, $lt: end }, 'bulk.customerName': { $ne: '' } } },
        { $group: { _id: null, bal: { $sum: { $ifNull: ['$bulk.balance', 0] } } } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: start, $lt: end } } },
        { $unwind: '$items' },
        { $group: {
          _id: '$items.name',
          unit: { $first: '$items.unit' },
          entries: { $push: { quantity: '$items.quantity', quantityLabel: '$items.quantityLabel' } },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        }},
        { $sort: { revenue: -1 } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: prevStart, $lt: prevEnd } } },
        { $group: { _id: null, totalOrders: { $sum: 1 }, totalRevenue: { $sum: collectedAmt } } },
      ]),
      Order.aggregate([
        { $match: { isDelivered: true, deliveredAt: { $gte: prevStart, $lt: prevEnd }, 'bulk.customerName': { $ne: '' } } },
        { $group: { _id: null, bal: { $sum: { $ifNull: ['$bulk.balance', 0] } } } },
      ]),
    ]);

    const totalOrders  = totals[0]?.totalOrders  || 0;
    const totalRevenue = +((totals[0]?.totalRevenue || 0) + (deliveredBalance[0]?.bal || 0)).toFixed(2);
    const prevOrders   = prevTotals[0]?.totalOrders  || 0;
    const prevRevenue  = +((prevTotals[0]?.totalRevenue || 0) + (prevDeliveredBalance[0]?.bal || 0)).toFixed(2);
    const avgOrderValue     = totalOrders > 0 ? +(totalRevenue / totalOrders).toFixed(2) : 0;
    const prevAvgOrderValue = prevOrders  > 0 ? +(prevRevenue  / prevOrders ).toFixed(2) : 0;
    const growthPct = (curr, prev) => prev > 0 ? +(((curr - prev) / prev) * 100).toFixed(1) : null;

    res.json({
      type: 'monthly',
      totalOrders,
      totalRevenue,
      avgOrderValue,
      items: summarizeItems(items),
      growth: {
        revenue: growthPct(totalRevenue, prevRevenue),
        orders:  growthPct(totalOrders,  prevOrders),
        aov:     growthPct(avgOrderValue, prevAvgOrderValue),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/orders/customer/:phone — Admin: get all orders by customer phone
router.get('/customer/:phone', protect, restrictTo('admin'), async (req, res) => {
  try {
    const phone = req.params.phone.trim();
    const orders = await Order.find({ 'bulk.phone': phone })
      .populate('items.product', 'name image')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
