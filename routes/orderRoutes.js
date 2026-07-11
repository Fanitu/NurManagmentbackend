const express = require('express');
const router = express.Router();
const {
  createOrder,
  getTodaysOrders,
  getAllOrders,
  updateOrder,
  deleteOrder,
} = require('../controllers/orderController');
const { protect, requireRole } = require('../middleware/auth');

router.post('/', protect, createOrder);
router.get('/today', protect, getTodaysOrders);
router.get('/', protect, requireRole('admin'), getAllOrders);
router.put('/:id', protect, updateOrder);
router.delete('/:id', protect, deleteOrder);

module.exports = router;
