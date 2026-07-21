'use strict';

/**
 * Global Error Handler
 * ─────────────────────────────────────────────────────────────────────────────
 * Keeps production responses safe by never exposing stack traces, DB URLs,
 * Razorpay secrets, or sensitive internal error details.
 */

const sanitizeErrorMessage = (message) => {
  if (!message) return null;

  return String(message)
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_DATABASE_URL]')
    .replace(/(RAZORPAY_[A-Z_]+)=([^\s]+)/gi, '$1=[REDACTED]')
    .replace(/(JWT_SECRET|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|SUPABASE_URL)=([^\s]+)/gi, '$1=[REDACTED]');
};

const getSafeMessage = (err, fallback) => {
  const sanitized = sanitizeErrorMessage(err?.message || fallback);

  if (process.env.NODE_ENV === 'production') {
    return sanitized || fallback;
  }

  return sanitized || fallback;
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const method = req.method;
  const url = req.originalUrl;

  if (!err.statusCode && !err.code && !err.type) {
    console.error(`[CRITICAL ERROR] ${method} ${url} →`, err);
  } else {
    console.error(`[ERROR] ${method} ${url} →`, err.message || err);
  }

  if (err.code === '23505') {
    const field = err.constraint ? err.constraint.replace(/_key$|_unique$/i, '') : null;
    const detail = process.env.NODE_ENV === 'production' ? null : (err.detail || 'A record with that value already exists.');

    return res.status(409).json({
      success: false,
      message: 'Duplicate value.',
      ...(detail ? { detail } : {}),
      ...(field ? { field } : {}),
    });
  }

  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      message: 'Referenced record does not exist.',
      ...(process.env.NODE_ENV !== 'production' && err.detail ? { detail: err.detail } : {}),
    });
  }

  if (err.code === '23502') {
    return res.status(400).json({
      success: false,
      message: `Field "${err.column}" is required.`,
    });
  }

  if (err.code === '23514') {
    return res.status(400).json({
      success: false,
      message: 'Value failed database constraint check.',
      ...(process.env.NODE_ENV !== 'production' && err.detail ? { detail: err.detail } : {}),
    });
  }

  if (err.code === '22P02') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format. Expected a valid UUID.',
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON in request body.' });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body too large.' });
  }

  if (err.message && err.message.startsWith('CORS policy')) {
    return res.status(403).json({ success: false, message: 'CORS policy: origin not allowed.' });
  }

  if (err.statusCode) {
    return res.status(err.statusCode).json({ success: false, message: getSafeMessage(err, err.message || 'Request could not be processed.') });
  }

  const fallback = process.env.NODE_ENV === 'production'
    ? 'An unexpected server error occurred.'
    : 'Internal server error';

  return res.status(500).json({ success: false, message: getSafeMessage(err, fallback) });
};

module.exports = errorHandler;
