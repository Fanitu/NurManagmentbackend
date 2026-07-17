const mongoose = require('mongoose');

const monthlyExpenseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    // The date this amount became effective (Ethiopian midnight UTC instant)
    startDate: {
      type: Date,
      required: true,
    },
    // Set when this record is superseded by an update or deleted.
    // null means "still active / no end date yet"
    endDate: {
      type: Date,
      default: null,
    },
    // Links versions of the same expense together so the list UI
    // can show one card per expense (the currently active version)
    expenseGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Fast queries for "which expenses were active during month X"
monthlyExpenseSchema.index({ startDate: 1, endDate: 1 });
monthlyExpenseSchema.index({ expenseGroupId: 1, startDate: -1 });

module.exports = mongoose.model('MonthlyExpense', monthlyExpenseSchema);