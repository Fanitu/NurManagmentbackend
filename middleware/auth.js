const jwt        = require('jsonwebtoken');
const User       = require('../models/User');
const Restaurant = require('../models/Restaurant');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      const message = err.name === 'TokenExpiredError'
        ? 'Session expired. Please log in again.'
        : 'Not authorized';
      return res.status(401).json({ message });
    }

    // Token must contain restaurantId — old tokens without it must re-login
    if (!decoded.restaurantId) {
      return res.status(401).json({ message: 'Session invalid. Please log in again.' });
    }

    // Confirm user still exists in this restaurant
    const user = await User.findOne({
      _id:          decoded.id,
      restaurantId: decoded.restaurantId,
    }).select('_id name role restaurantId');

    if (!user) return res.status(401).json({ message: 'Not authorized' });

    // Confirm restaurant is still active (catches mid-session suspensions)
    const restaurant = await Restaurant.findOne({
      restaurantId: decoded.restaurantId,
      isActive:     true,
    }).select('isActive subscription');

    if (!restaurant) {
      return res.status(403).json({ message: 'Restaurant account suspended or not found.' });
    }

    // Block if subscription expired mid-session
    const now = new Date();
    if (
      restaurant.subscription.expiryDate &&
      restaurant.subscription.expiryDate < now &&
      restaurant.subscription.status !== 'trial'
    ) {
      return res.status(403).json({ message: 'Subscription expired. Please contact support.' });
    }

    // Attach to request — controllers read req.restaurantId, NEVER req.body.restaurantId
    req.user         = user;
    req.restaurantId = decoded.restaurantId;

    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    return res.status(401).json({ message: 'Not authorized' });
  }
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not authorized' });
    const userRole = (req.user.role || '').toLowerCase();
    const allowed  = allowedRoles.map((r) => r.toLowerCase());
    if (!allowed.includes(userRole)) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
};

// Protects restaurant management routes — only Fanu can access these
// via the x-super-admin-secret header set in the monitor frontend
const requireSuperAdmin = (req, res, next) => {
  const secret = req.headers['x-super-admin-secret'];
  if (!secret || secret !== process.env.SUPER_ADMIN_SECRET) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};

module.exports = { protect, requireRole, requireSuperAdmin };