const express  = require('express');
const router   = express.Router();
const {
  createMonthlyExpense, getAllMonthlyExpenses,
  updateMonthlyExpense, deleteMonthlyExpense,
} = require('../controllers/monthlyExpenseController');
const { protect, requireRole } = require('../middleware/auth');
const {
  validateCreateMonthlyExpense,
  validateUpdateMonthlyExpense,
} = require('../middleware/validate');

router.use(protect, requireRole('admin'));

router.post('/',    validateCreateMonthlyExpense, createMonthlyExpense);
router.get('/',     getAllMonthlyExpenses);
router.put('/:id',  validateUpdateMonthlyExpense, updateMonthlyExpense);
router.delete('/:id', deleteMonthlyExpense);

module.exports = router;