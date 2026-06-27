'use strict';

/**
 * Navigation Controller
 * ─────────────────────────────────────────────────────────────────────────────
 * Optimized, lightweight endpoints for storefront navigation.
 * Returns only the fields needed for rendering nav menus and homepage cards.
 * Heavy product queries are NOT included here — use category endpoints for that.
 *
 * Routes (mounted at /api/navigation):
 *   GET /api/navigation           → full desktop nav tree
 *   GET /api/navigation/homepage  → homepage category cards
 *   GET /api/navigation/mobile    → flat mobile-optimized nav
 */

const pool = require('../config/db');
const { asyncHandler } = require('../utils/helpers.util');
const { OTHERS_SLUG, ensureOthersCategory } = require('../utils/category.util');

// ─── GET /api/navigation ─────────────────────────────────────────────────────
/**
 * Full desktop navigation tree.
 * Only returns categories with navigation_visible=true.
 * Subcategories nested inside each category.
 * Ordered by display_order DESC — admin controls the sequence.
 */
const getNavigation = asyncHandler(async (req, res) => {
  await ensureOthersCategory();

  const result = await pool.query(`
    SELECT
      c.id,
      c.name,
      c.slug,
      c.image_url,
      c.banner_url,
      COALESCE(c.display_order, 0)       AS display_order,
      COUNT(DISTINCT p.id)::int          AS product_count,
      (
        SELECT COALESCE(
          json_agg(
            jsonb_build_object(
              'id',            sc.id,
              'name',          sc.name,
              'slug',          sc.slug,
              'image_url',     sc.image_url,
              'featured',      COALESCE(sc.featured, false),
              'display_order', COALESCE(sc.display_order, 0)
            )
            ORDER BY COALESCE(sc.display_order, 0) DESC, sc.name ASC
          ),
          '[]'::json
        )
        FROM subcategories sc WHERE sc.category_id = c.id
      ) AS subcategories
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id AND (p.status = 'active' OR p.status IS NULL)
    WHERE COALESCE(c.navigation_visible, true) = true
    GROUP BY c.id
    ORDER BY
      CASE WHEN c.slug = '${OTHERS_SLUG}' THEN 1 ELSE 0 END,
      COALESCE(c.display_order, 0) DESC,
      c.name ASC
  `);

  return res.json({
    success : true,
    total   : result.rows.length,
    data    : result.rows,
  });
});

// ─── GET /api/navigation/homepage ────────────────────────────────────────────
/**
 * Homepage category cards — optimized for first-load speed.
 * Only returns homepage_visible=true categories.
 * Minimal payload: id, name, slug, image_url, banner_url, product_count.
 * Ordered by display_order DESC then name.
 */
const getHomepageCategories = asyncHandler(async (req, res) => {
  await ensureOthersCategory();

  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 12));

  const result = await pool.query(`
    SELECT
      c.id,
      c.name,
      c.slug,
      c.short_description,
      c.image_url,
      c.banner_url,
      COALESCE(c.featured, false)        AS featured,
      COALESCE(c.display_order, 0)       AS display_order,
      COUNT(DISTINCT p.id)::int          AS product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id AND (p.status = 'active' OR p.status IS NULL)
    WHERE COALESCE(c.homepage_visible, true) = true
      AND c.slug <> '${OTHERS_SLUG}'
    GROUP BY c.id
    ORDER BY
      COALESCE(c.display_order, 0) DESC,
      COALESCE(c.featured, false) DESC,
      c.name ASC
    LIMIT $1
  `, [limit]);

  return res.json({
    success : true,
    total   : result.rows.length,
    data    : result.rows,
  });
});

// ─── GET /api/navigation/mobile ──────────────────────────────────────────────
/**
 * Mobile-optimized flat navigation list.
 * Includes all navigation_visible categories.
 * Subcategory names as flat strings for simple mobile accordion rendering.
 */
const getMobileNavigation = asyncHandler(async (req, res) => {
  await ensureOthersCategory();

  const result = await pool.query(`
    SELECT
      c.id,
      c.name,
      c.slug,
      c.image_url,
      COALESCE(c.display_order, 0) AS display_order,
      COALESCE(
        json_agg(
          jsonb_build_object(
            'id',   sc.id,
            'name', sc.name,
            'slug', sc.slug
          )
          ORDER BY COALESCE(sc.display_order, 0) DESC, sc.name ASC
        ) FILTER (WHERE sc.id IS NOT NULL),
        '[]'::json
      ) AS subcategories
    FROM categories c
    LEFT JOIN subcategories sc ON sc.category_id = c.id
    WHERE COALESCE(c.navigation_visible, true) = true
    GROUP BY c.id
    ORDER BY
      CASE WHEN c.slug = '${OTHERS_SLUG}' THEN 1 ELSE 0 END,
      COALESCE(c.display_order, 0) DESC,
      c.name ASC
  `);

  return res.json({
    success : true,
    total   : result.rows.length,
    data    : result.rows,
  });
});

module.exports = {
  getNavigation,
  getHomepageCategories,
  getMobileNavigation,
};
