'use strict';

/**
 * CMS Content Controller
 * ─────────────────────────────────────────────────────────────────────────────
 * All existing routes preserved byte-for-byte.
 * New named-section routes added below.
 *
 * Public routes:
 *   GET /api/content                  → all sections as key→value map
 *   GET /api/content/:key             → single section by key
 *   GET /api/content/homepage         → homepage composite (hero+stats+benefits)
 *   GET /api/content/brand            → brand identity + founder quote
 *   GET /api/content/about            → about brand section
 *   GET /api/content/footer           → footer links + copyright
 *
 * Admin routes:
 *   PUT /api/content/:key             → upsert/update a section by key
 */

const pool = require('../config/db');
const { asyncHandler } = require('../utils/helpers.util');

// ─── Helper: fetch one section by key ────────────────────────────────────────
async function fetchSection(key) {
  const r = await pool.query(
    'SELECT section_key, content, last_updated FROM site_content WHERE section_key = $1',
    [key]
  );
  return r.rows[0] || null;
}

// ─── Helper: fetch multiple sections in one query ────────────────────────────
async function fetchSections(keys) {
  const r = await pool.query(
    'SELECT section_key, content, last_updated FROM site_content WHERE section_key = ANY($1)',
    [keys]
  );
  const map = {};
  r.rows.forEach(row => { map[row.section_key] = row.content; });
  return map;
}

// ─── LEGACY: GET /api/content ─────────────────────────────────────────────────
// Unchanged — returns all sections as a flat dictionary.
const getAllContent = asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT section_key, content FROM site_content ORDER BY section_key');
  const contentMap = {};
  result.rows.forEach(row => { contentMap[row.section_key] = row.content; });
  return res.json({ success: true, data: contentMap });
});

// ─── LEGACY: GET /api/content/:key ───────────────────────────────────────────
// Unchanged — returns single section. (Named routes registered before this.)
const getContentByKey = asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT content FROM site_content WHERE section_key = $1',
    [req.params.key]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Content section not found.' });
  }
  return res.json({ success: true, data: result.rows[0].content, content: result.rows[0].content });
});

// ─── GET /api/content/homepage ────────────────────────────────────────────────
// Composite — hero + stats + benefits + layout in one response, reducing frontend round-trips.
const getHomepageContent = asyncHandler(async (req, res) => {
  const data = await fetchSections(['homepage_hero', 'homepage_stats', 'homepage_benefits', 'homepage_layout']);

  // Graceful fallback — if a section doesn't exist yet, return empty object
  return res.json({
    success : true,
    data    : {
      hero    : data['homepage_hero']     || {},
      stats   : data['homepage_stats']    || {},
      benefits: data['homepage_benefits'] || {},
      layout  : data['homepage_layout']   || ['hero', 'trust-strip', 'explore-cards', 'artisan-shop', 'experiences', 'our-story', 'testimonials', 'newsletter'],
    },
  });
});

// ─── GET /api/content/brand ───────────────────────────────────────────────────
// Brand identity: statistics + founder quote + core benefits.
const getBrandContent = asyncHandler(async (req, res) => {
  const data = await fetchSections(['brand_statistics', 'founder_quote']);

  return res.json({
    success : true,
    data    : {
      statistics    : data['brand_statistics'] || {},
      founder_quote : data['founder_quote']    || {},
    },
  });
});

// ─── GET /api/content/about ───────────────────────────────────────────────────
const getAboutContent = asyncHandler(async (req, res) => {
  const section = await fetchSection('about_brand');
  if (!section) {
    return res.status(404).json({ success: false, message: 'About content not found.' });
  }
  return res.json({ success: true, data: section.content });
});

// ─── GET /api/content/footer ──────────────────────────────────────────────────
const getFooterContent = asyncHandler(async (req, res) => {
  const section = await fetchSection('footer_links');
  if (!section) {
    return res.status(404).json({ success: false, message: 'Footer content not found.' });
  }
  return res.json({ success: true, data: section.content });
});

// ─── PUT /api/content/:key (Admin) ───────────────────────────────────────────
// Upserts a section by key. Admin-only (enforced in routes).
const upsertContent = asyncHandler(async (req, res) => {
  const { key } = req.params;
  const { content } = req.body;

  if (!content || typeof content !== 'object') {
    return res.status(400).json({ success: false, message: 'content must be a JSON object.' });
  }

  const result = await pool.query(
    `INSERT INTO site_content (section_key, content, last_updated)
     VALUES ($1, $2, NOW())
     ON CONFLICT (section_key)
     DO UPDATE SET content = EXCLUDED.content, last_updated = NOW()
     RETURNING section_key, last_updated`,
    [key, JSON.stringify(content)]
  );

  return res.json({
    success      : true,
    message      : `Section "${key}" saved.`,
    section_key  : result.rows[0].section_key,
    last_updated : result.rows[0].last_updated,
  });
});

module.exports = {
  getAllContent,
  getContentByKey,
  getHomepageContent,
  getBrandContent,
  getAboutContent,
  getFooterContent,
  upsertContent,
};
