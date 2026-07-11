const Order = require('../models/Order');
const OrderList = require('../models/OrderList');
const { startOfDay, endOfDay } = require('../utils/dateRanges');

// @route   POST /api/orders
// @desc    Worker submits a new order. We look up the matching OrderList item
//          to capture an accurate makingPrice/profit snapshot, but the
//          sellingPrice the worker entered is what actually gets saved
//          (in case it was adjusted, e.g. a discount).
const createOrder = async (req, res) => {
  try {
    const { orderListId, name, sellingPrice } = req.body;

    if (!name || sellingPrice === undefined) {
      return res.status(400).json({ message: 'name and sellingPrice are required' });
    }

    let makingPrice = 0;
    let type = '';

    if (orderListId) {
      const catalogItem = await OrderList.findById(orderListId);
      if (catalogItem) {
        makingPrice = catalogItem.makingPrice;
        type = catalogItem.type;
      }
    }

    const order = await Order.create({
      name,
      type,
      sellingPrice: Number(sellingPrice),
      makingPrice,
      createdBy: req.user ? req.user._id : undefined,
    });

    res.status(201).json(order);
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ message: 'Failed to save order' });
  }
};

// @route   GET /api/orders/today
// @desc    Get all orders placed today, newest first
const getTodaysOrders = async (req, res) => {
  try {
    const now = new Date();
    const orders = await Order.find({
      createdAt: { $gte: startOfDay(now), $lte: endOfDay(now) },
    }).sort({ createdAt: -1 });

    res.status(200).json(orders);
  } catch (err) {
    console.error('Get todays orders error:', err);
    res.status(500).json({ message: 'Failed to fetch todays orders' });
  }
};

// @route   GET /api/orders
// @desc    Get all orders (used by admin Orders List view), newest first
const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (err) {
    console.error('Get all orders error:', err);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
};

// @route   PUT /api/orders/:id
// @desc    Update an order's name/sellingPrice (worker "Update Now" or admin update)
const updateOrder = async (req, res) => {
  try {
    const { name, sellingPrice, makingPrice, orderListId } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (orderListId) {
      const catalogItem = await OrderList.findById(orderListId);
      if (catalogItem) {
        order.makingPrice = catalogItem.makingPrice;
        order.type = catalogItem.type;
      }
    } else if (makingPrice !== undefined) {
      order.makingPrice = Number(makingPrice);
    }

    if (name !== undefined) order.name = name;
    if (sellingPrice !== undefined) order.sellingPrice = Number(sellingPrice);

    await order.save(); // pre-save hook recalculates profit
    res.status(200).json(order);
  } catch (err) {
    console.error('Update order error:', err);
    res.status(500).json({ message: 'Failed to update order' });
  }
};

// @route   DELETE /api/orders/:id
const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.status(200).json({ message: 'Order deleted', id: req.params.id });
  } catch (err) {
    console.error('Delete order error:', err);
    res.status(500).json({ message: 'Failed to delete order' });
  }
};

module.exports = {
  createOrder,
  getTodaysOrders,
  getAllOrders,
  updateOrder,
  deleteOrder,
};
