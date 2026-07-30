
const express  = require('express');
const router   = express.Router();
const { login, getMe } = require('../controllers/authController');
const { protect }      = require('../middleware/auth');
const { loginLimiter } = require('../middleware/security');
const { validateLogin } = require('../middleware/validate');

// loginLimiter applied ONLY to the login route — strictest limit
router.post('/login', loginLimiter, validateLogin, login);

// /me is protected but not rate-limited separately — covered by generalLimiter
router.get('/me', protect, getMe);

module.exports = router;
