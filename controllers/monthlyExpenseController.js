const mongoose = require('mongoose');
const MonthlyExpense = require('../models/MonthlyExpense');

// Helper: get Ethiopian-timezone start of today as a UTC instant
function todayEthiopianMidnightUTC() {
  const ETH_OFFSET_MS = 3 * 60 * 60 * 1000;
  const nowUTC = Date.now();
  const nowEth = nowUTC + ETH_OFFSET_MS;
  const ethMidnight = new Date(nowEth);
  ethMidnight.setUTCHours(0, 0, 0, 0);
  return new Date(ethMidnight.getTime() - ETH_OFFSET_MS);
}

// @route   POST /api/monthly-expenses
// Creates a new expense. Each expense gets a fresh expenseGroupId so
// future updates can be linked back to this original entry.
const createMonthlyExpense = async (req, res) => {
  try {
    const { name, amount } = req.body;
    if (!name || amount === undefined) {
      return res.status(400).json({ message: 'name and amount are required' });
    }

    const expense = await MonthlyExpense.create({
      restaurantId: req.restaurantId,
      name: name.trim(),
      amount: Number(amount),
      startDate: todayEthiopianMidnightUTC(),
      endDate: null,
      expenseGroupId: new mongoose.Types.ObjectId(), // new group = new expense
      createdBy: req.user._id,
    });

    res.status(201).json(expense);
  } catch (err) {
    console.error('Create monthly expense error:', err);
    res.status(500).json({ message: 'Failed to save monthly expense' });
  }
};

// @route   GET /api/monthly-expenses
// Returns only the CURRENT active version of each expense group
// (the one with endDate: null), for the list UI.
const getAllMonthlyExpenses = async (req, res) => {
  try {
    const expenses = await MonthlyExpense.find({ restaurantId: req.restaurantId, endDate: null }).sort({ createdAt: -1 });
    res.status(200).json(expenses);
  } catch (err) {
    console.error('Get monthly expenses error:', err);
    res.status(500).json({ message: 'Failed to fetch monthly expenses' });
  }
};

// @route   PUT /api/monthly-expenses/:id
// "Update" = close the current record + open a new one with the new amount.
// This preserves the history so past months still see the old amount.
const updateMonthlyExpense = async (req, res) => {
  try {
    const { name, amount } = req.body;
    const current = await MonthlyExpense.findOne({ _id: req.params.id, restaurantId: req.restaurantId });
    if (!current) {
      return res.status(404).json({ message: 'Monthly expense not found' });
    }
    if (current.endDate !== null) {
      return res.status(400).json({ message: 'Cannot update a closed expense record' });
    }

    const today = todayEthiopianMidnightUTC();

    // Close the current record at end of yesterday so this month's
    // calculation uses the new amount from today onwards.
    // If startDate is today (created today), close it at today so we don't
    // get a zero-length gap.
    current.endDate = today;
    await current.save();

    // Open a new record for the same expense group
    const updated = await MonthlyExpense.create({
      restaurantId: req.restaurantId,
      name: (name ?? current.name).trim(),
      amount: amount !== undefined ? Number(amount) : current.amount,
      startDate: today,
      endDate: null,
      expenseGroupId: current.expenseGroupId,
      createdBy: req.user._id,
    });

    res.status(200).json(updated);
  } catch (err) {
    console.error('Update monthly expense error:', err);
    res.status(500).json({ message: 'Failed to update monthly expense' });
  }
};

// @route   DELETE /api/monthly-expenses/:id
// "Delete" = set endDate to today. Past months keep it, future months won't.
const deleteMonthlyExpense = async (req, res) => {
  try {
    const expense = await MonthlyExpense.findOne({ _id: req.params.id, restaurantId: req.restaurantId });
    if (!expense) {
      return res.status(404).json({ message: 'Monthly expense not found' });
    }
    if (expense.endDate !== null) {
      return res.status(400).json({ message: 'Expense already closed' });
    }

    expense.endDate = todayEthiopianMidnightUTC();
    await expense.save();

    res.status(200).json({ message: 'Expense closed', id: expense._id });
  } catch (err) {
    console.error('Delete monthly expense error:', err);
    res.status(500).json({ message: 'Failed to delete monthly expense' });
  }
};

module.exports = {
  createMonthlyExpense,
  getAllMonthlyExpenses,
  updateMonthlyExpense,
  deleteMonthlyExpense,
};