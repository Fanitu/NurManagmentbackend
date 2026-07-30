// ─────────────────────────────────────────────────────────────────────────────
// DROP THIS FILE INTO: oms/backend/utils/monitorReporter.js
// Then add the two things shown at the bottom to your OMS server.js
// ─────────────────────────────────────────────────────────────────────────────
const https = require('https');
const http  = require('http');

const MONITOR_URL    = process.env.MONITOR_URL;    // e.g. https://your-monitor.com
const OMS_SECRET     = process.env.OMS_REPORT_SECRET;
const ENABLED        = !!MONITOR_URL && !!OMS_SECRET;

function post(path, body) {
  if (!ENABLED) return; // silently skip if monitor not configured

  const data    = JSON.stringify(body);
  const url     = `${MONITOR_URL}${path}`;
  const client  = url.startsWith('https') ? https : http;
  const urlObj  = new URL(url);

  const options = {
    hostname: urlObj.hostname,
    port:     urlObj.port || (url.startsWith('https') ? 443 : 80),
    path:     urlObj.pathname,
    method:   'POST',
    headers: {
      'Content-Type':    'application/json',
      'Content-Length':  Buffer.byteLength(data),
      'x-oms-secret':    OMS_SECRET,
    },
  };

  const req = client.request(options);
  req.on('error', () => {}); // never throw — reporter failure must never crash OMS
  req.write(data);
  req.end();
}

// Called by the global error handler in server.js
function reportBackendError({ type, message, stack, endpoint, statusCode, responseTimeMs }) {
  post('/api/monitor/ingest/backend-error', {
    type, message, stack, endpoint, statusCode, responseTimeMs,
  });
}

// Called by the heartbeat cron in server.js
function reportHeartbeat({ dbConnected, memoryUsageMB, uptime }) {
  const start = Date.now();
  post('/api/monitor/ingest/heartbeat', {
    status:        dbConnected ? 'ok' : 'degraded',
    dbConnected,
    memoryUsageMB,
    uptime,
    responseTimeMs: Date.now() - start,
  });
}

module.exports = { reportBackendError, reportHeartbeat };

// ─────────────────────────────────────────────────────────────────────────────
// WHAT TO ADD TO YOUR OMS backend/server.js:
// ─────────────────────────────────────────────────────────────────────────────
//
// 1. At the top, require the reporter:
//      const { reportBackendError, reportHeartbeat } = require('./utils/monitorReporter');
//      const cron = require('node-cron');
//      const mongoose = require('mongoose');
//
// 2. Replace your existing global error handler with this:
//      app.use((err, req, res, next) => {
//        console.error('Unhandled error:', err);
//        reportBackendError({
//          type:        'SERVER_ERROR',
//          message:     err.message,
//          stack:       err.stack,
//          endpoint:    req.path,
//          statusCode:  err.status || 500,
//        });
//        res.status(500).json({ message: 'Something went wrong on the server' });
//      });
//
// 3. Add a heartbeat cron after app.listen():
//      cron.schedule('*/5 * * * *', () => {
//        const mem    = process.memoryUsage();
//        const dbUp   = mongoose.connection.readyState === 1;
//        reportHeartbeat({
//          dbConnected:   dbUp,
//          memoryUsageMB: Math.round(mem.rss / 1024 / 1024),
//          uptime:        Math.round(process.uptime()),
//        });
//      });
//
// 4. Add to your OMS .env:
//      MONITOR_URL=https://your-monitor-server.com
//      OMS_REPORT_SECRET=same_secret_as_in_monitor_.env
// ─────────────────────────────────────────────────────────────────────────────
