const mongoose = require('mongoose');

const orderListSchema = new mongoose.Schema(
  {
    restaurantId: {
      type:      String,
      required:  true,
      uppercase: true,
      trim:      true,
    },
    type:         { type: String, required: true, trim: true },
    name:         { type: String, required: true, trim: true },
    sellingPrice: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

orderListSchema.index({ restaurantId: 1, type: 1, name: 1 });

module.exports = mongoose.model('OrderList', orderListSchema);