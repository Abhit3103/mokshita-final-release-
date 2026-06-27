'use strict';

/**
 * Global Error Handler — v2
 * ─────────────────────────────────────────────────────────────────────────────
 * Extended from the original to handle more PostgreSQL error codes,
 * structured validation errors, and standardized response envelope.
 * All existing behavior preserved — only new cases added.
 */

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const method = req.method;
  const url    = req.originalUrl;

  // Log full error for unexpected internal errors, otherwise just the message
  if (!err.statusCode && !err.code && !err.type) {
    console.error(`[CRITICAL ERROR] ${method} ${url} →`, err);
  } else {
    console.error(`[ERROR] ${method} ${url} →`, err.message || err);
  }

  // ── Postgres: Unique constraint violation (23505) ───────────────────────────
  if (err.code === '23505') {
    // Extract field name from constraint detail if possible
    const field   = err.constraint ? err.constraint.replace(/_key$|_unique$/i, '') : null;
    const detail  = err.detail || 'A record with that value already exists.';
    return res.status(409).json({
      success : false,
      message : 'Duplicate value.',
      detail,
      ...(field && { field }),
    });
  }

  // ── Postgres: Foreign key violation (23503) ─────────────────────────────────
  if (err.code === '23503') {
    return res.status(400).json({
      success : false,
      message : 'Referenced record does not exist.',
      detail  : err.detail || null,
    });
  }

  // ── Postgres: Not null violation (23502) ───────────────────────────────────
  if (err.code === '23502') {
    return res.status(400).json({
      success : false,
      message : `Field "${err.column}" is required.`,
    });
  }

  // ── Postgres: Check constraint violation (23514) ───────────────────────────
  if (err.code === '23514') {
    return res.status(400).json({
      success : false,
      message : 'Value failed database constraint check.',
      detail  : err.detail || null,
    });
  }

  // ── Postgres: Invalid UUID format (22P02) ─────────────────────────────────
  if (err.code === '22P02') {
    return res.status(400).json({
      success : false,
      message : 'Invalid ID format. Expected a valid UUID.',
    });
  }

  // ── JSON body parse error ──────────────────────────────────────────────────
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON in request body.' });
  }

  // ── Request body too large ─────────────────────────────────────────────────
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body too large.' });
  }

  // ── CORS ───────────────────────────────────────────────────────────────────
  if (err.message && err.message.startsWith('CORS policy')) {
    return res.status(403).json({ success: false, message: err.message });
  }

  // ── Custom application errors with statusCode ──────────────────────────────
  if (err.statusCode) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }

  // ── Fallback 500 ───────────────────────────────────────────────────────────
  const message = process.env.NODE_ENV !== 'production'
    ? (err.message || 'Internal server error')
    : 'An unexpected server error occurred.';

  return res.status(500).json({ success: false, message });
};

module.exports = errorHandler;
