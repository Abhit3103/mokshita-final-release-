'use strict';

/**
 * Admin Category Controller
 * ─────────────────────────────────────────────────────────────────────────────
 * All routes protected by authenticateToken + isAdmin (enforced in admin.routes.js).
 *
 * POST   /api/admin/categories                  → create category
 * PUT    /api/admin/categories/:id              → update category
 * DELETE /api/admin/categories/:id              → soft-delete (set status) or hard-delete
 * POST   /api/admin/subcategories               → create subcategory under a category
 * PUT    /api/admin/subcategories/:id           → update subcategory
 * DELETE /api/admin/subcategories/:id           → delete subcategory
 * PUT    /api/admin/products/:id/category       → reassign product to a different category
 */

const pool = require('../config/db');
const { asyncHandler, slugify } = require('../utils/helpers.util');

// ─── Helper: check slug uniqueness ───────────────────────────────────────────
async function isSlugTaken(table, slug, excludeId = null) {
  const params = [slug];
  let sql = `SELECT id FROM ${table} WHERE slug = $1`;
  if (excludeId) { sql += ` AND id != $2`; params.push(excludeId); }
  const r = await pool.query(sql, params);
  return r.rows.length > 0;
}

// ─── POST /api/admin/categories ──────────────────────────────────────────────
const createCategory = asyncHandler(async (req, res) => {
  const { name, description = null, image_url = null, slug: customSlug } = req.body;
  const slug = customSlug ? slugify(customSlug) : slugify(name);

  if (await isSlugTaken('categories', slug)) {
    return res.status(409).json({ success: false, message: `Slug "${slug}" already exists.` });
  }

  const result = await pool.query(
    `INSERT INTO categories (name, slug, description, image_url)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, slug, description, image_url]
  );

  return res.status(201).json({ success: true, message: 'Category created.', category: result.rows[0] });
});

// ─── PUT /api/admin/categories/:id ───────────────────────────────────────────
const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, image_url, slug: customSlug } = req.body;

  // Build slug if name or slug supplied
  let newSlug = customSlug ? slugify(customSlug) : (name ? slugify(name) : null);
  if (newSlug && await isSlugTaken('categories', newSlug, id)) {
    return res.status(409).json({ success: false, message: `Slug "${newSlug}" already taken.` });
  }

  const result = await pool.query(
    `UPDATE categories
     SET name        = COALESCE($1, name),
         slug        = COALESCE($2, slug),
         description = COALESCE($3, description),
         image_url   = COALESCE($4, image_url)
     WHERE id = $5
     RETURNING *`,
    [name || null, newSlug, description !== undefined ? description : null, image_url !== undefined ? image_url : null, id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Category not found.' });
  }
  return res.json({ success: true, message: 'Category updated.', category: result.rows[0] });
});

// ─── DELETE /api/admin/categories/:id ────────────────────────────────────────
// Hard delete. Products with this category_id will have it set to NULL (ON DELETE SET NULL in schema).
const deleteCategory = asyncHandler(async (req, res) => {
  const result = await pool.query(
    'DELETE FROM categories WHERE id = $1 RETURNING id, name',
    [req.params.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Category not found.' });
  }
  return res.json({ success: true, message: `Category "${result.rows[0].name}" deleted. Affected products have category_id set to NULL.` });
});

// ─── POST /api/admin/subcategories ───────────────────────────────────────────
const createSubcategory = asyncHandler(async (req, res) => {
  const { name, category_id, description = null, slug: customSlug } = req.body;
  const slug = customSlug ? slugify(customSlug) : slugify(name);

  // Verify parent category exists
  const catCheck = await pool.query('SELECT id FROM categories WHERE id = $1', [category_id]);
  if (catCheck.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Parent category not found.' });
  }

  const result = await pool.query(
    `INSERT INTO subcategories (category_id, name, slug, description)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [category_id, name, slug, description]
  );

  return res.status(201).json({ success: true, message: 'Subcategory created.', subcategory: result.rows[0] });
});

// ─── PUT /api/admin/subcategories/:id ────────────────────────────────────────
const updateSubcategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, slug: customSlug } = req.body;
  const newSlug = customSlug ? slugify(customSlug) : (name ? slugify(name) : null);

  const result = await pool.query(
    `UPDATE subcategories
     SET name        = COALESCE($1, name),
         slug        = COALESCE($2, slug),
         description = COALESCE($3, description)
     WHERE id = $4
     RETURNING *`,
    [name || null, newSlug, description !== undefined ? description : null, id]
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
// Reassign a product to a different category and/or subcategory.
const reassignProductCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { category_id, subcategory_id = null } = req.body;

  if (!category_id) {
    return res.status(400).json({ success: false, message: 'category_id is required.' });
  }

  // Verify category exists
  const catCheck = await pool.query('SELECT name FROM categories WHERE id = $1', [category_id]);
  if (catCheck.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Target category not found.' });
  }

  // Verify subcategory belongs to the category (if provided)
  if (subcategory_id) {
    const scCheck = await pool.query(
      'SELECT id FROM subcategories WHERE id = $1 AND category_id = $2',
      [subcategory_id, category_id]
    );
    if (scCheck.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Subcategory does not belong to the specified category.' });
    }
  }

  // Fetch the category name for syncing legacy text field
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
  createCategory, updateCategory, deleteCategory,
  createSubcategory, updateSubcategory, deleteSubcategory,
  reassignProductCategory,
};
