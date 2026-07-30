# OMS Security Update

## Install new packages first

```bash
cd oms/backend
npm install helmet express-rate-limit express-mongo-sanitize express-validator xss-clean hpp
```

## Files to update/create

| File | Action |
|---|---|
| `middleware/security.js` | CREATE — new file |
| `middleware/validate.js` | CREATE — new file |
| `middleware/auth.js` | REPLACE existing file |
| `server.js` | REPLACE existing file |
| `routes/authRoutes.js` | REPLACE (add loginLimiter + validateLogin) |
| `routes/orderRoutes.js` | REPLACE (add orderLimiter + validators) |
| `routes/orderListRoutes.js` | REPLACE (add validators) |
| `routes/runningCostRoutes.js` | REPLACE (add validator) |
| `routes/adminRoutes.js` | REPLACE (add validators) |
| `routes/monthlyExpenseRoutes.js` | REPLACE (add validators) |
| `.env` | ADD NODE_ENV and CLIENT_ORIGIN |

## What each layer does

### Helmet
Sets 11 HTTP security headers on every response.
Stops clickjacking, MIME sniffing, and cross-origin attacks before
your code even runs.

### Rate Limiting
- Login endpoint: 10 attempts per 15 min per IP
  (skipSuccessfulRequests: true — only failed logins count)
- Order submission: 60 per minute per IP
- Everything else: 200 per minute per IP

### MongoDB Sanitization
Strips $ and . from all request bodies/params/queries.
Prevents: { "password": { "$gt": "" } } login bypass attacks.

### XSS Sanitization
Strips HTML tags and JavaScript from all string inputs.
Prevents: <script>alert('xss')</script> being saved to DB
and executed when admin views data.

### HTTP Parameter Pollution (HPP)
Prevents: ?sort=name&sort=malicious duplicate parameter abuse.
Takes the last value for duplicates — safe, predictable behavior.

### Request Size Limit (10kb)
express.json({ limit: '10kb' }) in server.js.
Prevents large payload bombs from exhausting server memory.

### Input Validation (express-validator)
Every route that accepts body data now validates:
- Required fields are present
- Strings are within length limits
- Numbers are in valid ranges
- MongoDB IDs are valid ObjectIds
- Date params match YYYY-MM-DD format
- Ethiopian/Amharic characters accepted in name fields

### Hardened Auth Middleware
1. Token signature verified (was already done)
2. Token expiry checked (was already done)
3. User confirmed to still exist in DB (NEW)
   — deleted workers can't use old tokens
4. Role check is case-insensitive (NEW defensive measure)
5. Error messages never reveal user existence (NEW)

### CORS Hardening
Removed the || '*' fallback — origin is now required via CLIENT_ORIGIN env var.
In production, only requests from your exact frontend domain are accepted.

### Production Error Responses
In production (NODE_ENV=production), errors return generic messages only.
Stack traces go to server logs and your monitor — never to the client.

## Testing the security locally

After installing and wiring everything:

**Test rate limiting (login):**
```bash
for i in {1..12}; do
  curl -s -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"name":"test","password":"wrong"}' | jq .message
done
# After 10 attempts: "Too many login attempts. Please wait 15 minutes and try again."
```

**Test MongoDB injection:**
```bash
curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"name":"admin","password":{"$gt":""}}' | jq .
# Should return validation error, not a successful login
```

**Test XSS:**
```bash
curl -s -X POST http://localhost:5000/api/running-cost \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name":"<script>alert(1)</script>","price":100}' | jq .name
# Should return sanitized string, script tags stripped
```

**Test request size limit:**
```bash
# Generate a 20kb payload and send it
python3 -c "import json; print(json.dumps({'name': 'x'*20000, 'price': 1}))" | \
  curl -s -X POST http://localhost:5000/api/running-cost \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d @- | jq .
# Should return 413 Payload Too Large
```
