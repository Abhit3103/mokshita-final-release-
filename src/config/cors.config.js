'use strict';

const cors = require('cors');

/**
 * Local development origins (storefront + admin + static servers).
 * Not used in production unless also listed in ALLOWED_ORIGINS.
 */
const DEFAULT_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

/**
 * Example production origins — set via ALLOWED_ORIGINS in .env (comma-separated).
 * https://mokshita.com
 * https://www.mokshita.com
 * https://admin.mokshita.com
 * https://api.mokshita.com
 */

function parseEnvOrigins() {
  return (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getAllowedOrigins() {
  const envOrigins = parseEnvOrigins();
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    return [...new Set(envOrigins)];
  }

  return [...new Set([...DEFAULT_DEV_ORIGINS, ...envOrigins])];
}

function validateCorsConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  const origins = getAllowedOrigins();

  if (isProduction && origins.length === 0) {
    console.warn(
      '⚠️  CORS: NODE_ENV=production but ALLOWED_ORIGINS is empty. Cross-origin browser requests will be blocked.'
    );
  } else if (!isProduction) {
    console.log(`[CORS] Development mode — ${origins.length} allowed origin(s)`);
  }
}

function originCallback(origin, callback) {
  const allowed = getAllowedOrigins();

  // Same-origin, curl, Postman, server-to-server
  if (!origin) {
    return callback(null, true);
  }

  if (allowed.includes(origin)) {
    return callback(null, true);
  }

  const err = new Error(`CORS policy: origin "${origin}" is not allowed`);
  err.statusCode = 403;
  return callback(err, false);
}

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'Accept',
  'Origin',
  'X-Requested-With',
];

function createCorsMiddleware() {
  validateCorsConfig();

  return cors({
    origin: originCallback,
    credentials: true,
    methods: ALLOWED_METHODS,
    allowedHeaders: ALLOWED_HEADERS,
    exposedHeaders: ['Content-Range'],
    optionsSuccessStatus: 204,
    maxAge: process.env.NODE_ENV === 'production' ? 86400 : 600,
  });
}

module.exports = {
  getAllowedOrigins,
  createCorsMiddleware,
  DEFAULT_DEV_ORIGINS,
};
