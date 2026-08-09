'use strict';

const { createClient } = require('@supabase/supabase-js');
const pool = require('../config/db');
const { asyncHandler } = require('../utils/helpers.util');

const normalizeEmail = (email) => (email || '').trim().toLowerCase();

const normalizeSupabaseUrl = (value) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  let projectId = null;
  const dbMatch = trimmed.match(/(?:postgres(?:ql)?):\/\/[^@]+@(?:db\.)?([a-z0-9-]+)\.supabase\.co/i);
  if (dbMatch) projectId = dbMatch[1];

  const poolerMatch = trimmed.match(/(?:postgres(?:ql)?):\/\/[^.]+\.([a-z0-9-]+):[^@]+@.*pooler\.supabase\.com/i);
  if (poolerMatch) projectId = poolerMatch[1];

  if (projectId) return `https://${projectId}.supabase.co`;

  return trimmed;
};

const getSupabaseClient = (req) => {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const key = (process.env.SUPABASE_ANON_KEY || '').trim();

  if (!url || !key) {
    throw new Error('Supabase auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
  }

  const authHeader = req && req.headers && req.headers.authorization;
  const globalOptions = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  };
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    globalOptions.global = {
      headers: {
        Authorization: authHeader
      }
    };
  }

  return createClient(url, key, globalOptions);
};

const buildUserPayload = (user) => ({
  id: user.id,
  email: user.email,
  full_name: user.full_name,
  role: user.role,
});

const ensureLocalUser = async ({ supabaseUserId, email, fullName, phone, role = 'customer' }) => {
  const normalizedEmail = normalizeEmail(email);

  if (!supabaseUserId) {
    throw new Error('Supabase user ID is required to link the local account.');
  }

  const existingBySupabaseId = await pool.query(
    'SELECT id, email, role, full_name, phone, supabase_user_id FROM users WHERE supabase_user_id = $1',
    [supabaseUserId]
  );

  if (existingBySupabaseId.rows.length > 0) {
    const current = existingBySupabaseId.rows[0];
    const updated = await pool.query(
      `UPDATE users
       SET email = COALESCE($1, email),
           full_name = COALESCE($2, full_name),
           phone = COALESCE($3, phone),
           role = COALESCE($4, role)
       WHERE id = $5
       RETURNING id, email, full_name, phone, role, created_at, supabase_user_id`,
      [normalizedEmail, fullName ?? current.full_name, phone ?? current.phone, role ?? current.role, current.id]
    );
    return updated.rows[0];
  }

  const existingByEmail = await pool.query(
    'SELECT id, email, role, full_name, phone, supabase_user_id FROM users WHERE email = $1',
    [normalizedEmail]
  );

  if (existingByEmail.rows.length > 0) {
    const current = existingByEmail.rows[0];

    if (current.supabase_user_id && current.supabase_user_id !== supabaseUserId) {
      throw new Error('Local user is already linked to a different Supabase account.');
    }

    const updated = await pool.query(
      `UPDATE users
       SET supabase_user_id = $1,
           full_name = COALESCE($2, full_name),
           phone = COALESCE($3, phone),
           role = COALESCE($4, role)
       WHERE id = $5
       RETURNING id, email, full_name, phone, role, created_at, supabase_user_id`,
      [supabaseUserId, fullName ?? current.full_name, phone ?? current.phone, role ?? current.role, current.id]
    );
    return updated.rows[0];
  }

  const created = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, phone, role, supabase_user_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, email, full_name, phone, role, created_at, supabase_user_id`,
    [normalizedEmail, '__supabase_auth__', fullName || null, phone || null, role, supabaseUserId]
  );

  return created.rows[0];
};

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return res.status(422).json({ success: false, message: 'Email is required.' });
  }

  try {
    const supabase = getSupabaseClient(req);
    const redirectTo = process.env.SUPABASE_RESET_REDIRECT_URL || process.env.FRONTEND_URL || null;
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, redirectTo ? { redirectTo } : undefined);

    if (error) {
      console.error('Supabase forgot password error:', error.message || error);
    }

    return res.json({
      success: true,
      message: 'If an account exists, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Supabase error:', error.message || error);

    return res.json({
      success: true,
      message: 'If an account exists, a password reset link has been sent.',
    });
  }
});

const resetPassword = asyncHandler(async (req, res) => {
  const { password, access_token, refresh_token, token_hash, type } = req.body;

  if (!password || password.length < 8) {
    return res.status(422).json({ success: false, message: 'Password must be at least 8 characters.' });
  }

  try {
    const supabase = getSupabaseClient(req);

    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token });
    } else if (token_hash) {
      await supabase.auth.verifyOtp({ token_hash, type: type || 'recovery' });
    } else {
      return res.status(400).json({ success: false, message: 'Reset token is required.' });
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      if (error.message?.toLowerCase().includes('same password')) {
        return res.status(409).json({ success: false, message: 'Please choose a different password.' });
      }
      throw error;
    }

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Supabase reset password error:', error.message || error);

    return res.status(400).json({ success: false, message: 'Unable to reset password.' });
  }
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { email, token_hash, type } = req.body;
  const normalizedEmail = normalizeEmail(email);

  try {
    const supabase = getSupabaseClient(req);

    if (token_hash) {
      const { error } = await supabase.auth.verifyOtp({ token_hash, type: type || 'signup' });
      if (error) {
        throw error;
      }

      return res.json({ success: true, message: 'Email verified successfully.' });
    }

    if (!normalizedEmail) {
      return res.status(422).json({ success: false, message: 'Email is required.' });
    }

    const { error } = await supabase.auth.resend({ type: 'signup', email: normalizedEmail });
    if (error) {
      throw error;
    }

    return res.json({ success: true, message: 'If an account exists, a verification email has been sent.' });
  } catch (error) {
    console.error('Supabase verify email error:', error.message || error);

    return res.json({ success: true, message: 'If an account exists, a verification email has been sent.' });
  }
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────
const register = asyncHandler(async (req, res) => {
  const { email, password, full_name, phone, name } = req.body;
  const resolvedFullName = full_name || name || null;
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    return res.status(422).json({ success: false, message: 'Email and password are required.' });
  }

  try {
    const supabase = getSupabaseClient(req);
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: resolvedFullName || '',
        },
      },
    });

    if (error) {
      if (error.message?.toLowerCase().includes('already registered') || error.message?.toLowerCase().includes('user already')) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
      }
      throw error;
    }

    const localUser = await ensureLocalUser({
      supabaseUserId: data?.user?.id,
      email: normalizedEmail,
      fullName: resolvedFullName,
      phone,
      role: 'customer',
    });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully. Please verify your email before logging in.',
      token: null,
      user: buildUserPayload(localUser),
      data: { user: buildUserPayload(localUser), token: null },
    });
  } catch (error) {
    console.error('Supabase register error:', error.message || error);
    return res.status(500).json({ success: false, message: 'An error occurred during registration.' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    return res.status(422).json({ success: false, message: 'Email and password are required.' });
  }

  try {
    const supabase = getSupabaseClient(req);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      if (error.message?.toLowerCase().includes('email not confirmed') || error.message?.toLowerCase().includes('confirm')) {
        return res.status(403).json({ success: false, message: 'Please verify your email before logging in.' });
      }

      if (error.message?.toLowerCase().includes('invalid login credentials') || error.message?.toLowerCase().includes('invalid email')) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }

      throw error;
    }

    const session = data?.session;
    const authUser = data?.user;

    if (!session?.access_token) {
      return res.status(401).json({ success: false, message: 'Authentication failed.' });
    }

    const localUser = await ensureLocalUser({
      supabaseUserId: authUser?.id,
      email: normalizedEmail,
      fullName: authUser?.user_metadata?.full_name || null,
      phone: null,
      role: 'customer',
    });

    return res.json({
      success: true,
      message: 'Logged in successfully.',
      token: session.access_token,
      user: buildUserPayload(localUser),
      data: { user: buildUserPayload(localUser), token: session.access_token },
    });
  } catch (error) {
    console.error('Supabase login error:', error.message || error);
    return res.status(500).json({ success: false, message: 'An error occurred during login.' });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
const logout = asyncHandler(async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);
    await supabase.auth.signOut();
  } catch (error) {
    console.error('Supabase logout error:', error.message || error);
  }

  return res.json({
    success: true,
    message: 'Logged out successfully.'
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
const getMe = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const userEmail = req.user?.email;

  let result;

  if (userId) {
    result = await pool.query(
      `SELECT id, email, role, full_name, phone, address_line, city, state, pincode, country, created_at
       FROM users WHERE id = $1`,
      [userId]
    );
  } else if (userEmail) {
    result = await pool.query(
      `SELECT id, email, role, full_name, phone, address_line, city, state, pincode, country, created_at
       FROM users WHERE email = $1`,
      [normalizeEmail(userEmail)]
    );
  } else {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  return res.json({ success: true, user: result.rows[0] });
});

// ─── PUT /api/auth/profile ────────────────────────────────────────────────────
const updateProfile = asyncHandler(async (req, res) => {
  const { full_name, phone, address_line, city, state, pincode, country } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const result = await pool.query(
    `UPDATE users
     SET full_name = COALESCE($1, full_name),
         phone = COALESCE($2, phone),
         address_line = COALESCE($3, address_line),
         city = COALESCE($4, city),
         state = COALESCE($5, state),
         pincode = COALESCE($6, pincode),
         country = COALESCE($7, country)
     WHERE id = $8
     RETURNING id, email, role, full_name, phone, address_line, city, state, pincode, country`,
    [full_name, phone, address_line, city, state, pincode, country, userId]
  );

  return res.json({ success: true, message: 'Profile updated.', user: result.rows[0] });
});

module.exports = { register, login, logout, getMe, updateProfile, forgotPassword, resetPassword, verifyEmail };
