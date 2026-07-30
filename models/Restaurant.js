const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

function generateRestaurantId() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `OMS-${num}`;
}

const restaurantSchema = new mongoose.Schema(
  {
    restaurantId: {
      type:      String,
      unique:    true,
      required:  true,
      default:   generateRestaurantId,
      uppercase: true,
      trim:      true,
    },
    ownerName: {
      type:     String,
      required: true,
      trim:     true,
    },
    password: {
      type:    String,
      required: true,
      select:  false,
    },
    restaurantName: { type: String, trim: true, default: '' },
    location:       { type: String, trim: true, default: '' },
    phone:          { type: String, trim: true, default: '' },
    subscription: {
      status: {
        type:    String,
        enum:    ['trial', 'active', 'expired', 'suspended'],
        default: 'trial',
      },
      startDate:       { type: Date, default: Date.now },
      expiryDate: {
        type:    Date,
        default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      lastPaymentDate: { type: Date, default: null },
      plan: {
        type:    String,
        enum:    ['trial', 'monthly', 'yearly'],
        default: 'trial',
      },
    },
    isActive: { type: Boolean, default: true },
    notes:    { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

restaurantSchema.index({ restaurantId: 1 });
restaurantSchema.index({ 'subscription.status': 1 });
restaurantSchema.index({ 'subscription.expiryDate': 1 });

module.exports = mongoose.model('Restaurant', restaurantSchema);