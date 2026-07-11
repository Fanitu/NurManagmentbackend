const mongoose = require('mongoose');

const orderListSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true, // e.g. "Food", "Drink"
    },
    name: {
      type: String,
      required: true,
      trim: true, // e.g. "Pizza", "Burger"
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('OrderList', orderListSchema);
