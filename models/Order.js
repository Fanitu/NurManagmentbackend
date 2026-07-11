const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      trim: true,
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    makingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    profit: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// keep profit consistent whenever prices change
orderSchema.pre('save', function (next) {
  this.profit = this.sellingPrice - this.makingPrice;
  next();
});

// index for fast "today's orders" and date-range revenue queries
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
