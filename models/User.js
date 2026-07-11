const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // never return password by default
    },
    role: {
      type: String,
      enum: ['admin', 'worker'],
      default: 'worker',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
