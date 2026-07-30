const express  = require('express');
const router   = express.Router();
const {
  createOrder, getTodaysOrders, getAllOrders,
  updateOrder, deleteOrder,
} = require('../controllers/orderController');
const { protect, requireRole }   = require('../middleware/auth');
const { orderLimiter }           = require('../middleware/security');
const {
  validateCreateOrder,
  validateUpdateOrder,
  validateDeleteOrder,
} = require('../middleware/validate');

router.post('/',       protect, orderLimiter, validateCreateOrder, createOrder);
router.get('/today',   protect, getTodaysOrders);
router.get('/',        protect, requireRole('admin'), getAllOrders);
router.put('/:id',     protect, validateUpdateOrder, updateOrder);
router.delete('/:id',  protect, validateDeleteOrder, deleteOrder);

module.exports = router;