// =============================================================================
// FILE: oms/backend/middleware/security.js
//
// Drop this file into your backend middleware/ folder.
// Then wire it into server.js as shown at the bottom of this file.
// Run: npm install helmet express-rate-limit express-mongo-sanitize xss-clean hpp
// =============================================================================

const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss        = require('xss-clean');
const hpp        = require('hpp');

// ── 1. HELMET ────────────────────────────────────────────────────────────────
// Sets 11 security-related HTTP response headers automatically.
// Key ones for this app:
//   - X-Frame-Options: DENY           → prevents clickjacking (embedding in iframe)
//   - X-Content-Type-Options: nosniff → prevents MIME sniffing attacks
//   - Referrer-Policy                 → controls what info leaks in Referer header
//   - X-XSS-Protection               → legacy browser XSS filter (belt+suspenders)
//   - Strict-Transport-Security       → forces HTTPS once deployed
const helmetMiddleware = helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow fonts/images across origins
  contentSecurityPolicy: false, // CSP is better handled at the CDN/nginx level for a React SPA
});

// ── 2. RATE LIMITERS ─────────────────────────────────────────────────────────
// Each limiter is scoped to a specific concern so legitimate workers
// aren't blocked while still stopping abuse.

// Login — strictest. 10 attempts per 15 minutes per IP.
// A real worker who forgets their password won't need more than 10 tries.
// An attacker trying to brute-force passwords hits a wall immediately.
const loginLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 minutes
  max:              10,
  message:          { message: 'Too many login attempts. Please wait 15 minutes and try again.' },
  standardHeaders:  true,  // return rate limit info in RateLimit-* headers
  legacyHeaders:    false,
  skipSuccessfulRequests: true, // only count FAILED attempts toward the limit
});

// Order submission — workers submit orders rapidly during lunch rush.
// 60 per minute is generous for a single worker but blocks automated scripts.
const orderLimiter = rateLimit({
  windowMs: 60 * 1000,     // 1 minute
  max:      60,
  message:  { message: 'Too many order submissions. Please slow down.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// General API — covers everything else. 200 requests/minute is
// more than enough for any legitimate admin or worker session.
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      200,
  message:  { message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ── 3. MONGODB INJECTION SANITIZATION ────────────────────────────────────────
// Strips MongoDB operators ($gt, $where, $regex, etc.) from
// req.body, req.query, and req.params BEFORE they reach any controller.
//
// Without this, an attacker could send:
//   { "name": "admin", "password": { "$gt": "" } }
// and potentially bypass authentication.
//
// With this, the $ is stripped and the attack fails silently.
const mongoSanitizeMiddleware = mongoSanitize({
  replaceWith: '_', // replace $ with _ instead of just removing (easier to debug)
  onSanitize: ({ req, key }) => {
    console.warn(`[SECURITY] MongoDB injection attempt sanitized — key: ${key}, IP: ${req.ip}`);
  },
});

// ── 4. XSS SANITIZATION ──────────────────────────────────────────────────────
// Strips HTML tags and JavaScript from all string inputs in req.body,
// req.query, req.params.
//
// Without this, a worker could save an order named:
//   <script>document.cookie = 'stolen'</script>
// and when admin views it, that script executes in their browser.
//
// With this, the script tags are stripped before saving to DB.
const xssMiddleware = xss();

// ── 5. HTTP PARAMETER POLLUTION PREVENTION ───────────────────────────────────
// Prevents attacks like: GET /api/orders?sort=name&sort=malicious
// which can confuse Express and expose unexpected behavior.
// hpp picks the LAST value for duplicated params, which is safe behavior.
const hppMiddleware = hpp({
  whitelist: [], // add any params that legitimately allow multiple values
});

// ── 6. REQUEST SIZE LIMIT ────────────────────────────────────────────────────
// Handled in server.js via express.json({ limit: '10kb' })
// A restaurant order form has no legitimate reason to send more than 10kb.
// This prevents large payload attacks (body-parser bombs).

module.exports = {
  helmetMiddleware,
  loginLimiter,
  orderLimiter,
  generalLimiter,
  mongoSanitizeMiddleware,
  xssMiddleware,
  hppMiddleware,
};

// =============================================================================
// HOW TO WIRE INTO server.js — replace your existing middleware section:
//
// const {
//   helmetMiddleware,
//   generalLimiter,
//   mongoSanitizeMiddleware,
//   xssMiddleware,
//   hppMiddleware,
// } = require('./middleware/security');
//
// // Security — must come BEFORE routes
// app.use(helmetMiddleware);
// app.use(generalLimiter);
// app.use(express.json({ limit: '10kb' }));   // ← add limit here
// app.use(mongoSanitizeMiddleware);
// app.use(xssMiddleware);
// app.use(hppMiddleware);
// app.use(cors({ origin: process.env.CLIENT_ORIGIN }));  // ← remove the || '*'
//
// // Then apply route-specific limiters (see routes below)
// =============================================================================
