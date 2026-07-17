const express = require('express');
const router = express.Router();
const { getDailyRevenue, getWeeklyRevenue, getMonthlyRevenue ,getDailyDetail,getWeeklyDetail,getMonthlyDetail} = require('../controllers/adminController');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect, requireRole('admin'));

router.get('/revenue/daily', getDailyRevenue);
router.get('/revenue/daily/:date', getDailyDetail);
router.get('/revenue/weekly', getWeeklyRevenue);
router.get('/revenue/weekly/:weekStart', getWeeklyDetail);
router.get('/revenue/monthly', getMonthlyRevenue);
router.get('/revenue/monthly/:monthStart', getMonthlyDetail);
module.exports = router;
