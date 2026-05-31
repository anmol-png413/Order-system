const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  image: { type: String },
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

// Auto-generate token number
orderSchema.pre('save', async function (next) {
  if (this.isNew) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const count = await mongoose.model('Order').countDocuments({
      createdAt: { $gte: today },
    });
    this.tokenNumber = count + 1;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
