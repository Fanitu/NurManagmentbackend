const express = require('express');
const router = express.Router();
const { getDailyRevenue, getWeeklyRevenue, getMonthlyRevenue } = require('../controllers/adminController');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect, requireRole('admin'));

router.get('/revenue/daily', getDailyRevenue);
router.get('/revenue/weekly', getWeeklyRevenue);
router.get('/revenue/monthly', getMonthlyRevenue);

module.exports = router;
