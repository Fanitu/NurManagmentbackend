const RunningCost = require('../models/RunningCost');

// @route   POST /api/running-cost
// @desc    Worker submits a running cost entry (name + price)
const createRunningCost = async (req, res) => {
  try {
    const { name, price } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ message: 'name and price are required' });
    }

    const cost = await RunningCost.create({
      name: name.trim(),
      price: Number(price),
      createdBy: req.user ? req.user._id : undefined,
    });

    res.status(201).json(cost);
  } catch (err) {
    console.error('Create running cost error:', err);
    res.status(500).json({ message: 'Failed to save running cost' });
  }
};

// @route   GET /api/running-cost
const getAllRunningCosts = async (req, res) => {
  try {
    const costs = await RunningCost.find().sort({ createdAt: -1 });
    res.status(200).json(costs);
  } catch (err) {
    console.error('Get running costs error:', err);
    res.status(500).json({ message: 'Failed to fetch running costs' });
  }
};

module.exports = { createRunningCost, getAllRunningCosts };
