const mongoose = require('mongoose');
const Counter = require('./Counter');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  image: { type: String },
  unit: { type: String, default: 'kg' },
  quantityLabel: { type: String, default: '' },
}, { _id: false }); // no _id per item — saves ~12 bytes × items × orders

const orderSchema = new mongoose.Schema(
  {
    tokenNumber: { type: Number, unique: true },
    items: [orderItemSchema],
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed'],
      default: 'pending',
      index: true,
    },
    notes: { type: String, default: '' },
    discountPercent: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    payableAmount: { type: Number, default: 0 },
    bulk: {
      customerName: { type: String, default: '' },
      phone: { type: String, default: '' },
      advance: { type: Number, default: 0 },
      schedule: { type: Date },
      balance: { type: Number, default: 0 },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    packedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    packedAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes for common queries (status filter + date sort used on every page load)
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ packedAt: -1 }); // counter page: last 2 hours filter
orderSchema.index({ 'bulk.phone': 1 }); // customer history lookup by phone

// Atomic token number — daily reset (1, 2, 3... resets to 1 next day)
orderSchema.pre('save', async function (next) {
  if (this.isNew) {
    this.tokenNumber = await Counter.getNextToken();
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
