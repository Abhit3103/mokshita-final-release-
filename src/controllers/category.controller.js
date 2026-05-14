'use strict';

/**
 * Category Controller
 * ────────────────────────────────────────────────────────────────────────────
 * Handles all category + subcategory API logic.
 * Uses efficient JOINs to avoid N+1 patterns.
 * Backward-compatible: never removes old fields from product responses.
 */

const pool = require('../config/db');
const { asyncHandler } = require('../utils/helpers.util');

// ─── Shared product SELECT fragment ─────────────────────────────────────────
// Every product response includes the same rich field set.
const PRODUCT_SELECT = `
  p.id,
  p.name,
  p.slug,
  p.sku,
  p.price,
  p.compare_price,
  p.stock,
  p.description,
  p.short_description,
  p.image_url,
  p.material,
  p.region,
  p.dimensions,
  p.tags,
  p.featured,
  p.status,
  p.created_at,
  -- Preserve legacy string fields for backward compatibility
  p.category        AS category_name_legacy,
  p.subcategory     AS subcategory_name_legacy,
  -- Relational category objects
  json_build_object(
    'id',   c.id,
    'name', c.name,
    'slug', c.slug
  ) AS category,
  CASE
    WHEN sc.id IS NOT NULL THEN
      json_build_object(
        'id',   sc.id,
        'name', sc.name,
        'slug', sc.slug
      )
    ELSE NULL
  END AS subcategory
`;

const PRODUCT_JOINS = `
  LEFT JOIN categories    c  ON c.id  = p.category_id
  LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
`;

// ─── Pagination helper ───────────────────────────────────────────────────────
function getPagination(query) {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 12));
  return { page, limit, offset: (page - 1) * limit };
}

// ─── Sort whitelist ──────────────────────────────────────────────────────────
const ALLOWED_SORT = {
  created_at : 'p.created_at',
  price      : 'p.price',
  name       : 'p.name',
  stock      : 'p.stock',
};

function getSafeSort(query) {
  const col   = ALLOWED_SORT[query.sort] || 'p.created_at';
  const order = (query.order || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return `${col} ${order}`;
}

// ─── 1. GET /api/categories ──────────────────────────────────────────────────
/**
 * Returns all categories with product counts and their subcategories.
 */
const getAllCategories = asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT
      c.id,
      c.name,
      c.slug,
      c.description,
      c.image_url,
      c.created_at,
      COUNT(DISTINCT p.id)::int           AS product_count,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id',          sc.id,
            'name',        sc.name,
            'slug',        sc.slug,
            'description', sc.description
          )
        ) FILTER (WHERE sc.id IS NOT NULL),
        '[]'::json
      )                                   AS subcategories
    FROM categories c
    LEFT JOIN products    p  ON p.category_id    = c.id
                             AND p.status = 'active'
    LEFT JOIN subcategories sc ON sc.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name ASC
  `);

  return res.json({
    success : true,
    total   : result.rows.length,
    data    : result.rows,
  });
});

// ─── 2. GET /api/categories/:slug ────────────────────────────────────────────
/**
 * Returns a single category with its subcategories and product count.
 */
const getCategoryBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const catResult = await pool.query(`
    SELECT
      c.id,
      c.name,
      c.slug,
      c.description,
      c.image_url,
      c.created_at,
      COUNT(DISTINCT p.id)::int           AS product_count,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id',          sc.id,
            'name',        sc.name,
            'slug',        sc.slug,
            'description', sc.description
          )
        ) FILTER (WHERE sc.id IS NOT NULL),
        '[]'::json
      )                                   AS subcategories
    FROM categories c
    LEFT JOIN products      p  ON p.category_id    = c.id
                               AND p.status = 'active'
    LEFT JOIN subcategories sc ON sc.category_id = c.id
    WHERE c.slug = $1
    GROUP BY c.id
  `, [slug]);

  if (catResult.rows.length === 0) {
    return res.status(404).json({ success: false, message: `Category "${slug}" not found.` });
  }

  return res.json({ success: true, data: catResult.rows[0] });
});

// ─── 3. GET /api/categories/:slug/products ───────────────────────────────────
/**
 * Returns paginated, filtered, sortable products for a category.
 * Query params: page, limit, sort, order, featured, min_price, max_price,
 *               in_stock, subcategory (slug)
 */
const getProductsByCategory = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { page, limit, offset } = getPagination(req.query);
  const safeSort = getSafeSort(req.query);

  // Resolve category
  const catRes = await pool.query('SELECT id, name, slug, description, image_url FROM categories WHERE slug = $1', [slug]);
  if (catRes.rows.length === 0) {
    return res.status(404).json({ success: false, message: `Category "${slug}" not found.` });
  }
  const category = catRes.rows[0];

  // Build dynamic WHERE conditions
  const conditions = ['p.category_id = $1', "p.status = 'active'"];
  const params = [category.id];
  let idx = 2;

  if (req.query.subcategory) {
    // Filter by subcategory slug
    const scRes = await pool.query(
      'SELECT id FROM subcategories WHERE slug = $1 AND category_id = $2',
      [req.query.subcategory, category.id]
    );
    if (scRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: `Subcategory "${req.query.subcategory}" not found in this category.` });
    }
    conditions.push(`p.subcategory_id = $${idx++}`);
    params.push(scRes.rows[0].id);
  }

  if (req.query.featured === 'true') {
    conditions.push(`p.featured = true`);
  }
  if (req.query.in_stock === 'true') {
    conditions.push(`p.stock > 0`);
  }
  if (req.query.min_price) {
    conditions.push(`p.price >= $${idx++}`);
    params.push(parseFloat(req.query.min_price));
  }
  if (req.query.max_price) {
    conditions.push(`p.price <= $${idx++}`);
    params.push(parseFloat(req.query.max_price));
  }

  const WHERE = `WHERE ${conditions.join(' AND ')}`;

  // Run count + products in parallel
  const countParams = [...params];
  const productParams = [...params, limit, offset];

  const [countRes, productsRes] = await Promise.all([
    pool.query(
      `SELECT COUNT(DISTINCT p.id)::int AS total FROM products p ${PRODUCT_JOINS} ${WHERE}`,
      countParams
    ),
    pool.query(
      `SELECT ${PRODUCT_SELECT}
       FROM products p
       ${PRODUCT_JOINS}
       ${WHERE}
       ORDER BY ${safeSort}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      productParams
    ),
  ]);

  const total = countRes.rows[0].total;

  return res.json({
    success  : true,
    category,
    total,
    page,
    limit,
    total_pages : Math.ceil(total / limit),
    products : productsRes.rows,
  });
});

// ─── 4. GET /api/subcategories ───────────────────────────────────────────────
/**
 * Returns all subcategories, grouped under their parent category.
 */
const getAllSubcategories = asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT
      sc.id,
      sc.name,
      sc.slug,
      sc.description,
      sc.created_at,
      COUNT(p.id)::int AS product_count,
      json_build_object(
        'id',   c.id,
        'name', c.name,
        'slug', c.slug
      ) AS category
    FROM subcategories sc
    JOIN categories c ON c.id = sc.category_id
    LEFT JOIN products p ON p.subcategory_id = sc.id AND p.status = 'active'
    GROUP BY sc.id, c.id
    ORDER BY c.name ASC, sc.name ASC
  `);

  return res.json({
    success : true,
    total   : result.rows.length,
    data    : result.rows,
  });
});

// ─── 5. GET /api/subcategories/:slug/products ────────────────────────────────
/**
 * Returns paginated products for a specific subcategory.
 */
const getProductsBySubcategory = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { page, limit, offset } = getPagination(req.query);
  const safeSort = getSafeSort(req.query);

  // Resolve subcategory + parent category
  const scRes = await pool.query(`
    SELECT sc.id, sc.name, sc.slug, sc.description,
           json_build_object('id', c.id, 'name', c.name, 'slug', c.slug) AS category
    FROM subcategories sc
    JOIN categories c ON c.id = sc.category_id
    WHERE sc.slug = $1
  `, [slug]);

  if (scRes.rows.length === 0) {
    return res.status(404).json({ success: false, message: `Subcategory "${slug}" not found.` });
  }
  const subcategory = scRes.rows[0];

  const conditions = ['p.subcategory_id = $1', "p.status = 'active'"];
  const params = [subcategory.id];
  let idx = 2;

  if (req.query.featured === 'true') {
    conditions.push('p.featured = true');
  }
  if (req.query.in_stock === 'true') {
    conditions.push('p.stock > 0');
  }
  if (req.query.min_price) {
    conditions.push(`p.price >= $${idx++}`);
    params.push(parseFloat(req.query.min_price));
  }
  if (req.query.max_price) {
    conditions.push(`p.price <= $${idx++}`);
    params.push(parseFloat(req.query.max_price));
  }

  const WHERE = `WHERE ${conditions.join(' AND ')}`;

  const [countRes, productsRes] = await Promise.all([
    pool.query(
      `SELECT COUNT(p.id)::int AS total FROM products p ${PRODUCT_JOINS} ${WHERE}`,
      params
    ),
    pool.query(
      `SELECT ${PRODUCT_SELECT}
       FROM products p
       ${PRODUCT_JOINS}
       ${WHERE}
       ORDER BY ${safeSort}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    ),
  ]);

  const total = countRes.rows[0].total;

  return res.json({
    success     : true,
    subcategory,
    total,
    page,
    limit,
    total_pages : Math.ceil(total / limit),
    products    : productsRes.rows,
  });
});

// ─── GET /api/categories/featured ──────────────────────────────────────────────────────
// Returns categories that have at least one featured active product.
// Includes subcategory list and featured product count.
const getFeaturedCategories = asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT
      c.id,
      c.name,
      c.slug,
      c.description,
      c.image_url,
      COUNT(DISTINCT p.id)::int                       AS total_products,
      COUNT(DISTINCT p.id) FILTER (WHERE p.featured)::int AS featured_count,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id',   sc.id,
            'name', sc.name,
            'slug', sc.slug
          )
        ) FILTER (WHERE sc.id IS NOT NULL),
        '[]'::json
      )                                               AS subcategories
    FROM categories c
    INNER JOIN products p ON p.category_id = c.id
                         AND p.status = 'active'
                         AND p.featured = true
    LEFT JOIN subcategories sc ON sc.category_id = c.id
    GROUP BY c.id
    ORDER BY featured_count DESC, c.name ASC
  `);

  return res.json({
    success : true,
    total   : result.rows.length,
    data    : result.rows,
  });
});

module.exports = {
  getAllCategories,
  getCategoryBySlug,
  getProductsByCategory,
  getAllSubcategories,
  getProductsBySubcategory,
  getFeaturedCategories,
};
