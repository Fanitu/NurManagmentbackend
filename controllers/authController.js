const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// @route   POST /api/auth/login
// @desc    Logs in a user by name+password. If no user with that name
//          exists yet, creates one (defaulting to role "worker").
//          This matches the spec: only an admin should already exist
//          in the DB with role "admin" for the admin panel to show.
const login = async (req, res) => {
  try {
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({ message: 'Name and password are required' });
    }

    const trimmedName = name.trim();
    let user = await User.findOne({ name: trimmedName }).select('+password');

    if (!user) {
      // First time we see this name -> create the account
      const hashedPassword = await bcrypt.hash(password, 10);
      user = await User.create({
        name: trimmedName,
        password: hashedPassword,
        role: 'worker', // new accounts always default to worker
      });
    } else {
      // Existing user -> verify password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Incorrect password' });
      }
    }

    const token = generateToken(user);

    // Only send back what the client needs - never the password hash
    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// @route   GET /api/auth/me
// @desc    Returns the currently logged-in user (used to restore session on refresh)
const getMe = async (req, res) => {
  res.status(200).json({
    user: {
      id: req.user._id,
      name: req.user.name,
      role: req.user.role,
    },
  });
};

module.exports = { login, getMe };
