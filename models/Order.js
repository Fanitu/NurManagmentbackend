const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    restaurantId: {
      type:      String,
      required:  true,
      uppercase: true,
      trim:      true,
    },
    name:         { type: String, required: true, trim: true },
    type:         { type: String, trim: true },
    sellingPrice: { type: Number, required: true, min: 0 },
    makingPrice:  { type: Number, default: 0, min: 0 },
    profit:       { type: Number, default: 0 },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isDeleted:     { type: Boolean, default: false, index: true },
    deletedReason: { type: String, trim: true, default: null },
    deletedAt:     { type: Date, default: null },
    deletedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

orderSchema.pre('save', function (next) {
  this.profit = this.sellingPrice - this.makingPrice;
  next();
});

orderSchema.index({ restaurantId: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, isDeleted: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);