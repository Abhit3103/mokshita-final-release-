'use strict';

const pool        = require('../config/db');
const { asyncHandler } = require('../utils/helpers.util');

/* ─── POST /api/leads ────────────────────────────────────────────────────────
   Public endpoint — no auth required.
   Accepts contact form submissions and stores them in the leads table.
   Rate limiting is handled by the global API limiter in app.js.           */
const createLead = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    phone    = null,
    interest = null,
    item     = null,
    message,
    source   = 'contact_form',
  } = req.body;

  /* ── Basic field validation ── */
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Full name is required (min 2 characters).' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'A valid email address is required.' });
  }
  if (!message || typeof message !== 'string' || message.trim().length < 5) {
    return res.status(400).json({ success: false, message: 'Message is required (min 5 characters).' });
  }

  /* ── Honeypot check (bot trap field) ── */
  if (req.body['contact-bot-check']) {
    // Silently accept — don't alert the bot
    return res.status(201).json({ success: true, message: 'Lead received.' });
  }

  /* ── Insert lead ── */
  const result = await pool.query(
    `INSERT INTO leads (name, email, phone, interest, item, message, source, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING id, name, email, created_at`,
    [
      name.trim(),
      email.trim().toLowerCase(),
      phone   ? phone.trim()    : null,
      interest ? interest.trim() : null,
      item    ? item.trim()     : null,
      message.trim(),
      source,
    ]
  );

  console.log(`[Leads] New lead from ${email} — interest: ${interest || 'general'}`);

  return res.status(201).json({
    success : true,
    message : 'Thank you! We\'ll be in touch very soon.',
    lead_id : result.rows[0].id,
  });
});

/* ─── GET /api/leads (Admin only) ────────────────────────────────────────────
   Returns paginated leads. Protected by authenticateToken + isAdmin.      */
const getLeads = asyncHandler(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  const [leadsRes, countRes] = await Promise.all([
    pool.query(
      `SELECT id, name, email, phone, interest, item, message, source, created_at
       FROM leads
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    pool.query('SELECT COUNT(*) FROM leads'),
  ]);

  return res.json({
    success     : true,
    total       : parseInt(countRes.rows[0].count),
    page,
    limit,
    total_pages : Math.ceil(countRes.rows[0].count / limit),
    leads       : leadsRes.rows,
  });
});

module.exports = { createLead, getLeads };
