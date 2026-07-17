const express = require('express');
const router = express.Router();
const {
  createMonthlyExpense,
  getAllMonthlyExpenses,
  updateMonthlyExpense,
  deleteMonthlyExpense,
} = require('../controllers/monthlyExpenseController');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect, requireRole('admin'));

router.post('/', createMonthlyExpense);
router.get('/', getAllMonthlyExpenses);
router.put('/:id', updateMonthlyExpense);
router.delete('/:id', deleteMonthlyExpense);

module.exports = router;