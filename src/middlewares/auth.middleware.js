'use strict';

const { createRemoteJWKSet, jwtVerify } = require('jose');
const pool = require('../config/db');

const normalizeSupabaseUrl = (value) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const matched = trimmed.match(/(?:postgres(?:ql)?):\/\/[^@]+@(?:db\.)?([a-z0-9-]+)\.supabase\.co/i);
  if (matched) return `https://${matched[1]}.supabase.co`;

  return trimmed;
};

const getSupabaseBaseUrl = () => {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  if (!url) return null;

  try {
    return new URL(url).origin;
  } catch (error) {
    return null;
  }
};

const getSupabaseIssuer = () => {
  const baseUrl = getSupabaseBaseUrl();
  if (!baseUrl) return null;
  return `${baseUrl}/auth/v1`;
};

const getJwksUrl = () => {
  const baseUrl = getSupabaseBaseUrl();
  if (!baseUrl) return null;
  return `${baseUrl}/auth/v1/.well-known/jwks.json`;
};

const verifySupabaseJwt = async (token) => {
  const issuer = getSupabaseIssuer();
  const audience = process.env.SUPABASE_JWT_AUDIENCE || 'authenticated';
  const jwksUrl = getJwksUrl();

  if (!jwksUrl || !issuer) {
    throw new Error('Supabase auth is not configured. Set SUPABASE_URL.');
  }

  const JWKS = createRemoteJWKSet(new URL(jwksUrl));

  const { payload } = await jwtVerify(token, JWKS, {
    issuer,
    audience,
    algorithms: ['RS256'],
  });

  return payload;
};

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = await verifySupabaseJwt(token);

    if (!decoded?.sub) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }

    const localUserResult = await pool.query(
      'SELECT id, email, role, full_name, phone, address_line, city, state, pincode, country, created_at, supabase_user_id FROM users WHERE supabase_user_id = $1',
      [decoded.sub]
    );

    const localUser = localUserResult.rows[0] || null;

    if (!localUser) {
      return res.status(401).json({ success: false, message: 'Authentication failed. Local user not linked.' });
    }

    req.user = {
      id: localUser.id,
      supabase_user_id: decoded.sub,
      email: localUser.email,
      role: localUser.role,
    };
    next();
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Supabase auth middleware error:', error.message || error);
    }

    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

module.exports = { authenticateToken };
