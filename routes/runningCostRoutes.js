const express = require('express');
const router = express.Router();
const { createRunningCost, getAllRunningCosts } = require('../controllers/runningCostController');
const { protect, requireRole } = require('../middleware/auth');

router.post('/', protect, createRunningCost);
router.get('/', protect, requireRole('admin'), getAllRunningCosts);

module.exports = router;
