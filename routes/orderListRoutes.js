const express  = require('express');
const router   = express.Router();
const {
  getOrderList, createOrderListItem,
  updateOrderListItem, deleteOrderListItem,
} = require('../controllers/orderListController');
const { protect, requireRole }  = require('../middleware/auth');
const {
  validateCreateOrderListItem,
  validateUpdateOrderListItem,
} = require('../middleware/validate');

router.get('/',     protect, getOrderList);
router.post('/',    protect, requireRole('admin'), validateCreateOrderListItem, createOrderListItem);
router.put('/:id',  protect, requireRole('admin'), validateUpdateOrderListItem, updateOrderListItem);
router.delete('/:id', protect, requireRole('admin'), deleteOrderListItem);

module.exports = router;
