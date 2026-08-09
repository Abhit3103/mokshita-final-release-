'use strict';

const { createClient } = require('@supabase/supabase-js');
const pool = require('../config/db');

const normalizeEmail = (email) => (email || '').trim().toLowerCase();

const normalizeSupabaseUrl = (value) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const matched = trimmed.match(/(?:postgres(?:ql)?):\/\/[^@]+@(?:db\.)?([a-z0-9-]+)\.supabase\.co/i);
  if (matched) return `https://${matched[1]}.supabase.co`;

  return trimmed;
};

const getSupabaseClient = () => {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const key = (process.env.SUPABASE_ANON_KEY || '').trim();

  if (!url || !key) {
    throw new Error('Supabase auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

/**
 * Ensure a local DB user exists for the Supabase auth user.
 * Cart/orders use the local UUID (users.id), not the Supabase UUID.
 */
const ensureLocalUser = async (supabaseUser) => {
  const supabaseUserId = supabaseUser.id;
  const email = normalizeEmail(supabaseUser.email);
  const fullName = supabaseUser.user_metadata?.full_name || null;
  const phone = supabaseUser.phone || supabaseUser.user_metadata?.phone || null;

  if (!supabaseUserId) {
    throw new Error('Supabase user ID is missing.');
  }

  const bySupabaseId = await pool.query(
    'SELECT id, email, role, full_name, phone, supabase_user_id FROM users WHERE supabase_user_id = $1',
    [supabaseUserId]
  );

  if (bySupabaseId.rows.length > 0) {
    return bySupabaseId.rows[0];
  }

  if (email) {
    const byEmail = await pool.query(
      'SELECT id, email, role, full_name, phone, supabase_user_id FROM users WHERE email = $1',
      [email]
    );

    if (byEmail.rows.length > 0) {
      const current = byEmail.rows[0];

      if (current.supabase_user_id && current.supabase_user_id !== supabaseUserId) {
        throw new Error('Local user is already linked to a different Supabase account.');
      }

      const linked = await pool.query(
        `UPDATE users
         SET supabase_user_id = $1,
             full_name = COALESCE($2, full_name),
             phone = COALESCE($3, phone)
         WHERE id = $4
         RETURNING id, email, role, full_name, phone, supabase_user_id`,
        [supabaseUserId, fullName, phone, current.id]
      );
      return linked.rows[0];
    }
  }

  const created = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, phone, role, supabase_user_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, email, role, full_name, phone, supabase_user_id`,
    [email || `${supabaseUserId}@users.supabase.local`, '__supabase_auth__', fullName, phone, 'customer', supabaseUserId]
  );

  return created.rows[0];
};

/**
 * Verify Supabase JWT from Authorization: Bearer <token>
 * Sets req.user = { id, supabase_user_id, email, role }
 */
const authenticateToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Supabase getUser error:', error?.message || 'No user returned');
      }
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    const localUser = await ensureLocalUser(data.user);

    req.user = {
      id: localUser.id,
      supabase_user_id: data.user.id,
      email: localUser.email || data.user.email,
      role: localUser.role || 'customer',
    };

    next();
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Supabase auth middleware error:', err.message || err);
    }
    return res.status(401).json({ success: false, message: 'Auth failed' });
  }
};

// Alias matching the requested verifyUser name
const verifyUser = authenticateToken;

module.exports = { authenticateToken, verifyUser };
