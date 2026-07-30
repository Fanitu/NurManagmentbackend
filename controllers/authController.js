const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const User       = require('../models/User');
const Restaurant = require('../models/Restaurant');

const generateToken = (user, restaurantId) => {
  return jwt.sign(
    {
      id:           user._id,
      role:         user.role,
      restaurantId, // scopes ALL data access — never trust from request body
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// @route  POST /api/auth/login
// @desc   Multi-tenant login — requires name + password + restaurantId
const login = async (req, res) => {
  try {
    const { name, password, restaurantId } = req.body;

    if (!name || !password || !restaurantId) {
      return res.status(400).json({
        message: 'Name, password and Restaurant ID are all required',
      });
    }

    const trimmedName = name.trim();
    const trimmedId   = restaurantId.trim().toUpperCase();

    // Step 1 — Find and validate the restaurant
    const restaurant = await Restaurant.findOne({ restaurantId: trimmedId })
      .select('+password');

    if (!restaurant) {
      return res.status(401).json({ message: 'Invalid Restaurant ID' });
    }

    if (!restaurant.isActive) {
      return res.status(403).json({
        message: 'This restaurant account has been suspended. Please contact support.',
      });
    }

    // Step 2 — Check subscription
    const now      = new Date();
    const daysLeft = Math.ceil(
      (restaurant.subscription.expiryDate - now) / (1000 * 60 * 60 * 24)
    );

    if (
      restaurant.subscription.status !== 'trial' &&
      restaurant.subscription.status !== 'active'
    ) {
      return res.status(403).json({
        message: 'Subscription expired. Please contact support to renew.',
      });
    }

    if (daysLeft <= 0) {
      restaurant.subscription.status = 'expired';
      await restaurant.save();
      return res.status(403).json({
        message: 'Subscription has expired. Please contact support to renew.',
      });
    }

    const expiryWarning = daysLeft <= 3
      ? `Warning: subscription expires in ${daysLeft} day(s).`
      : null;

    // Step 3 — Is this the owner or a worker?
    const isOwner = trimmedName.toLowerCase() === restaurant.ownerName.toLowerCase();

    if (isOwner) {
      // Owner password lives on the Restaurant document
      const isMatch = await bcrypt.compare(password, restaurant.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Incorrect password' });
      }

      // Find or recreate the owner's User record
      let ownerUser = await User.findOne({ name: trimmedName, restaurantId: trimmedId });
      if (!ownerUser) {
        const hashedPassword = await bcrypt.hash(password, 12);
        ownerUser = await User.create({
          name:         trimmedName,
          password:     hashedPassword,
          role:         'admin',
          restaurantId: trimmedId,
        });
      }

      const token = generateToken(ownerUser, trimmedId);
      return res.status(200).json({
        token,
        user: {
          id:             ownerUser._id,
          name:           ownerUser.name,
          role:           ownerUser.role,
          restaurantId:   trimmedId,
          restaurantName: restaurant.restaurantName,
        },
        ...(expiryWarning ? { warning: expiryWarning } : {}),
      });
    }

    // Worker login — self-register on first visit, scoped to this restaurant
    let worker = await User.findOne({
      name:         trimmedName,
      restaurantId: trimmedId,
      role:         'worker',
    }).select('+password');

    if (!worker) {
      const hashedPassword = await bcrypt.hash(password, 12);
      worker = await User.create({
        name:         trimmedName,
        password:     hashedPassword,
        role:         'worker',
        restaurantId: trimmedId,
      });
    } else {
      const isMatch = await bcrypt.compare(password, worker.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Incorrect password' });
      }
    }

    const token = generateToken(worker, trimmedId);
    return res.status(200).json({
      token,
      user: {
        id:             worker._id,
        name:           worker.name,
        role:           worker.role,
        restaurantId:   trimmedId,
        restaurantName: restaurant.restaurantName,
      },
      ...(expiryWarning ? { warning: expiryWarning } : {}),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// @route  GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({
      restaurantId: req.restaurantId,
    }).select('restaurantName restaurantId');

    res.status(200).json({
      user: {
        id:             req.user._id,
        name:           req.user.name,
        role:           req.user.role,
        restaurantId:   req.restaurantId,
        restaurantName: restaurant?.restaurantName || '',
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get user' });
  }
};

module.exports = { login, getMe };