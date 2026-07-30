const express  = require('express');
const router   = express.Router();
const { createRunningCost, getAllRunningCosts } = require('../controllers/runningCostController');
const { protect, requireRole } = require('../middleware/auth');
const { validateCreateRunningCost } = require('../middleware/validate');

router.post('/', protect, validateCreateRunningCost, createRunningCost);
router.get('/',  protect, requireRole('admin'), getAllRunningCosts);

module.exports = router;