'use strict';

/**
 * Keep-Alive Pinger
 *
 * Render free tier spins down after ~15 min of inactivity.
 * This script pings the backend every 14 minutes to keep it awake.
 *
 * Usage:
 *   node keep-alive.js
 *
 * Background (Windows):
 *   start /B node keep-alive.js
 *
 * Background (Linux/Mac):
 *   nohup node keep-alive.js &
 */

const https = require('https');

// ── Config ────────────────────────────────────────────────────────────────────
const BACKEND_URL = 'https://mokshita-final-release.onrender.com';
const PING_PATH   = '/';               // Root — lightweight, no auth needed
const INTERVAL_MS = 14 * 60 * 1000;   // 14 minutes (Render sleeps at ~15 min)
// ─────────────────────────────────────────────────────────────────────────────

let pingCount = 0;

function ping() {
  pingCount++;
  const ts = new Date().toISOString();

  const req = https.get(BACKEND_URL + PING_PATH, (res) => {
    console.log('[' + ts + '] Ping #' + pingCount + ' OK  — HTTP ' + res.statusCode);
    res.resume();
  });

  req.on('error', (err) => {
    console.error('[' + ts + '] Ping #' + pingCount + ' FAILED — ' + err.message);
  });

  req.setTimeout(10000, () => {
    console.warn('[' + ts + '] Ping #' + pingCount + ' timed out (10s)');
    req.destroy();
  });
}

console.log('Keep-Alive pinger started');
console.log('Target   : ' + BACKEND_URL + PING_PATH);
console.log('Interval : every ' + (INTERVAL_MS / 60000) + ' minutes');
console.log('Press Ctrl+C to stop.');
console.log('');

ping();
setInterval(ping, INTERVAL_MS);
