const mongoose = require('mongoose');

const runningCostSchema = new mongoose.Schema(
  {
    restaurantId: {
      type:      String,
      required:  true,
      uppercase: true,
      trim:      true,
    },
    name:      { type: String, required: true, trim: true },
    price:     { type: Number, required: true, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

runningCostSchema.index({ restaurantId: 1, createdAt: -1 });

module.exports = mongoose.model('RunningCost', runningCostSchema);