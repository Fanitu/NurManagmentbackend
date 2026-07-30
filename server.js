// =============================================================================
// FILE: oms/backend/server.js  (COMPLETE REPLACEMENT)
// =============================================================================

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

const {
  helmetMiddleware,
  generalLimiter,
  mongoSanitizeMiddleware,
  xssMiddleware,
  hppMiddleware,
} = require('./middleware/security');

const authRoutes           = require('./routes/authRoutes');
const orderRoutes          = require('./routes/orderRoutes');
const orderListRoutes      = require('./routes/orderListRoutes');
const runningCostRoutes    = require('./routes/runningCostRoutes');
const adminRoutes          = require('./routes/adminRoutes');
const monthlyExpenseRoutes = require('./routes/monthlyExpenseRoutes');
const restaurantRoutes = require('./routes/restaurantRoutes');

const { reportBackendError, reportHeartbeat } = require('./utils/monitorReporter');

const app = express();

connectDB();

// ── SECURITY MIDDLEWARE ───────────────────────────────────────────────────────
// ORDER MATTERS — these must run before routes

// 1. Helmet — security headers first, before anything is sent
app.use(helmetMiddleware);

// 2. CORS — locked to your exact frontend origin
// In production: CLIENT_ORIGIN=https://your-oms-app.com
// In development: CLIENT_ORIGIN=http://localhost:5173

console.log('CORS origin:', process.env.CLIENT_ORIGIN );
console.log('CORS origin fallback:', process.env.CORS_ORIGIN );
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [
        'https://nur-managment-frontend-8u92.vercel.app',
        'https://oms-monitoring-one.vercel.app/',
        'https://omsmonitoringbackend.onrender.com/',
        // Add your production domains here
      ];
      
      // Check if the origin is in the allowed list
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        // For development, also allow any localhost
        if (origin.match(/^http:\/\/localhost:\d+$/)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-super-admin-secret'],
  })
);

// 3. Body parser with 10kb limit — prevents large payload attacks
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 4. General rate limiter — covers all routes before they split
app.use('/api', generalLimiter);

// 5. MongoDB injection sanitization — must run AFTER body parsing
app.use(mongoSanitizeMiddleware);

// 6. XSS sanitization — strip HTML/script from all inputs
app.use(xssMiddleware);

// 7. HTTP parameter pollution prevention
app.use(hppMiddleware);

// ── HEALTH CHECK (public — no auth, no rate limit override) ───────────────────
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'ok',
    db:     dbStatus,
    uptime: Math.round(process.uptime()),
  });
});

// ── ROUTES ────────────────────────────────────────────────────────────────────
// Route-specific rate limiters (loginLimiter, orderLimiter) are
// applied inside each route file, not here — keeps each file self-contained
app.use('/api/auth',              authRoutes);
app.use('/api/orders',            orderRoutes);
app.use('/api/orderlist',         orderListRoutes);
app.use('/api/running-cost',      runningCostRoutes);
app.use('/api/admin',             adminRoutes);
app.use('/api/monthly-expenses',  monthlyExpenseRoutes);
app.use('/api/restaurants', restaurantRoutes);

// ── 404 HANDLER ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ── GLOBAL ERROR HANDLER ──────────────────────────────────────────────────────
// CRITICAL security rule: NEVER send stack traces or internal details
// to the client in production — they reveal your code structure to attackers.
// Stack traces go to your logs and monitor only.
app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;

  // Log full error internally
  console.error(`[ERROR] ${req.method} ${req.path} — ${err.message}`);
  if (err.stack) console.error(err.stack);

  // Report to monitor (non-blocking)
  reportBackendError({
    type:        err.name || 'SERVER_ERROR',
    message:     err.message,
    stack:       process.env.NODE_ENV === 'production' ? null : err.stack,
    endpoint:    req.path,
    statusCode,
  });

  // Send sanitized response to client
  // In production: generic message only
  // In development: include message for easier debugging
  const clientMessage = process.env.NODE_ENV === 'production'
    ? 'Something went wrong. Please try again.'
    : err.message || 'Internal server error';

  res.status(statusCode).json({ message: clientMessage });
});

// ── START SERVER + HEARTBEAT CRON ────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`OMS backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);

  // Start sending heartbeats to monitor every 5 minutes
  const sendHeartbeat = () => {
    const mem   = process.memoryUsage();
    const dbUp  = mongoose.connection.readyState === 1;
    reportHeartbeat({
      dbConnected:   dbUp,
      memoryUsageMB: Math.round(mem.rss / 1024 / 1024),
      uptime:        Math.round(process.uptime()),
    });
  };

  // Send first heartbeat after 30 seconds (give DB time to connect)
  setTimeout(sendHeartbeat, 30000);
  // Then every 5 minutes
  setInterval(sendHeartbeat, 5 * 60 * 1000);
});
