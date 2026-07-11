const mongoose = require('mongoose');

const runningCostSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

runningCostSchema.index({ createdAt: -1 });

module.exports = mongoose.model('RunningCost', runningCostSchema);
