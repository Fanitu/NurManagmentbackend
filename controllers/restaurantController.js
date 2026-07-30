const bcrypt     = require('bcryptjs');
const Restaurant = require('../models/Restaurant');
const User       = require('../models/User');

async function generateUniqueRestaurantId() {
  let id;
  let exists = true;
  while (exists) {
    const num = Math.floor(1000 + Math.random() * 9000);
    id = `OMS-${num}`;
    exists = await Restaurant.findOne({ restaurantId: id });
  }
  return id;
}

// @route  POST /api/restaurants
// @desc   Fanu registers a new restaurant. Creates Restaurant doc + owner User doc.
const createRestaurant = async (req, res) => {
  try {
    const { ownerName, password, restaurantName, location, phone, notes, plan } = req.body;

    if (!ownerName || !password) {
      return res.status(400).json({ message: 'ownerName and password are required' });
    }

    const restaurantId   = await generateUniqueRestaurantId();
    const hashedPassword = await bcrypt.hash(password, 12);
    const now            = new Date();
    const trialExpiry    = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const restaurant = await Restaurant.create({
      restaurantId,
      ownerName:      ownerName.trim(),
      password:       hashedPassword,
      restaurantName: (restaurantName || '').trim(),
      location:       (location || '').trim(),
      phone:          (phone || '').trim(),
      notes:          (notes || '').trim(),
      subscription: {
        status:          plan === 'monthly' || plan === 'yearly' ? 'active' : 'trial',
        startDate:       now,
        expiryDate:      trialExpiry,
        lastPaymentDate: plan && plan !== 'trial' ? now : null,
        plan:            plan || 'trial',
      },
    });

    // Create the owner's User record for OMS login
    await User.create({
      name:         ownerName.trim(),
      password:     hashedPassword,
      role:         'admin',
      restaurantId,
    });

    const result = restaurant.toObject();
    delete result.password;

    res.status(201).json({
      message:    'Restaurant created successfully',
      restaurant: result,
      // Plain password returned ONCE so Fanu can hand it to the client
      // After this it is gone — only the hash is stored
      ownerCredentials: {
        name: ownerName.trim(),
        restaurantId,
        password,
      },
    });
  } catch (err) {
    console.error('Create restaurant error:', err);
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Duplicate ID — try again' });
    }
    res.status(500).json({ message: 'Failed to create restaurant' });
  }
};

// @route  GET /api/restaurants
const getAllRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find().select('-password').sort({ createdAt: -1 });
    const now = new Date();

    const enriched = restaurants.map((r) => {
      const obj = r.toObject();
      if (obj.subscription.expiryDate) {
        const daysLeft = Math.ceil(
          (obj.subscription.expiryDate - now) / (1000 * 60 * 60 * 24)
        );
        obj.subscription.daysLeft = daysLeft;
        if (obj.subscription.status === 'active' && daysLeft <= 0) {
          obj.subscription.status = 'expired'; // display only — not saved
        }
      }
      return obj;
    });

    res.status(200).json(enriched);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch restaurants' });
  }
};

// @route  GET /api/restaurants/:restaurantId
const getRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({
      restaurantId: req.params.restaurantId.toUpperCase(),
    }).select('-password');

    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
    res.status(200).json(restaurant);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch restaurant' });
  }
};

// @route  PUT /api/restaurants/:restaurantId/subscription
const updateSubscription = async (req, res) => {
  try {
    const { status, plan, expiryDate, notes } = req.body;
    const restaurant = await Restaurant.findOne({
      restaurantId: req.params.restaurantId.toUpperCase(),
    });
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

    if (status)     restaurant.subscription.status     = status;
    if (plan)       restaurant.subscription.plan       = plan;
    if (expiryDate) restaurant.subscription.expiryDate = new Date(expiryDate);
    if (notes)      restaurant.notes                   = notes;
    if (status === 'active') restaurant.subscription.lastPaymentDate = new Date();

    await restaurant.save();
    const result = restaurant.toObject();
    delete result.password;
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update subscription' });
  }
};

// @route  PUT /api/restaurants/:restaurantId/toggle
const toggleRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({
      restaurantId: req.params.restaurantId.toUpperCase(),
    });
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

    restaurant.isActive = !restaurant.isActive;
    await restaurant.save();
    res.status(200).json({
      message:  `Restaurant ${restaurant.isActive ? 'activated' : 'suspended'}`,
      isActive: restaurant.isActive,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to toggle restaurant' });
  }
};

module.exports = {
  createRestaurant,
  getAllRestaurants,
  getRestaurant,
  updateSubscription,
  toggleRestaurant,
};