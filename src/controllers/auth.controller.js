'use strict';

const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { signToken } = require('../utils/jwt.util');
const { asyncHandler } = require('../utils/helpers.util');

// ─── POST /api/auth/register ──────────────────────────────────────────────────
const register = asyncHandler(async (req, res) => {
  const { email, password, full_name, phone, name } = req.body;
  const resolvedFullName = full_name || name || null;

  // Check if user already exists
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
  }

  // Hash password (bcrypt cost factor 12)
  const password_hash = await bcrypt.hash(password, 12);

  const result = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, phone, role)
     VALUES ($1, $2, $3, $4, 'customer')
     RETURNING id, email, full_name, phone, role, created_at`,
    [email.toLowerCase(), password_hash, resolvedFullName, phone || null]
  );

  const user = result.rows[0];
  const token = signToken({ id: user.id, email: user.email, role: user.role });

  return res.status(201).json({
    success: true,
    message: 'Account created successfully.',
    token,
    user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
    data: { user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role }, token },
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  const user = result.rows[0];

  // Use constant-time comparison to avoid timing attacks
  const isMatch = user ? await bcrypt.compare(password, user.password_hash) : false;

  if (!user || !isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role });

  return res.json({
    success: true,
    message: 'Logged in successfully.',
    token,
    user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
    data: { user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role }, token },
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
const getMe = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT id, email, role, full_name, phone, address_line, city, state, pincode, country, created_at
     FROM users WHERE id = $1`,
    [req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  return res.json({ success: true, user: result.rows[0] });
});

// ─── PUT /api/auth/profile ────────────────────────────────────────────────────
const updateProfile = asyncHandler(async (req, res) => {
  const { full_name, phone, address_line, city, state, pincode, country } = req.body;

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
    [full_name, phone, address_line, city, state, pincode, country, req.user.id]
  );

  return res.json({ success: true, message: 'Profile updated.', user: result.rows[0] });
});

module.exports = { register, login, getMe, updateProfile };
