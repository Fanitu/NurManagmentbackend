const Order          = require('../models/Order');
const RunningCost    = require('../models/RunningCost');
const MonthlyExpense = require('../models/MonthlyExpense');
const {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  toEthiopianDateString,
} = require('../utils/dateRanges');

const ETH_OFFSET_MS = 3 * 60 * 60 * 1000;

// Helper used in monthly detail — converts UTC instant to Ethiopian YYYY-MM-DD
const toEthDateLocal = (iso) => {
  const d = new Date(new Date(iso).getTime() + ETH_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

// ── Daily helpers — now accept restaurantId ───────────────────────────────────

async function getOrderTotalsByDay(restaurantId, daysBack = 30) {
  const since = startOfDay(new Date());
  since.setDate(since.getDate() - daysBack);

  const results = await Order.aggregate([
    {
      $match: {
        restaurantId,          // ← scope to this restaurant
        createdAt: { $gte: since },
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+03:00' } },
        totalRevenue: { $sum: '$sellingPrice' },
        totalProfit:  { $sum: '$profit' },
        orderCount:   { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
  ]);

  return results;
}

async function getRunningCostTotalsByDay(restaurantId, daysBack = 30) {
  const since = startOfDay(new Date());
  since.setDate(since.getDate() - daysBack);

  const results = await RunningCost.aggregate([
    {
      $match: {
        restaurantId,          // ← scope to this restaurant
        createdAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+03:00' } },
        totalRunningCost: { $sum: '$price' },
      },
    },
  ]);

  const map = {};
  results.forEach((r) => { map[r._id] = r.totalRunningCost; });
  return map;
}

// ── Controllers ───────────────────────────────────────────────────────────────

const getDailyRevenue = async (req, res) => {
  try {
    const restaurantId = req.restaurantId;
    const daysBack     = req.query.daysBack ? Number(req.query.daysBack) : 30;

    const [orderTotals, runningCostMap] = await Promise.all([
      getOrderTotalsByDay(restaurantId, daysBack),
      getRunningCostTotalsByDay(restaurantId, daysBack),
    ]);

    const days = orderTotals.map((day) => {
      const runningCost = runningCostMap[day._id] || 0;
      const netIncome   = day.totalProfit - runningCost;
      return {
        date:         day._id,
        totalRevenue: day.totalRevenue,
        profit:       day.totalProfit,
        runningCost,
        netIncome,
        orderCount:   day.orderCount,
      };
    });

    res.status(200).json(days);
  } catch (err) {
    console.error('Get daily revenue error:', err);
    res.status(500).json({ message: 'Failed to fetch daily revenue' });
  }
};

const getDailyDetail = async (req, res) => {
  try {
    const restaurantId       = req.restaurantId;
    const { date }           = req.params;
    const [year, month, day] = date.split('-').map(Number);

    if (!year || !month || !day) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const dayStartEth = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const dayEndEth   = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    const dayStart    = new Date(dayStartEth.getTime() - ETH_OFFSET_MS);
    const dayEnd      = new Date(dayEndEth.getTime()   - ETH_OFFSET_MS);

    const [activeOrders, deletedOrders, runningCosts] = await Promise.all([
      Order.find({
        restaurantId,          // ← scope
        createdAt: { $gte: dayStart, $lte: dayEnd },
        isDeleted: false,
      }).sort({ createdAt: -1 }).select('name type sellingPrice createdAt'),

      Order.find({
        restaurantId,          // ← scope
        createdAt: { $gte: dayStart, $lte: dayEnd },
        isDeleted: true,
      }).sort({ deletedAt: -1 }).select('name type sellingPrice deletedReason deletedAt createdAt'),

      RunningCost.find({
        restaurantId,          // ← scope
        createdAt: { $gte: dayStart, $lte: dayEnd },
      }).sort({ createdAt: -1 }).select('name price createdAt'),
    ]);

    res.status(200).json({ date, orders: activeOrders, deletedOrders, runningCosts });
  } catch (err) {
    console.error('Get daily detail error:', err);
    res.status(500).json({ message: 'Failed to fetch daily detail' });
  }
};

const getWeeklyRevenue = async (req, res) => {
  try {
    const restaurantId = req.restaurantId;
    const weeksBack    = req.query.weeksBack ? Number(req.query.weeksBack) : 8;
    const today        = new Date();
    const weeks        = [];

    for (let i = 0; i < weeksBack; i++) {
      const refDate = new Date(today);
      refDate.setDate(refDate.getDate() - i * 7);

      const weekStart = startOfWeek(refDate);
      const weekEnd   = endOfWeek(refDate);

      const [orderAgg, costAgg] = await Promise.all([
        Order.aggregate([
          {
            $match: {
              restaurantId,      // ← scope
              createdAt: { $gte: weekStart, $lte: weekEnd },
              isDeleted: false,
            },
          },
          {
            $group: {
              _id:          null,
              totalRevenue: { $sum: '$sellingPrice' },
              totalProfit:  { $sum: '$profit' },
              orderCount:   { $sum: 1 },
            },
          },
        ]),
        RunningCost.aggregate([
          {
            $match: {
              restaurantId,      // ← scope
              createdAt: { $gte: weekStart, $lte: weekEnd },
            },
          },
          { $group: { _id: null, totalRunningCost: { $sum: '$price' } } },
        ]),
      ]);

      const totalRevenue = orderAgg[0]?.totalRevenue || 0;
      const profit       = orderAgg[0]?.totalProfit  || 0;
      const orderCount   = orderAgg[0]?.orderCount   || 0;
      const runningCost  = costAgg[0]?.totalRunningCost || 0;
      const netIncome    = profit - runningCost;

      if (totalRevenue === 0 && runningCost === 0) continue;

      weeks.push({
        weekStart:    toEthiopianDateString(weekStart),
        weekEnd:      toEthiopianDateString(weekEnd),
        totalRevenue, profit, runningCost, netIncome, orderCount,
      });
    }

    res.status(200).json(weeks);
  } catch (err) {
    console.error('Get weekly revenue error:', err);
    res.status(500).json({ message: 'Failed to fetch weekly revenue' });
  }
};

const getWeeklyDetail = async (req, res) => {
  try {
    const restaurantId       = req.restaurantId;
    const { weekStart }      = req.params;
    const [year, month, day] = weekStart.split('-').map(Number);

    if (!year || !month || !day) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const weekStartEth = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const weekEndEth   = new Date(Date.UTC(year, month - 1, day + 6, 23, 59, 59, 999));
    const weekStartUTC = new Date(weekStartEth.getTime() - ETH_OFFSET_MS);
    const weekEndUTC   = new Date(weekEndEth.getTime()   - ETH_OFFSET_MS);

    const toEthDate = (iso) => {
      const d = new Date(new Date(iso).getTime() + ETH_OFFSET_MS);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    };

    const [orders, runningCosts, deletedOrders] = await Promise.all([
      Order.find({
        restaurantId,          // ← scope
        createdAt: { $gte: weekStartUTC, $lte: weekEndUTC },
        isDeleted: false,
      }).sort({ createdAt: 1 }).select('name type sellingPrice createdAt'),

      RunningCost.find({
        restaurantId,          // ← scope
        createdAt: { $gte: weekStartUTC, $lte: weekEndUTC },
      }).sort({ createdAt: 1 }).select('name price createdAt'),

      Order.find({
        restaurantId,          // ← scope
        createdAt: { $gte: weekStartUTC, $lte: weekEndUTC },
        isDeleted: true,
      }).sort({ deletedAt: -1 }).select('name type sellingPrice deletedReason deletedAt createdAt'),
    ]);

    const orderMap = {};
    orders.forEach((o) => {
      const key = `${o.name}||${o.type || ''}||${o.sellingPrice}`;
      if (!orderMap[key]) {
        orderMap[key] = { name: o.name, type: o.type || '', sellingPrice: o.sellingPrice, count: 0, total: 0 };
      }
      orderMap[key].count += 1;
      orderMap[key].total += o.sellingPrice;
    });

    const costMap = {};
    runningCosts.forEach((c) => {
      const key = c.name.toLowerCase().trim();
      if (!costMap[key]) costMap[key] = { name: c.name, count: 0, total: 0 };
      costMap[key].count += 1;
      costMap[key].total += c.price;
    });

    const groupedOrders = Object.values(orderMap).sort((a, b) => b.total - a.total);
    const groupedCosts  = Object.values(costMap).sort((a, b) => b.total - a.total);

    const formattedDeletedOrders = deletedOrders.map((o) => ({
      name:          o.name,
      type:          o.type || '',
      sellingPrice:  o.sellingPrice,
      deletedReason: o.deletedReason,
      deletedDate:   toEthDate(o.deletedAt || o.createdAt),
      originalDate:  toEthDate(o.createdAt),
    }));

    res.status(200).json({
      weekStart,
      groupedOrders,
      groupedCosts,
      deletedOrders:  formattedDeletedOrders,
      totalOrdersSum: Math.round(groupedOrders.reduce((s, o) => s + o.total, 0) * 100) / 100,
      totalCostsSum:  Math.round(groupedCosts.reduce((s, c) => s + c.total, 0) * 100) / 100,
    });
  } catch (err) {
    console.error('Get weekly detail error:', err);
    res.status(500).json({ message: 'Failed to fetch weekly detail' });
  }
};

const getMonthlyRevenue = async (req, res) => {
  try {
    const restaurantId = req.restaurantId;
    const monthsBack   = req.query.monthsBack ? Number(req.query.monthsBack) : 6;
    const today        = new Date();
    const months       = [];

    for (let i = 0; i < monthsBack; i++) {
      const refDate    = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStart = startOfMonth(refDate);
      const monthEnd   = endOfMonth(refDate);

      const [orderAgg, costAgg] = await Promise.all([
        Order.aggregate([
          {
            $match: {
              restaurantId,      // ← scope
              createdAt: { $gte: monthStart, $lte: monthEnd },
              isDeleted: false,
            },
          },
          {
            $group: {
              _id:          null,
              totalRevenue: { $sum: '$sellingPrice' },
              orderCount:   { $sum: 1 },
            },
          },
        ]),
        RunningCost.aggregate([
          {
            $match: {
              restaurantId,      // ← scope
              createdAt: { $gte: monthStart, $lte: monthEnd },
            },
          },
          { $group: { _id: null, totalRunningCost: { $sum: '$price' } } },
        ]),
      ]);

      const totalRevenue = orderAgg[0]?.totalRevenue    || 0;
      const orderCount   = orderAgg[0]?.orderCount      || 0;
      const runningCost  = costAgg[0]?.totalRunningCost || 0;

      // Monthly expenses — scoped to this restaurant, history-aware
      const expenseRecords = await MonthlyExpense.find({
        restaurantId,            // ← scope
        startDate: { $lt: monthEnd },
        $or: [
          { endDate: null },
          { endDate: { $gt: monthStart } },
        ],
      });

      const monthStartMs    = monthStart.getTime();
      const monthEndMs      = monthEnd.getTime();
      const monthDurationMs = monthEndMs - monthStartMs;
      let totalMonthlyExpenses = 0;

      expenseRecords.forEach((record) => {
        const activeFrom     = Math.max(record.startDate.getTime(), monthStartMs);
        const activeTo       = Math.min(
          record.endDate ? record.endDate.getTime() : monthEndMs,
          monthEndMs
        );
        const activeMs       = Math.max(0, activeTo - activeFrom);
        totalMonthlyExpenses += (activeMs / monthDurationMs) * record.amount;
      });

      totalMonthlyExpenses = Math.round(totalMonthlyExpenses * 100) / 100;

      const netProfitAfterAll = totalRevenue - runningCost - totalMonthlyExpenses;

      if (totalRevenue === 0 && runningCost === 0 && totalMonthlyExpenses === 0) continue;

      months.push({
        monthStart:           toEthiopianDateString(monthStart),
        monthEnd:             toEthiopianDateString(monthEnd),
        totalRevenue,
        runningCost,
        totalMonthlyExpenses,
        netProfitAfterAll,
        orderCount,
      });
    }

    res.status(200).json(months);
  } catch (err) {
    console.error('Get monthly revenue error:', err);
    res.status(500).json({ message: 'Failed to fetch monthly revenue' });
  }
};

const getMonthlyDetail = async (req, res) => {
  try {
    const restaurantId  = req.restaurantId;
    const { monthStart } = req.params;
    const [year, month] = monthStart.split('-').map(Number);

    if (!year || !month) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const monthStartEth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const monthEndEth   = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const monthStartUTC = new Date(monthStartEth.getTime() - ETH_OFFSET_MS);
    const monthEndUTC   = new Date(monthEndEth.getTime()   - ETH_OFFSET_MS);

    const [orders, runningCosts, expenseRecords, deletedOrders] = await Promise.all([
      Order.find({
        restaurantId,          // ← scope
        createdAt: { $gte: monthStartUTC, $lte: monthEndUTC },
        isDeleted: false,
      }).select('name type sellingPrice createdAt'),

      RunningCost.find({
        restaurantId,          // ← scope
        createdAt: { $gte: monthStartUTC, $lte: monthEndUTC },
      }).select('name price createdAt'),

      MonthlyExpense.find({
        restaurantId,          // ← scope
        startDate: { $lt: monthEndUTC },
        $or: [{ endDate: null }, { endDate: { $gt: monthStartUTC } }],
      }).select('name amount startDate endDate'),

      Order.find({
        restaurantId,          // ← scope
        createdAt: { $gte: monthStartUTC, $lte: monthEndUTC },
        isDeleted: true,
      }).sort({ deletedAt: -1 }).select('name type sellingPrice deletedReason deletedAt createdAt'),
    ]);

    const orderMap = {};
    orders.forEach((o) => {
      const key = `${o.name}||${o.type || ''}||${o.sellingPrice}`;
      if (!orderMap[key]) {
        orderMap[key] = { name: o.name, type: o.type || '', sellingPrice: o.sellingPrice, count: 0, total: 0 };
      }
      orderMap[key].count += 1;
      orderMap[key].total += o.sellingPrice;
    });

    const costMap = {};
    runningCosts.forEach((c) => {
      const key = c.name.toLowerCase().trim();
      if (!costMap[key]) costMap[key] = { name: c.name, count: 0, total: 0 };
      costMap[key].count += 1;
      costMap[key].total += c.price;
    });

    const monthStartMs    = monthStartUTC.getTime();
    const monthEndMs      = monthEndUTC.getTime();
    const monthDurationMs = monthEndMs - monthStartMs;

    const monthlyExpenses = expenseRecords.map((record) => {
      const activeFrom     = Math.max(record.startDate.getTime(), monthStartMs);
      const activeTo       = Math.min(
        record.endDate ? record.endDate.getTime() : monthEndMs,
        monthEndMs
      );
      const activeMs       = Math.max(0, activeTo - activeFrom);
      const proRatedAmount = Math.round((activeMs / monthDurationMs) * record.amount * 100) / 100;
      return {
        name:           record.name,
        originalAmount: record.amount,
        proRatedAmount,
        isActive:       record.endDate === null,
      };
    });

    const groupedOrders    = Object.values(orderMap).sort((a, b) => b.total - a.total);
    const groupedCosts     = Object.values(costMap).sort((a, b) => b.total - a.total);
    const totalOrdersSum   = groupedOrders.reduce((s, o) => s + o.total, 0);
    const totalCostsSum    = groupedCosts.reduce((s, c) => s + c.total, 0);
    const totalExpensesSum = monthlyExpenses.reduce((s, e) => s + e.proRatedAmount, 0);

    const formattedDeletedOrders = deletedOrders.map((o) => ({
      name:          o.name,
      type:          o.type || '',
      sellingPrice:  o.sellingPrice,
      deletedReason: o.deletedReason,
      deletedDate:   toEthDateLocal(o.deletedAt || o.createdAt),
      originalDate:  toEthDateLocal(o.createdAt),
    }));

    res.status(200).json({
      monthStart,
      groupedOrders,
      groupedCosts,
      monthlyExpenses,
      deletedOrders:    formattedDeletedOrders,
      totalOrdersSum:   Math.round(totalOrdersSum   * 100) / 100,
      totalCostsSum:    Math.round(totalCostsSum    * 100) / 100,
      totalExpensesSum: Math.round(totalExpensesSum * 100) / 100,
    });
  } catch (err) {
    console.error('Get monthly detail error:', err);
    res.status(500).json({ message: 'Failed to fetch monthly detail' });
  }
};

module.exports = {
  getDailyRevenue,
  getWeeklyRevenue,
  getMonthlyRevenue,
  getMonthlyDetail,
  getDailyDetail,
  getWeeklyDetail,
};