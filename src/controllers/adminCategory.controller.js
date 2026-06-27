'use strict';

/**
 * Admin Category Controller — Commerce Edition
 * ─────────────────────────────────────────────────────────────────────────────
 * BACKWARD COMPATIBLE: All existing admin APIs work identically.
 * ENRICHED: CRUD now accepts + returns all commerce browsing fields.
 *
 * Admin can control:
 *   - Category metadata (name, slug, description, short_description)
 *   - Commerce images (image_url, banner_url)
 *   - Storefront visibility (homepage_visible, navigation_visible)
 *   - Featured flag
 *   - Display ordering (display_order)
 *   - SEO (seo_title, seo_description)
 *   - Subcategory metadata (all of the above at subcategory level)
 *   - Bulk category reordering
 */

const pool = require('../config/db');
const { asyncHandler, slugify } = require('../utils/helpers.util');
const {
  OTHERS_SLUG,
  ensureOthersCategory,
  migrateUncategorizedProducts,
  isOthersCategory,
} = require('../utils/category.util');

// ─── Full admin category list SQL ────────────────────────────────────────────
const CATEGORY_LIST_SQL = `
  SELECT
    c.id,
    c.name,
    c.slug,
    c.description,
    c.short_description,
    c.image_url,
    c.banner_url,
    COALESCE(c.featured, false)          AS featured,
    COALESCE(c.display_order, 0)         AS display_order,
    c.seo_title,
    c.seo_description,
    COALESCE(c.homepage_visible, true)   AS homepage_visible,
    COALESCE(c.navigation_visible, true) AS navigation_visible,
    c.created_at,
    c.updated_at,
    COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'active' OR p.status IS NULL)::int AS product_count,
    COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'active' OR p.status IS NULL)::int AS total_products,
    COUNT(DISTINCT p.id) FILTER (WHERE p.featured = true AND (p.status = 'active' OR p.status IS NULL))::int AS featured_count,
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
  LEFT JOIN products p ON (
    p.category_id = c.id
    OR (c.slug = '${OTHERS_SLUG}' AND p.category_id IS NULL)
  )
  GROUP BY c.id
  ORDER BY
    CASE WHEN c.slug = '${OTHERS_SLUG}' THEN 1 ELSE 0 END,
    COALESCE(c.display_order, 0) DESC,
    c.name ASC
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function isSlugTaken(table, slug, excludeId = null) {
  const params = [slug];
  let sql = `SELECT id FROM ${table} WHERE slug = $1`;
  if (excludeId) { sql += ' AND id != $2'; params.push(excludeId); }
  const r = await pool.query(sql, params);
  return r.rows.length > 0;
}

async function isNameTaken(name, excludeId = null) {
  const params = [name.trim()];
  let sql = 'SELECT id FROM categories WHERE LOWER(name) = LOWER($1)';
  if (excludeId) { sql += ' AND id != $2'; params.push(excludeId); }
  const r = await pool.query(sql, params);
  return r.rows.length > 0;
}

// ─── GET /api/admin/categories ───────────────────────────────────────────────
const getAllCategories = asyncHandler(async (_req, res) => {
  await ensureOthersCategory();
  const result = await pool.query(CATEGORY_LIST_SQL);
  return res.json({
    success    : true,
    total      : result.rows.length,
    categories : result.rows,
  });
});

// ─── POST /api/admin/categories ──────────────────────────────────────────────
const createCategory = asyncHandler(async (req, res) => {
  const {
    name,
    description        = null,
    short_description  = null,
    image_url          = null,
    banner_url         = null,
    featured           = false,
    display_order      = 0,
    seo_title          = null,
    seo_description    = null,
    homepage_visible   = true,
    navigation_visible = true,
    slug: customSlug,
  } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, message: 'Category name is required.' });
  }

  const trimmedName = String(name).trim();
  if (slugify(trimmedName) === OTHERS_SLUG) {
    return res.status(400).json({ success: false, message: 'Cannot create a category with the reserved slug "others".' });
  }

  if (await isNameTaken(trimmedName)) {
    return res.status(409).json({ success: false, message: `Category name "${trimmedName}" already exists.` });
  }

  const slug = customSlug ? slugify(customSlug) : slugify(trimmedName);
  if (slug === OTHERS_SLUG) {
    return res.status(400).json({ success: false, message: 'Slug "others" is reserved for the default category.' });
  }

  if (await isSlugTaken('categories', slug)) {
    return res.status(409).json({ success: false, message: `Slug "${slug}" already exists.` });
  }

  const safeOrder = Math.max(0, parseInt(display_order) || 0);

  const result = await pool.query(
    `INSERT INTO categories (
       name, slug, description, short_description, image_url, banner_url,
       featured, display_order, seo_title, seo_description,
       homepage_visible, navigation_visible, updated_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
     RETURNING *`,
    [
      trimmedName, slug, description, short_description, image_url, banner_url,
      Boolean(featured), safeOrder, seo_title, seo_description,
      Boolean(homepage_visible), Boolean(navigation_visible),
    ]
  );

  return res.status(201).json({ success: true, message: 'Category created.', category: result.rows[0] });
});

// ─── PUT /api/admin/categories/:id ───────────────────────────────────────────
const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    short_description,
    image_url,
    banner_url,
    featured,
    display_order,
    seo_title,
    seo_description,
    homepage_visible,
    navigation_visible,
    slug: customSlug,
  } = req.body;

  const existingRes = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
  if (existingRes.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Category not found.' });
  }
  const existing = existingRes.rows[0];

  // Protect Others category name + slug
  if (isOthersCategory(existing)) {
    if (name && slugify(name) !== OTHERS_SLUG && name.trim() !== existing.name) {
      return res.status(400).json({ success: false, message: 'The default "Others" category name cannot be changed.' });
    }
    if (customSlug && slugify(customSlug) !== OTHERS_SLUG) {
      return res.status(400).json({ success: false, message: 'The default "Others" category slug cannot be changed.' });
    }
  }

  let newSlug = customSlug ? slugify(customSlug) : (name ? slugify(name) : null);
  if (newSlug === OTHERS_SLUG && !isOthersCategory(existing)) {
    return res.status(400).json({ success: false, message: 'Slug "others" is reserved.' });
  }

  if (name && await isNameTaken(name, id)) {
    return res.status(409).json({ success: false, message: `Category name "${name}" already exists.` });
  }

  if (newSlug && await isSlugTaken('categories', newSlug, id)) {
    return res.status(409).json({ success: false, message: `Slug "${newSlug}" already taken.` });
  }

  const safeOrder = display_order !== undefined ? Math.max(0, parseInt(display_order) || 0) : null;

  const result = await pool.query(
    `UPDATE categories
     SET name               = COALESCE($1,  name),
         slug               = COALESCE($2,  slug),
         description        = COALESCE($3,  description),
         short_description  = COALESCE($4,  short_description),
         image_url          = COALESCE($5,  image_url),
         banner_url         = COALESCE($6,  banner_url),
         featured           = COALESCE($7,  featured),
         display_order      = COALESCE($8,  display_order),
         seo_title          = COALESCE($9,  seo_title),
         seo_description    = COALESCE($10, seo_description),
         homepage_visible   = COALESCE($11, homepage_visible),
         navigation_visible = COALESCE($12, navigation_visible),
         updated_at         = NOW()
     WHERE id = $13
     RETURNING *`,
    [
      name ? String(name).trim() : null,
      newSlug,
      description   !== undefined ? description   : null,
      short_description !== undefined ? short_description : null,
      image_url     !== undefined ? image_url     : null,
      banner_url    !== undefined ? banner_url    : null,
      featured      !== undefined ? Boolean(featured) : null,
      safeOrder,
      seo_title     !== undefined ? seo_title     : null,
      seo_description !== undefined ? seo_description : null,
      homepage_visible   !== undefined ? Boolean(homepage_visible)   : null,
      navigation_visible !== undefined ? Boolean(navigation_visible) : null,
      id,
    ]
  );

  // Sync legacy category string on products if name changed
  if (name || newSlug) {
    await pool.query(
      `UPDATE products SET category = $1 WHERE category_id = $2`,
      [result.rows[0].name, id]
    );
  }

  return res.json({ success: true, message: 'Category updated.', category: result.rows[0] });
});

// ─── DELETE /api/admin/categories/:id ────────────────────────────────────────
const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existingRes = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
  if (existingRes.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Category not found.' });
  }

  if (isOthersCategory(existingRes.rows[0])) {
    return res.status(403).json({
      success: false,
      message: 'The default "Others" category cannot be deleted.',
    });
  }

  const others = await ensureOthersCategory();

  // Reassign products to Others
  await pool.query(
    `UPDATE products
     SET category_id = $1, category = $2, subcategory_id = NULL, subcategory = NULL
     WHERE category_id = $3`,
    [others.id, others.name, id]
  );

  const result = await pool.query(
    'DELETE FROM categories WHERE id = $1 RETURNING id, name',
    [id]
  );

  return res.json({
    success: true,
    message: `Category "${result.rows[0].name}" deleted. Its products were moved to "${others.name}".`,
  });
});

// ─── PUT /api/admin/categories/:id/order ─────────────────────────────────────
/**
 * Dedicated endpoint to update a single category's display_order.
 * Admin dashboard drag-and-drop friendly.
 */
const updateCategoryOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { display_order } = req.body;

  if (display_order === undefined || display_order === null) {
    return res.status(400).json({ success: false, message: 'display_order is required.' });
  }

  const safeOrder = Math.max(0, parseInt(display_order) || 0);

  const result = await pool.query(
    `UPDATE categories SET display_order = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, slug, display_order`,
    [safeOrder, id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Category not found.' });
  }

  return res.json({ success: true, message: 'Display order updated.', category: result.rows[0] });
});

// ─── PUT /api/admin/categories/reorder ───────────────────────────────────────
/**
 * Bulk reorder categories.
 * Body: { items: [{ id, display_order }, ...] }
 * Useful for drag-and-drop admin UI.
 */
const reorderCategories = asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'items array is required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      if (!item.id || item.display_order === undefined) continue;
      const safeOrder = Math.max(0, parseInt(item.display_order) || 0);
      await client.query(
        'UPDATE categories SET display_order = $1, updated_at = NOW() WHERE id = $2',
        [safeOrder, item.id]
      );
    }
    await client.query('COMMIT');
    return res.json({ success: true, message: `${items.length} categories reordered.` });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ─── POST /api/admin/subcategories ───────────────────────────────────────────
const createSubcategory = asyncHandler(async (req, res) => {
  const {
    name,
    category_id,
    description     = null,
    image_url       = null,
    featured        = false,
    display_order   = 0,
    seo_title       = null,
    seo_description = null,
    slug: customSlug,
  } = req.body;

  const slug = customSlug ? slugify(customSlug) : slugify(name);

  const catCheck = await pool.query('SELECT id FROM categories WHERE id = $1', [category_id]);
  if (catCheck.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Parent category not found.' });
  }

  // Check slug uniqueness within this category
  const slugCheck = await pool.query(
    'SELECT id FROM subcategories WHERE slug = $1 AND category_id = $2',
    [slug, category_id]
  );
  if (slugCheck.rows.length > 0) {
    return res.status(409).json({ success: false, message: `Subcategory slug "${slug}" already exists in this category.` });
  }

  const safeOrder = Math.max(0, parseInt(display_order) || 0);

  const result = await pool.query(
    `INSERT INTO subcategories (
       category_id, name, slug, description, image_url,
       featured, display_order, seo_title, seo_description, updated_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
     RETURNING *`,
    [category_id, name, slug, description, image_url, Boolean(featured), safeOrder, seo_title, seo_description]
  );

  return res.status(201).json({ success: true, message: 'Subcategory created.', subcategory: result.rows[0] });
});

// ─── PUT /api/admin/subcategories/:id ────────────────────────────────────────
const updateSubcategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    image_url,
    featured,
    display_order,
    seo_title,
    seo_description,
    slug: customSlug,
  } = req.body;

  const newSlug    = customSlug ? slugify(customSlug) : (name ? slugify(name) : null);
  const safeOrder  = display_order !== undefined ? Math.max(0, parseInt(display_order) || 0) : null;

  const result = await pool.query(
    `UPDATE subcategories
     SET name            = COALESCE($1,  name),
         slug            = COALESCE($2,  slug),
         description     = COALESCE($3,  description),
         image_url       = COALESCE($4,  image_url),
         featured        = COALESCE($5,  featured),
         display_order   = COALESCE($6,  display_order),
         seo_title       = COALESCE($7,  seo_title),
         seo_description = COALESCE($8,  seo_description),
         updated_at      = NOW()
     WHERE id = $9
     RETURNING *`,
    [
      name || null, newSlug,
      description     !== undefined ? description     : null,
      image_url       !== undefined ? image_url       : null,
      featured        !== undefined ? Boolean(featured) : null,
      safeOrder,
      seo_title       !== undefined ? seo_title       : null,
      seo_description !== undefined ? seo_description : null,
      id,
    ]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Subcategory not found.' });
  }

  return res.json({ success: true, message: 'Subcategory updated.', subcategory: result.rows[0] });
});

// ─── DELETE /api/admin/subcategories/:id ─────────────────────────────────────
const deleteSubcategory = asyncHandler(async (req, res) => {
  const result = await pool.query(
    'DELETE FROM subcategories WHERE id = $1 RETURNING id, name',
    [req.params.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Subcategory not found.' });
  }
  return res.json({ success: true, message: `Subcategory "${result.rows[0].name}" deleted.` });
});

// ─── PUT /api/admin/products/:id/category ────────────────────────────────────
const reassignProductCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { category_id, subcategory_id = null } = req.body;

  if (!category_id) {
    return res.status(400).json({ success: false, message: 'category_id is required.' });
  }

  const catCheck = await pool.query('SELECT name FROM categories WHERE id = $1', [category_id]);
  if (catCheck.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Target category not found.' });
  }

  if (subcategory_id) {
    const scCheck = await pool.query(
      'SELECT id FROM subcategories WHERE id = $1 AND category_id = $2',
      [subcategory_id, category_id]
    );
    if (scCheck.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Subcategory does not belong to the specified category.' });
    }
  }

  const catName = catCheck.rows[0].name;
  let subcatName = null;
  if (subcategory_id) {
    const scNameRes = await pool.query('SELECT name FROM subcategories WHERE id = $1', [subcategory_id]);
    subcatName = scNameRes.rows[0]?.name || null;
  }

  const result = await pool.query(
    `UPDATE products
     SET category_id    = $1,
         subcategory_id = $2,
         category       = $3,
         subcategory    = $4
     WHERE id = $5
     RETURNING id, name, slug, category_id, subcategory_id, category, subcategory`,
    [category_id, subcategory_id, catName, subcatName, id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }

  return res.json({ success: true, message: 'Product category reassigned.', product: result.rows[0] });
});

module.exports = {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  updateCategoryOrder,
  reorderCategories,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
  reassignProductCategory,
  ensureOthersCategory,
  migrateUncategorizedProducts,
};
