const mongoose = require('mongoose');

const monthlyExpenseSchema = new mongoose.Schema(
  {
    restaurantId: {
      type:      String,
      required:  true,
      uppercase: true,
      trim:      true,
    },
    name:           { type: String, required: true, trim: true },
    amount:         { type: Number, required: true, min: 0 },
    startDate:      { type: Date, required: true },
    endDate:        { type: Date, default: null },
    expenseGroupId: { type: mongoose.Schema.Types.ObjectId, required: true },
    createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

monthlyExpenseSchema.index({ restaurantId: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('MonthlyExpense', monthlyExpenseSchema);