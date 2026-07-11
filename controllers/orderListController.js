const OrderList = require('../models/OrderList');

// @route   GET /api/orderlist
// @desc    Get all order list items (used to populate the worker's Select dropdown,
//          grouped by type on the frontend)
const getOrderList = async (req, res) => {
  try {
    const items = await OrderList.find().sort({ type: 1, name: 1 });
    res.status(200).json(items);
  } catch (err) {
    console.error('Get order list error:', err);
    res.status(500).json({ message: 'Failed to fetch order list' });
  }
};

// @route   POST /api/orderlist
// @desc    Admin adds a new orderable item (type, name, sellingPrice, makingPrice)
const createOrderListItem = async (req, res) => {
  try {
    const { type, name, sellingPrice} = req.body;

    if (!type || !name || sellingPrice === undefined ) {
      return res.status(400).json({ message: 'type, name, and sellingPrice are all required' });
    }

    const item = await OrderList.create({
      type: type.trim(),
      name: name.trim(),
      sellingPrice: Number(sellingPrice),
    });

    res.status(201).json(item);
  } catch (err) {
    console.error('Create order list item error:', err);
    res.status(500).json({ message: 'Failed to create order list item' });
  }
};

// @route   PUT /api/orderlist/:id
// @desc    Admin updates an existing order list item
const updateOrderListItem = async (req, res) => {
  try {
    const { type, name, sellingPrice} = req.body;

    const item = await OrderList.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Order list item not found' });
    }

    if (type !== undefined) item.type = type.trim();
    if (name !== undefined) item.name = name.trim();
    if (sellingPrice !== undefined) item.sellingPrice = Number(sellingPrice);

    await item.save();
    res.status(200).json(item);
  } catch (err) {
    console.error('Update order list item error:', err);
    res.status(500).json({ message: 'Failed to update order list item' });
  }
};

// @route   DELETE /api/orderlist/:id
// @desc    Admin deletes an order list item
const deleteOrderListItem = async (req, res) => {
  try {
    const item = await OrderList.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Order list item not found' });
    }
    res.status(200).json({ message: 'Order list item deleted', id: req.params.id });
  } catch (err) {
    console.error('Delete order list item error:', err);
    res.status(500).json({ message: 'Failed to delete order list item' });
  }
};

module.exports = {
  getOrderList,
  createOrderListItem,
  updateOrderListItem,
  deleteOrderListItem,
};
