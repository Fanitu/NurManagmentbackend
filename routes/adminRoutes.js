const express  = require('express');
const router   = express.Router();
const {
  getDailyRevenue, getWeeklyRevenue, getMonthlyRevenue,
  getDailyDetail, getWeeklyDetail, getMonthlyDetail,
} = require('../controllers/adminController');
const { protect, requireRole } = require('../middleware/auth');
const { validateRevenueQuery, validateDateParam } = require('../middleware/validate');

router.use(protect, requireRole('admin'));

router.get('/revenue/daily',              validateRevenueQuery, getDailyRevenue);
router.get('/revenue/daily/:date',        validateDateParam,    getDailyDetail);
router.get('/revenue/weekly',             validateRevenueQuery, getWeeklyRevenue);
router.get('/revenue/weekly/:weekStart',(req,res,next)=>{

  console.log(req.params.weekStart);
  next();
},    getWeeklyDetail);
router.get('/revenue/monthly',            validateRevenueQuery, getMonthlyRevenue);
router.get('/revenue/monthly/:monthStart',(req,res,next)=>{

  console.log(req.params.monthStart);
  next();
},   getMonthlyDetail);

module.exports = router;