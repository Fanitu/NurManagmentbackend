const express = require('express');
const router = express.Router();
const {
  getOrderList,
  createOrderListItem,
  updateOrderListItem,
  deleteOrderListItem,
} = require('../controllers/orderListController');
const { protect, requireRole } = require('../middleware/auth');

// any logged-in user (worker or admin) can read the catalog to populate the Select
router.get('/', protect, getOrderList);

// only admin can manage the catalog
router.post('/', protect, requireRole('admin'), createOrderListItem);
router.put('/:id', protect, requireRole('admin'), updateOrderListItem);
router.delete('/:id', protect, requireRole('admin'), deleteOrderListItem);

module.exports = router;
