const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

// Atomic increment — safe under concurrent requests
counterSchema.statics.getNextToken = async function () {
  const counter = await this.findOneAndUpdate(
    { _id: 'tokenNumber' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
