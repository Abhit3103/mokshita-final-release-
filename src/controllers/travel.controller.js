'use strict';

const pool = require('../config/db');
const { asyncHandler } = require('../utils/helpers.util');

// ─── GET /api/travel-packages ──────────────────────────────────────────────────
const getAllTravelPackages = asyncHandler(async (req, res) => {
  const result = await pool.query("SELECT * FROM travel_packages WHERE status = 'active' ORDER BY created_at ASC");
  return res.json({ success: true, packages: result.rows });
});

// ─── GET /api/travel-packages/:slug ────────────────────────────────────────────
const getTravelPackageBySlug = asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM travel_packages WHERE slug = $1', [req.params.slug]);
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Travel package not found.' });
  }
  return res.json({ success: true, package: result.rows[0] });
});

module.exports = { getAllTravelPackages, getTravelPackageBySlug };
