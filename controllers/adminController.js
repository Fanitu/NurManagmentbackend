const Order = require('../models/Order');
const RunningCost = require('../models/RunningCost');
const {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  toEthiopianDateString,
} = require('../utils/dateRanges');

// Groups orders by calendar day (YYYY-MM-DD) using Mongo's date aggregation,
// returning totalRevenue (sum of sellingPrice) and totalProfit (sum of profit)
// per day, sorted newest first. Limited to the last `daysBack` days by default.
async function getOrderTotalsByDay(daysBack = 30) {
  const since = startOfDay(new Date());
  since.setDate(since.getDate() - daysBack);

  const results = await Order.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        // timezone: '+03:00' makes Mongo group by the Ethiopian calendar
        // day, not the UTC calendar day - otherwise orders placed between
        // midnight and 3am Ethiopian time would land in the wrong bucket.
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+03:00' } },
        totalRevenue: { $sum: '$sellingPrice' },
        totalProfit: { $sum: '$profit' },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
  ]);

  return results;
}

async function getRunningCostTotalsByDay(daysBack = 30) {
  const since = startOfDay(new Date());
  since.setDate(since.getDate() - daysBack);

  const results = await RunningCost.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+03:00' } },
        totalRunningCost: { $sum: '$price' },
      },
    },
  ]);

  // turn into a lookup map keyed by date string for O(1) merging
  const map = {};
  results.forEach((r) => {
    map[r._id] = r.totalRunningCost;
  });
  return map;
}

// @route   GET /api/admin/revenue/daily
// @desc    Revenue broken down by individual day (last 30 days by default).
//          Each day: totalRevenue, profit, runningCost, netIncome (profit - runningCost)
const getDailyRevenue = async (req, res) => {
  try {
    const daysBack = req.query.daysBack ? Number(req.query.daysBack) : 30;

    const [orderTotals, runningCostMap] = await Promise.all([
      getOrderTotalsByDay(daysBack),
      getRunningCostTotalsByDay(daysBack),
    ]);

    const days = orderTotals.map((day) => {
      const runningCost = runningCostMap[day._id] || 0;
      const netIncome = day.totalProfit - runningCost;

      return {
        date: day._id,
        totalRevenue: day.totalRevenue,
        profit: day.totalProfit,
        runningCost,
        netIncome,
        orderCount: day.orderCount,
      };
    });

    res.status(200).json(days);
  } catch (err) {
    console.error('Get daily revenue error:', err);
    res.status(500).json({ message: 'Failed to fetch daily revenue' });
  }
};

// @route   GET /api/admin/revenue/weekly
// @desc    Revenue broken down by week (Monday-Sunday), last `weeksBack` weeks.
//          Each week: weekStart, weekEnd, totalRevenue, runningCost, netIncome
const getWeeklyRevenue = async (req, res) => {
  try {
    const weeksBack = req.query.weeksBack ? Number(req.query.weeksBack) : 8;
    const today = new Date();

    const weeks = [];

    for (let i = 0; i < weeksBack; i++) {
      const refDate = new Date(today);
      refDate.setDate(refDate.getDate() - i * 7);

      const weekStart = startOfWeek(refDate);
      const weekEnd = endOfWeek(refDate);

      const [orderAgg, costAgg] = await Promise.all([
        Order.aggregate([
          { $match: { createdAt: { $gte: weekStart, $lte: weekEnd } } },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$sellingPrice' },
              totalProfit: { $sum: '$profit' },
              orderCount: { $sum: 1 },
            },
          },
        ]),
        RunningCost.aggregate([
          { $match: { createdAt: { $gte: weekStart, $lte: weekEnd } } },
          { $group: { _id: null, totalRunningCost: { $sum: '$price' } } },
        ]),
      ]);

      const totalRevenue = orderAgg[0]?.totalRevenue || 0;
      const profit = orderAgg[0]?.totalProfit || 0;
      const orderCount = orderAgg[0]?.orderCount || 0;
      const runningCost = costAgg[0]?.totalRunningCost || 0;
      const netIncome = profit - runningCost;

      // skip weeks with zero activity to keep the response lean
      if (totalRevenue === 0 && runningCost === 0) continue;

      weeks.push({
        weekStart: toEthiopianDateString(weekStart),
        weekEnd: toEthiopianDateString(weekEnd),
        totalRevenue,
        profit,
        runningCost,
        netIncome,
        orderCount,
      });
    }

    res.status(200).json(weeks);
  } catch (err) {
    console.error('Get weekly revenue error:', err);
    res.status(500).json({ message: 'Failed to fetch weekly revenue' });
  }
};

// @route   GET /api/admin/revenue/monthly
// @desc    Revenue broken down by calendar month, last `monthsBack` months.
//          Each month: monthStart, monthEnd, totalRevenue, runningCost, netIncome
const getMonthlyRevenue = async (req, res) => {
  try {
    const monthsBack = req.query.monthsBack ? Number(req.query.monthsBack) : 6;
    const today = new Date();

    const months = [];

    for (let i = 0; i < monthsBack; i++) {
      const refDate = new Date(today.getFullYear(), today.getMonth() - i, 1);

      const monthStart = startOfMonth(refDate);
      const monthEnd = endOfMonth(refDate);

      const [orderAgg, costAgg] = await Promise.all([
        Order.aggregate([
          { $match: { createdAt: { $gte: monthStart, $lte: monthEnd } } },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$sellingPrice' },
              totalProfit: { $sum: '$profit' },
              orderCount: { $sum: 1 },
            },
          },
        ]),
        RunningCost.aggregate([
          { $match: { createdAt: { $gte: monthStart, $lte: monthEnd } } },
          { $group: { _id: null, totalRunningCost: { $sum: '$price' } } },
        ]),
      ]);

      const totalRevenue = orderAgg[0]?.totalRevenue || 0;
      const profit = orderAgg[0]?.totalProfit || 0;
      const orderCount = orderAgg[0]?.orderCount || 0;
      const runningCost = costAgg[0]?.totalRunningCost || 0;
      const netIncome = profit - runningCost;

      if (totalRevenue === 0 && runningCost === 0) continue;

      months.push({
        monthStart: toEthiopianDateString(monthStart),
        monthEnd: toEthiopianDateString(monthEnd),
        totalRevenue,
        profit,
        runningCost,
        netIncome,
        orderCount,
      });
    }

    res.status(200).json(months);
  } catch (err) {
    console.error('Get monthly revenue error:', err);
    res.status(500).json({ message: 'Failed to fetch monthly revenue' });
  }
};

module.exports = { getDailyRevenue, getWeeklyRevenue, getMonthlyRevenue };
