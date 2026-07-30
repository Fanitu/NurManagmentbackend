const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: true,
      trim:     true,
    },
    password: {
      type:     String,
      required: true,
      select:   false,
    },
    role: {
      type:    String,
      enum:    ['admin', 'worker'],
      default: 'worker',
    },
    restaurantId: {
      type:      String,
      required:  true,
      uppercase: true,
      trim:      true,
    },
  },
  { timestamps: true }
);

// Same name can exist in different restaurants — "John" in OMS-1234
// and "John" in OMS-5678 are completely separate people
userSchema.index({ name: 1, restaurantId: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);