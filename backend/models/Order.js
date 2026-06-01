const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  image: { type: String },
  quantityLabel: { type: String, default: '' },
});

const orderSchema = new mongoose.Schema(
  {
    tokenNumber: { type: Number, unique: true },
    items: [orderItemSchema],
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed'],
      default: 'pending',
    },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    packedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    packedAt: { type: Date },
  },
  { timestamps: true }
);

// Auto-generate token number — always increment from global max to avoid dup key errors
orderSchema.pre('save', async function (next) {
  if (this.isNew) {
    const last = await mongoose.model('Order').findOne({}).sort({ tokenNumber: -1 }).select('tokenNumber');
    this.tokenNumber = (last?.tokenNumber || 0) + 1;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
