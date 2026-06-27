'use strict';

/**
 * Category Controller — Commerce Edition
 * ─────────────────────────────────────────────────────────────────────────────
 * BACKWARD COMPATIBLE: All existing response fields preserved.
 * ENRICHED: Every response now includes commerce metadata, SEO, nav flags.
 *
 * Routes:
 *   GET /api/categories                        → all categories (commerce-ready)
 *   GET /api/categories/featured               → featured categories
 *   GET /api/categories/:slug                  → single category landing page data
 *   GET /api/categories/:slug/products         → paginated products for a category
 *   GET /api/categories/:slug/subcategories    → subcategories of a category (lightweight)
 *   GET /api/subcategories                     → all subcategories (enriched)
 *   GET /api/subcategories/:slug               → single subcategory detail + parent
 *   GET /api/subcategories/:slug/products      → paginated products for a subcategory
 */

const pool = require('../config/db');
const { asyncHandler } = require('../utils/helpers.util');
const { OTHERS_SLUG, ensureOthersCategory } = require('../utils/category.util');

// ─── Shared SQL Fragments ────────────────────────────────────────────────────

const PRODUCT_JOIN = `
  LEFT JOIN products p ON (
    p.category_id = c.id
    OR (c.slug = '${OTHERS_SLUG}' AND p.category_id IS NULL)
  ) AND (p.status = 'active' OR p.status IS NULL)
`;

/** Full product SELECT for category/subcategory product listings */
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
    'id',        c.id,
    'name',      c.name,
    'slug',      c.slug,
    'image_url', c.image_url,
    'banner_url',c.banner_url
  ) AS category,
  CASE
    WHEN sc.id IS NOT NULL THEN
      json_build_object(
        'id',        sc.id,
        'name',      sc.name,
        'slug',      sc.slug,
        'image_url', sc.image_url
      )
    ELSE NULL
  END AS subcategory
`;

const PRODUCT_JOINS = `
  LEFT JOIN categories    c  ON c.id  = p.category_id
  LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
`;

/** Full commerce SELECT for category rows */
const CATEGORY_SELECT = `
  c.id,
  c.name,
  c.slug,
  c.description,
  c.short_description,
  c.image_url,
  c.banner_url,
  COALESCE(c.featured, false)            AS featured,
  c.display_order,
  c.seo_title,
  c.seo_description,
  COALESCE(c.homepage_visible, true)     AS homepage_visible,
  COALESCE(c.navigation_visible, true)   AS navigation_visible,
  c.created_at,
  c.updated_at
`;

/** Full commerce SELECT for subcategory rows */
const SUBCATEGORY_SELECT = `
  sc.id,
  sc.name,
  sc.slug,
  sc.description,
  sc.image_url,
  COALESCE(sc.featured, false)   AS featured,
  sc.display_order,
  sc.seo_title,
  sc.seo_description,
  sc.created_at,
  sc.updated_at
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

/**
 * Build breadcrumb array for category/subcategory context.
 */
function buildBreadcrumbs(category, subcategory = null) {
  const crumbs = [
    { label: 'Shop', href: '/shop' },
    { label: category.name, href: `/shop/${category.slug}` },
  ];
  if (subcategory) {
    crumbs.push({ label: subcategory.name, href: `/shop/${category.slug}/${subcategory.slug}` });
  }
  return crumbs;
}

/**
 * Build SEO object for a category or subcategory.
 */
function buildCategorySeo(entity, parentCategory = null) {
  const name     = entity.seo_title || entity.name;
  const desc     = entity.seo_description || entity.description || '';
  const prefix   = parentCategory ? `${parentCategory.name} → ` : '';
  return {
    title       : `${prefix}${name} | Mokshita Enterprises`,
    description : desc
      ? desc.slice(0, 160)
      : `Browse ${entity.name} at Mokshita Enterprises — handcrafted products from India.`,
    og_image    : entity.banner_url || entity.image_url || null,
  };
}

// ─── 1. GET /api/categories ──────────────────────────────────────────────────
/**
 * Returns all categories with full commerce metadata, product counts,
 * enriched subcategories, and SEO data.
 * ORDER: display_order DESC → admin controls storefront position; Others always last.
 */
const getAllCategories = asyncHandler(async (req, res) => {
  await ensureOthersCategory();

  const result = await pool.query(`
    SELECT
      ${CATEGORY_SELECT},
      COUNT(DISTINCT p.id)::int                                                    AS product_count,
      COUNT(DISTINCT p.id)::int                                                    AS total_products,
      COUNT(DISTINCT p.id) FILTER (WHERE p.featured = true)::int                  AS featured_count,
      (
        SELECT COALESCE(
          json_agg(
            jsonb_build_object(
              'id',            sc.id,
              'name',          sc.name,
              'slug',          sc.slug,
              'description',   sc.description,
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
    ${PRODUCT_JOIN}
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

// ─── 2. GET /api/categories/:slug ────────────────────────────────────────────
/**
 * Returns full commerce-ready category detail for a landing page.
 * Includes: metadata, banner, SEO, product counts, enriched subcategories.
 */
const getCategoryBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const catResult = await pool.query(`
    SELECT
      ${CATEGORY_SELECT},
      COUNT(DISTINCT p.id)::int                                                    AS product_count,
      COUNT(DISTINCT p.id)::int                                                    AS total_products,
      COUNT(DISTINCT p.id) FILTER (WHERE p.featured = true)::int                  AS featured_count,
      (
        SELECT COALESCE(
          json_agg(
            jsonb_build_object(
              'id',            sc.id,
              'name',          sc.name,
              'slug',          sc.slug,
              'description',   sc.description,
              'image_url',     sc.image_url,
              'featured',      COALESCE(sc.featured, false),
              'display_order', COALESCE(sc.display_order, 0),
              'seo_title',     sc.seo_title,
              'seo_description', sc.seo_description
            )
            ORDER BY COALESCE(sc.display_order, 0) DESC, sc.name ASC
          ),
          '[]'::json
        )
        FROM subcategories sc WHERE sc.category_id = c.id
      ) AS subcategories
    FROM categories c
    ${PRODUCT_JOIN}
    WHERE c.slug = $1
    GROUP BY c.id
  `, [slug]);

  if (catResult.rows.length === 0) {
    return res.status(404).json({ success: false, message: `Category "${slug}" not found.` });
  }

  const category = catResult.rows[0];
  const seo = buildCategorySeo(category);
  const breadcrumbs = buildBreadcrumbs(category);

  return res.json({
    success     : true,
    data        : {
      ...category,
      seo,
      breadcrumbs,
    },
  });
});

// ─── 3. GET /api/categories/:slug/products ───────────────────────────────────
/**
 * Paginated, filterable, sortable products for a category.
 * Query params: page, limit, sort, order, featured, min_price, max_price,
 *               in_stock, subcategory (slug)
 * Products include: category object, subcategory object, breadcrumbs.
 */
const getProductsByCategory = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { page, limit, offset } = getPagination(req.query);
  const safeSort = getSafeSort(req.query);

  // Resolve category
  const catRes = await pool.query(`
    SELECT id, name, slug, description, short_description,
           image_url, banner_url, display_order, seo_title, seo_description
    FROM categories WHERE slug = $1
  `, [slug]);
  if (catRes.rows.length === 0) {
    return res.status(404).json({ success: false, message: `Category "${slug}" not found.` });
  }
  const category = catRes.rows[0];

  // Build dynamic WHERE conditions
  const conditions = [
    category.slug === OTHERS_SLUG
      ? '(p.category_id = $1 OR p.category_id IS NULL)'
      : 'p.category_id = $1',
    "(p.status = 'active' OR p.status IS NULL)",
  ];
  const params = [category.id];
  let idx = 2;

  if (req.query.subcategory) {
    const scRes = await pool.query(
      'SELECT id FROM subcategories WHERE slug = $1 AND category_id = $2',
      [req.query.subcategory, category.id]
    );
    if (scRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Subcategory "${req.query.subcategory}" not found in category "${slug}".`,
      });
    }
    conditions.push(`p.subcategory_id = $${idx++}`);
    params.push(scRes.rows[0].id);
  }

  if (req.query.featured === 'true') conditions.push('p.featured = true');
  if (req.query.in_stock === 'true')  conditions.push('p.stock > 0');
  if (req.query.min_price) { conditions.push(`p.price >= $${idx++}`); params.push(parseFloat(req.query.min_price)); }
  if (req.query.max_price) { conditions.push(`p.price <= $${idx++}`); params.push(parseFloat(req.query.max_price)); }

  const WHERE = `WHERE ${conditions.join(' AND ')}`;

  const [countRes, productsRes] = await Promise.all([
    pool.query(
      `SELECT COUNT(DISTINCT p.id)::int AS total FROM products p ${PRODUCT_JOINS} ${WHERE}`,
      [...params]
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
  const breadcrumbs = buildBreadcrumbs(category);
  const seo = buildCategorySeo(category);

  // Inject breadcrumbs into each product
  const products = productsRes.rows.map(p => ({ ...p, breadcrumbs }));

  return res.json({
    success     : true,
    category    : { ...category, seo, breadcrumbs },
    total,
    page,
    limit,
    total_pages : Math.ceil(total / limit),
    products,
  });
});

// ─── 4. GET /api/categories/:slug/subcategories ──────────────────────────────
/**
 * Lightweight subcategory list for a category — used in nav dropdowns.
 */
const getSubcategoriesByCategory = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const catRes = await pool.query('SELECT id, name, slug FROM categories WHERE slug = $1', [slug]);
  if (catRes.rows.length === 0) {
    return res.status(404).json({ success: false, message: `Category "${slug}" not found.` });
  }
  const category = catRes.rows[0];

  const result = await pool.query(`
    SELECT
      ${SUBCATEGORY_SELECT},
      COUNT(p.id)::int AS product_count
    FROM subcategories sc
    LEFT JOIN products p ON p.subcategory_id = sc.id AND (p.status = 'active' OR p.status IS NULL)
    WHERE sc.category_id = $1
    GROUP BY sc.id
    ORDER BY COALESCE(sc.display_order, 0) DESC, sc.name ASC
  `, [category.id]);

  return res.json({
    success    : true,
    category   : { id: category.id, name: category.name, slug: category.slug },
    total      : result.rows.length,
    data       : result.rows,
  });
});

// ─── 5. GET /api/subcategories ───────────────────────────────────────────────
/**
 * All subcategories, enriched with parent category, product counts, SEO.
 */
const getAllSubcategories = asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT
      ${SUBCATEGORY_SELECT},
      COUNT(p.id)::int AS product_count,
      json_build_object(
        'id',   c.id,
        'name', c.name,
        'slug', c.slug,
        'image_url', c.image_url
      ) AS category
    FROM subcategories sc
    JOIN categories c ON c.id = sc.category_id
    LEFT JOIN products p ON p.subcategory_id = sc.id AND (p.status = 'active' OR p.status IS NULL)
    GROUP BY sc.id, c.id
    ORDER BY c.name ASC, COALESCE(sc.display_order, 0) DESC, sc.name ASC
  `);

  return res.json({
    success : true,
    total   : result.rows.length,
    data    : result.rows,
  });
});

// ─── 6. GET /api/subcategories/:slug ─────────────────────────────────────────
/**
 * Full subcategory detail with parent category and SEO.
 * Used for subcategory landing page headers.
 */
const getSubcategoryBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const result = await pool.query(`
    SELECT
      ${SUBCATEGORY_SELECT},
      COUNT(p.id)::int AS product_count,
      json_build_object(
        'id',            c.id,
        'name',          c.name,
        'slug',          c.slug,
        'image_url',     c.image_url,
        'banner_url',    c.banner_url,
        'display_order', c.display_order
      ) AS category
    FROM subcategories sc
    JOIN categories c ON c.id = sc.category_id
    LEFT JOIN products p ON p.subcategory_id = sc.id AND (p.status = 'active' OR p.status IS NULL)
    WHERE sc.slug = $1
    GROUP BY sc.id, c.id
  `, [slug]);

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: `Subcategory "${slug}" not found.` });
  }

  const subcategory = result.rows[0];
  const seo = buildCategorySeo(subcategory, subcategory.category);
  const breadcrumbs = buildBreadcrumbs(subcategory.category, subcategory);

  return res.json({
    success  : true,
    data     : {
      ...subcategory,
      seo,
      breadcrumbs,
    },
  });
});

// ─── 7. GET /api/subcategories/:slug/products ─────────────────────────────────
/**
 * Paginated products for a subcategory.
 * Includes: subcategory metadata, parent category, breadcrumbs, SEO.
 */
const getProductsBySubcategory = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { page, limit, offset } = getPagination(req.query);
  const safeSort = getSafeSort(req.query);

  // Resolve subcategory + parent
  const scRes = await pool.query(`
    SELECT
      ${SUBCATEGORY_SELECT},
      json_build_object(
        'id',        c.id,
        'name',      c.name,
        'slug',      c.slug,
        'image_url', c.image_url,
        'banner_url',c.banner_url
      ) AS category
    FROM subcategories sc
    JOIN categories c ON c.id = sc.category_id
    WHERE sc.slug = $1
  `, [slug]);

  if (scRes.rows.length === 0) {
    return res.status(404).json({ success: false, message: `Subcategory "${slug}" not found.` });
  }
  const subcategory = scRes.rows[0];
  const parentCategory = subcategory.category;

  const conditions = ['p.subcategory_id = $1', "(p.status = 'active' OR p.status IS NULL)"];
  const params = [subcategory.id];
  let idx = 2;

  if (req.query.featured === 'true') conditions.push('p.featured = true');
  if (req.query.in_stock === 'true')  conditions.push('p.stock > 0');
  if (req.query.min_price) { conditions.push(`p.price >= $${idx++}`); params.push(parseFloat(req.query.min_price)); }
  if (req.query.max_price) { conditions.push(`p.price <= $${idx++}`); params.push(parseFloat(req.query.max_price)); }

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

  const total      = countRes.rows[0].total;
  const breadcrumbs = buildBreadcrumbs(parentCategory, subcategory);
  const seo        = buildCategorySeo(subcategory, parentCategory);

  const products = productsRes.rows.map(p => ({ ...p, breadcrumbs }));

  return res.json({
    success     : true,
    subcategory : { ...subcategory, seo, breadcrumbs },
    total,
    page,
    limit,
    total_pages : Math.ceil(total / limit),
    products,
  });
});

// ─── 8. GET /api/categories/featured ─────────────────────────────────────────
/**
 * Featured categories for homepage spotlights.
 *
 * Priority (3-tier fallback — existing behaviour preserved + enhanced):
 *   1. homepage_visible=true + featured=true + has featured products
 *   2. featured=true + has any active products
 *   3. Any category with most products (absolute fallback)
 */
const getFeaturedCategories = asyncHandler(async (req, res) => {
  const limit = Math.min(12, Math.max(1, parseInt(req.query.limit) || 8));

  // Tier 1: homepage_visible + featured + has featured products
  let result = await pool.query(`
    SELECT
      ${CATEGORY_SELECT},
      COUNT(DISTINCT p.id)::int                                                  AS total_products,
      COUNT(DISTINCT p.id) FILTER (WHERE p.featured)::int                       AS featured_count,
      (
        SELECT COALESCE(
          json_agg(
            jsonb_build_object(
              'id',   sc.id,
              'name', sc.name,
              'slug', sc.slug
            )
            ORDER BY COALESCE(sc.display_order, 0) DESC, sc.name ASC
          ),
          '[]'::json
        )
        FROM subcategories sc WHERE sc.category_id = c.id
      ) AS subcategories
    FROM categories c
    INNER JOIN products p ON p.category_id = c.id
                         AND (p.status = 'active' OR p.status IS NULL)
                         AND p.featured = true
    WHERE COALESCE(c.featured, false) = true
      AND COALESCE(c.homepage_visible, true) = true
      AND c.slug <> '${OTHERS_SLUG}'
    GROUP BY c.id
    ORDER BY COALESCE(c.display_order, 0) DESC, featured_count DESC, c.name ASC
    LIMIT $1
  `, [limit]);

  let tier = 1;

  // Tier 2: featured=true + any products
  if (result.rows.length === 0) {
    tier = 2;
    result = await pool.query(`
      SELECT
        ${CATEGORY_SELECT},
        COUNT(DISTINCT p.id)::int                                                AS total_products,
        0::int                                                                   AS featured_count,
        (
          SELECT COALESCE(
            json_agg(
              jsonb_build_object(
                'id',   sc.id,
                'name', sc.name,
                'slug', sc.slug
              )
              ORDER BY COALESCE(sc.display_order, 0) DESC, sc.name ASC
            ),
            '[]'::json
          )
          FROM subcategories sc WHERE sc.category_id = c.id
        ) AS subcategories
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND (p.status = 'active' OR p.status IS NULL)
      WHERE COALESCE(c.featured, false) = true
        AND c.slug <> '${OTHERS_SLUG}'
      GROUP BY c.id
      HAVING COUNT(DISTINCT p.id) > 0
      ORDER BY COALESCE(c.display_order, 0) DESC, total_products DESC, c.name ASC
      LIMIT $1
    `, [limit]);
  }

  // Tier 3: any category with most products
  if (result.rows.length === 0) {
    tier = 3;
    result = await pool.query(`
      SELECT
        ${CATEGORY_SELECT},
        COUNT(DISTINCT p.id)::int AS total_products,
        0::int                    AS featured_count,
        '[]'::json                AS subcategories
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND (p.status = 'active' OR p.status IS NULL)
      WHERE c.slug <> '${OTHERS_SLUG}'
      GROUP BY c.id
      HAVING COUNT(DISTINCT p.id) > 0
      ORDER BY total_products DESC
      LIMIT $1
    `, [limit]);
  }

  return res.json({
    success     : true,
    total       : result.rows.length,
    data        : result.rows,
    is_fallback : tier > 1,
    tier,         // 1 = best, 2 = featured fallback, 3 = volume fallback
  });
});

module.exports = {
  getAllCategories,
  getCategoryBySlug,
  getProductsByCategory,
  getSubcategoriesByCategory,
  getAllSubcategories,
  getSubcategoryBySlug,
  getProductsBySubcategory,
  getFeaturedCategories,
};
