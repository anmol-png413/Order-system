const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, trim: true },
    image: { type: String, default: '' },
    description: { type: String, default: '' },
    isAvailable: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    unit: { type: String, enum: ['kg', 'piece'], default: 'kg' },
    orderCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
