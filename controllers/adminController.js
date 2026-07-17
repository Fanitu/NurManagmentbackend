const Order = require('../models/Order');
const RunningCost = require('../models/RunningCost');
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

// @route   GET /api/admin/revenue/daily/:date
// @desc    Returns all individual orders and running costs for a specific
//          Ethiopian calendar date (format: YYYY-MM-DD)
const getDailyDetail = async (req, res) => {
  try {
    const { date } = req.params;

    // Parse the date string and build Ethiopian-timezone boundaries for that day
    // e.g. "2026-06-30" -> midnight to 23:59:59 in Addis Ababa
    const [year, month, day] = date.split('-').map(Number);
    if (!year || !month || !day) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Build the day boundaries in Ethiopian time (UTC+3)
    const ETH_OFFSET_MS = 3 * 60 * 60 * 1000;
    const dayStartEth = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const dayEndEth   = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    const dayStart = new Date(dayStartEth.getTime() - ETH_OFFSET_MS);
    const dayEnd   = new Date(dayEndEth.getTime() - ETH_OFFSET_MS);

    const [orders, runningCosts] = await Promise.all([
      Order.find({ createdAt: { $gte: dayStart, $lte: dayEnd } })
        .sort({ createdAt: -1 })
        .select('name type sellingPrice createdAt'),
      RunningCost.find({ createdAt: { $gte: dayStart, $lte: dayEnd } })
        .sort({ createdAt: -1 })
        .select('name price createdAt'),
    ]);

    res.status(200).json({ date, orders, runningCosts });
  } catch (err) {
    console.error('Get daily detail error:', err);
    res.status(500).json({ message: 'Failed to fetch daily detail' });
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


// @route   GET /api/admin/revenue/weekly/:weekStart
// @desc    Returns all orders and running costs for the week starting on weekStart (YYYY-MM-DD),
//          grouped by Ethiopian calendar day for the expanded weekly detail view
const getWeeklyDetail = async (req, res) => {
  try {
    const { weekStart } = req.params;
    const [year, month, day] = weekStart.split('-').map(Number);
    if (!year || !month || !day) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const ETH_OFFSET_MS = 3 * 60 * 60 * 1000;

    // Build week boundaries from the weekStart date
    const weekStartEth = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const weekEndEth   = new Date(Date.UTC(year, month - 1, day + 6, 23, 59, 59, 999));
    const weekStartUTC = new Date(weekStartEth.getTime() - ETH_OFFSET_MS);
    const weekEndUTC   = new Date(weekEndEth.getTime() - ETH_OFFSET_MS);

    const [orders, runningCosts] = await Promise.all([
      Order.find({ createdAt: { $gte: weekStartUTC, $lte: weekEndUTC } })
        .sort({ createdAt: 1 })
        .select('name type sellingPrice createdAt'),
      RunningCost.find({ createdAt: { $gte: weekStartUTC, $lte: weekEndUTC } })
        .sort({ createdAt: 1 })
        .select('name price createdAt'),
    ]);

    // Helper: convert a UTC instant to its Ethiopian YYYY-MM-DD string
    const toEthDate = (iso) => {
      const d = new Date(new Date(iso).getTime() + ETH_OFFSET_MS);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };

    // Group orders by Ethiopian day, then aggregate name+type combos
    // so "Pizza x3 = 450 Br" rather than three separate Pizza rows
    const ordersByDay = {};
    orders.forEach((o) => {
      const dateKey = toEthDate(o.createdAt);
      if (!ordersByDay[dateKey]) ordersByDay[dateKey] = {};
      const itemKey = `${o.name}||${o.type || ''}||${o.sellingPrice}`;
      if (!ordersByDay[dateKey][itemKey]) {
        ordersByDay[dateKey][itemKey] = {
          name: o.name,
          type: o.type || '',
          sellingPrice: o.sellingPrice,
          count: 0,
          total: 0,
        };
      }
      ordersByDay[dateKey][itemKey].count += 1;
      ordersByDay[dateKey][itemKey].total += o.sellingPrice;
    });

    // Group running costs by Ethiopian day, same aggregation
    const costsByDay = {};
    runningCosts.forEach((c) => {
      const dateKey = toEthDate(c.createdAt);
      if (!costsByDay[dateKey]) costsByDay[dateKey] = {};
      const itemKey = `${c.name}||${c.price}`;
      if (!costsByDay[dateKey][itemKey]) {
        costsByDay[dateKey][itemKey] = {
          name: c.name,
          price: c.price,
          count: 0,
          total: 0,
        };
      }
      costsByDay[dateKey][itemKey].count += 1;
      costsByDay[dateKey][itemKey].total += c.price;
    });

    // Build all 7 days of the week in order, include days with no data too
    const days = [];
    for (let i = 0; i < 7; i++) {
      const ethDate = new Date(weekStartEth);
      ethDate.setUTCDate(ethDate.getUTCDate() + i);
      const dateKey = `${ethDate.getUTCFullYear()}-${String(ethDate.getUTCMonth() + 1).padStart(2, '0')}-${String(ethDate.getUTCDate()).padStart(2, '0')}`;

      const dayOrders = Object.values(ordersByDay[dateKey] || {});
      const dayCosts  = Object.values(costsByDay[dateKey] || {});

      const dayTotalRevenue  = dayOrders.reduce((s, o) => s + o.total, 0);
      const dayTotalCost     = dayCosts.reduce((s, c) => s + c.total, 0);

      days.push({
        date: dateKey,
        orders: dayOrders,
        runningCosts: dayCosts,
        dayTotalRevenue,
        dayTotalCost,
      });
    }

    res.status(200).json({ weekStart, days });
  } catch (err) {
    console.error('Get weekly detail error:', err);
    res.status(500).json({ message: 'Failed to fetch weekly detail' });
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
      const monthEnd   = endOfMonth(refDate);

      // Orders and running costs are straightforward — just sum what happened
      // within this calendar month
      const [orderAgg, costAgg] = await Promise.all([
        Order.aggregate([
          { $match: { createdAt: { $gte: monthStart, $lte: monthEnd } } },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$sellingPrice' },
              orderCount:   { $sum: 1 },
            },
          },
        ]),
        RunningCost.aggregate([
          { $match: { createdAt: { $gte: monthStart, $lte: monthEnd } } },
          { $group: { _id: null, totalRunningCost: { $sum: '$price' } } },
        ]),
      ]);

      const totalRevenue = orderAgg[0]?.totalRevenue || 0;
      const orderCount   = orderAgg[0]?.orderCount   || 0;
      const runningCost  = costAgg[0]?.totalRunningCost || 0;

      // ── Monthly expenses (history-aware) ──────────────────────────────
      //
      // Unlike orders and running costs, monthly expenses are RECURRING.
      // We don't just look at what was created this month — we look at
      // every expense record whose active window OVERLAPPED this month.
      //
      // A record is "active during this month" when both of these are true:
      //   1. It STARTED before the month ended     (startDate < monthEnd)
      //   2. It had NOT ended before the month started:
      //        - endDate is null (still active today), OR
      //        - endDate is after monthStart (ended during or after this month)
      //
      // Example timeline for "House Rent":
      //
      //   Jan 1  ──────────────────── [5000 Br, endDate: Mar 15] ──── Mar 15
      //   Mar 15 ──────────────────── [5500 Br, endDate: null  ] ──── (today)
      //
      //   For February: only the 5000 Br record overlaps → 5000 Br
      //   For March:    BOTH records overlap → pro-rated:
      //                   5000 × (14 days / 31 days) + 5500 × (17 days / 31 days)
      //   For April+:   only the 5500 Br record overlaps → 5500 Br
      //
      // For a deleted expense (endDate set to today):
      //   Past months where it was active still include it.
      //   Current and future months exclude it.

      const expenseRecords = await MonthlyExpense.find({
        startDate: { $lt: monthEnd },
        $or: [
          { endDate: null },
          { endDate: { $gt: monthStart } },
        ],
      });

      // Pro-rate each record by how many milliseconds it was active
      // within this specific month, then convert to a fraction of the month.
      //
      // Why pro-rate instead of just using the full amount?
      // Because if rent changed on the 15th, using the full new amount
      // for the whole month would overcount — you only paid the new rate
      // for the days it was actually in effect.
      const monthStartMs    = monthStart.getTime();
      const monthEndMs      = monthEnd.getTime();
      const monthDurationMs = monthEndMs - monthStartMs;

      let totalMonthlyExpenses = 0;

      expenseRecords.forEach((record) => {
        // Clamp the record's active window to within this month's boundaries.
        // "activeFrom" is the later of: when the record started vs month start
        // "activeTo"   is the earlier of: when the record ended vs month end
        const activeFrom = Math.max(record.startDate.getTime(), monthStartMs);
        const activeTo   = Math.min(
          record.endDate ? record.endDate.getTime() : monthEndMs,
          monthEndMs
        );

        // activeDays in ms — Math.max guards against negative values
        // (shouldn't happen given our query, but safe to guard)
        const activeMs = Math.max(0, activeTo - activeFrom);

        // Fraction of the month this record was active × its monthly amount
        const proRatedAmount = (activeMs / monthDurationMs) * record.amount;
        totalMonthlyExpenses += proRatedAmount;
      });

      // Round to 2 decimal places — avoids floating point noise like 4999.9999997
      totalMonthlyExpenses = Math.round(totalMonthlyExpenses * 100) / 100;
      console.log(`Month ${toEthiopianDateString(monthStart)}-${toEthiopianDateString(monthEnd)}: totalMonthlyExpenses = ${totalMonthlyExpenses}`);

      // Final net profit: everything earned minus everything spent
      const netProfitAfterAll = totalRevenue - runningCost - totalMonthlyExpenses;

      // Skip months with zero activity across all three categories
      if (totalRevenue === 0 && runningCost === 0 && totalMonthlyExpenses === 0) continue;

      months.push({
        monthStart: toEthiopianDateString(monthStart),
        monthEnd:   toEthiopianDateString(monthEnd),
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

// @route   GET /api/admin/revenue/monthly/:monthStart
// @desc    Full month detail: orders grouped by name, running costs grouped
//          by name, and active monthly expenses — all with counts and totals
const getMonthlyDetail = async (req, res) => {
  try {
    const { monthStart } = req.params;
    const [year, month] = monthStart.split('-').map(Number);
    if (!year || !month) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const ETH_OFFSET_MS = 3 * 60 * 60 * 1000;
    const monthStartEth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const monthEndEth   = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const monthStartUTC = new Date(monthStartEth.getTime() - ETH_OFFSET_MS);
    const monthEndUTC   = new Date(monthEndEth.getTime() - ETH_OFFSET_MS);

    const [orders, runningCosts, expenseRecords] = await Promise.all([
      Order.find({ createdAt: { $gte: monthStartUTC, $lte: monthEndUTC } })
        .select('name type sellingPrice createdAt'),
      RunningCost.find({ createdAt: { $gte: monthStartUTC, $lte: monthEndUTC } })
        .select('name price createdAt'),
      MonthlyExpense.find({
        startDate: { $lt: monthEndUTC },
        $or: [
          { endDate: null },
          { endDate: { $gt: monthStartUTC } },
        ],
      }).select('name amount startDate endDate'),
    ]);

    // Group orders by name+type+price → { name, type, sellingPrice, count, total }
    const orderMap = {};
    orders.forEach((o) => {
      const key = `${o.name}||${o.type || ''}||${o.sellingPrice}`;
      if (!orderMap[key]) {
        orderMap[key] = {
          name: o.name,
          type: o.type || '',
          sellingPrice: o.sellingPrice,
          count: 0,
          total: 0,
        };
      }
      orderMap[key].count += 1;
      orderMap[key].total += o.sellingPrice;
    });

    // Group running costs by name+price → { name, price, count, total }
    const costMap = {};
    runningCosts.forEach((c) => {
      const key = c.name.toLowerCase().trim();
      if (!costMap[key]) {
        costMap[key] = { name: c.name, count: 0, total: 0 };
      }
      costMap[key].count += 1;
      costMap[key].total += c.price;
    });

    // Pro-rate monthly expenses exactly like getMonthlyRevenue does
    const monthStartMs    = monthStartUTC.getTime();
    const monthEndMs      = monthEndUTC.getTime();
    const monthDurationMs = monthEndMs - monthStartMs;

    const monthlyExpenses = expenseRecords.map((record) => {
      const activeFrom   = Math.max(record.startDate.getTime(), monthStartMs);
      const activeTo     = Math.min(
        record.endDate ? record.endDate.getTime() : monthEndMs,
        monthEndMs
      );
      const activeMs       = Math.max(0, activeTo - activeFrom);
      const proRatedAmount = Math.round((activeMs / monthDurationMs) * record.amount * 100) / 100;
      return {
        name:            record.name,
        originalAmount:  record.amount,
        proRatedAmount,
        isActive:        record.endDate === null,
      };
    });

    const groupedOrders   = Object.values(orderMap).sort((a, b) => b.total - a.total);
    const groupedCosts    = Object.values(costMap).sort((a, b) => b.total - a.total);
    const totalOrdersSum  = groupedOrders.reduce((s, o) => s + o.total, 0);
    const totalCostsSum   = groupedCosts.reduce((s, c) => s + c.total, 0);
    const totalExpensesSum = monthlyExpenses.reduce((s, e) => s + e.proRatedAmount, 0);

    res.status(200).json({
      monthStart,
      groupedOrders,
      groupedCosts,
      monthlyExpenses,
      totalOrdersSum:   Math.round(totalOrdersSum * 100) / 100,
      totalCostsSum:    Math.round(totalCostsSum * 100) / 100,
      totalExpensesSum: Math.round(totalExpensesSum * 100) / 100,
    });
  } catch (err) {
    console.error('Get monthly detail error:', err);
    res.status(500).json({ message: 'Failed to fetch monthly detail' });
  }
};

module.exports = { getDailyRevenue, getWeeklyRevenue, getMonthlyRevenue,getMonthlyDetail, getDailyDetail,getWeeklyDetail };
