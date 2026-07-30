const { body, param, query, validationResult } = require('express-validator');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: errors.array()[0].msg, // first error only — clean UX
      field:   errors.array()[0].path,
    });
  }
  next();
};

// ── AUTH ─────────────────────────────────────────────────────────────────────
const validateLogin = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\u1200-\u137F0-9\s'-]+$/)
    .withMessage('Name contains invalid characters'),
    // The unicode range \u1200-\u137F covers the Ethiopic (Amharic) script
    // so Ethiopian names are accepted alongside Latin names

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 4, max: 100 }).withMessage('Password must be between 4 and 100 characters'),

  handleValidation,
];

// ── ORDERS ───────────────────────────────────────────────────────────────────
const validateCreateOrder = [
  body('name')
    .trim()
    .notEmpty().withMessage('Order name is required')
    .isLength({ min: 1, max: 100 }).withMessage('Order name must be under 100 characters'),

  body('sellingPrice')
    .notEmpty().withMessage('Selling price is required')
    .isFloat({ min: 0, max: 1000000 }).withMessage('Selling price must be a positive number'),

  body('orderListId')
    .optional()
    .isMongoId().withMessage('Invalid order list ID'),

  handleValidation,
];

const validateUpdateOrder = [
  param('id')
    .isMongoId().withMessage('Invalid order ID'),

  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('Order name must be under 100 characters'),

  body('sellingPrice')
    .optional()
    .isFloat({ min: 0, max: 1000000 }).withMessage('Selling price must be a positive number'),

  body('orderListId')
    .optional()
    .isMongoId().withMessage('Invalid order list ID'),

  handleValidation,
];

const validateDeleteOrder = [
  param('id')
    .isMongoId().withMessage('Invalid order ID'),

  body('reason')
    .trim()
    .notEmpty().withMessage('ምክንያት ሳይሰጡ ትዕዛዝ መሰረዝ አይቻልም')
    .isLength({ min: 3, max: 300 }).withMessage('Reason must be between 3 and 300 characters'),

  handleValidation,
];

// ── ORDER LIST (CATALOG) ─────────────────────────────────────────────────────
const validateCreateOrderListItem = [
  body('type')
    .trim()
    .notEmpty().withMessage('Type is required')
    .isLength({ min: 1, max: 50 }).withMessage('Type must be under 50 characters'),

  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 1, max: 100 }).withMessage('Name must be under 100 characters'),

  body('sellingPrice')
    .notEmpty().withMessage('Selling price is required')
    .isFloat({ min: 0, max: 1000000 }).withMessage('Selling price must be a positive number'),
  handleValidation,
];

const validateUpdateOrderListItem = [
  param('id')
    .isMongoId().withMessage('Invalid item ID'),

  body('type')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 }).withMessage('Type must be under 50 characters'),

  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('Name must be under 100 characters'),

  body('sellingPrice')
    .optional()
    .isFloat({ min: 0, max: 1000000 }).withMessage('Selling price must be a positive number'),
  handleValidation,
];

// ── RUNNING COST ──────────────────────────────────────────────────────────────
const validateCreateRunningCost = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 1, max: 100 }).withMessage('Name must be under 100 characters'),

  body('price')
    .notEmpty().withMessage('Price is required')
    .isFloat({ min: 0, max: 10000000 }).withMessage('Price must be a positive number'),

  handleValidation,
];

// ── MONTHLY EXPENSES ──────────────────────────────────────────────────────────
const validateCreateMonthlyExpense = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 1, max: 100 }).withMessage('Name must be under 100 characters'),

  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0, max: 100000000 }).withMessage('Amount must be a positive number'),

  handleValidation,
];

const validateUpdateMonthlyExpense = [
  param('id')
    .isMongoId().withMessage('Invalid expense ID'),

  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('Name must be under 100 characters'),

  body('amount')
    .optional()
    .isFloat({ min: 0, max: 100000000 }).withMessage('Amount must be a positive number'),

  handleValidation,
];

// ── ADMIN REVENUE QUERY PARAMS ────────────────────────────────────────────────
const validateRevenueQuery = [
  query('daysBack')
    .optional()
    .isInt({ min: 1, max: 365 }).withMessage('daysBack must be between 1 and 365'),

  query('weeksBack')
    .optional()
    .isInt({ min: 1, max: 52 }).withMessage('weeksBack must be between 1 and 52'),

  query('monthsBack')
    .optional()
    .isInt({ min: 1, max: 24 }).withMessage('monthsBack must be between 1 and 24'),

  handleValidation,
];

const validateDateParam = [
  param('date')
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be in YYYY-MM-DD format'),

  handleValidation,
];

module.exports = {
  validateLogin,
  validateCreateOrder,
  validateUpdateOrder,
  validateDeleteOrder,
  validateCreateOrderListItem,
  validateUpdateOrderListItem,
  validateCreateRunningCost,
  validateCreateMonthlyExpense,
  validateUpdateMonthlyExpense,
  validateRevenueQuery,
  validateDateParam,
};