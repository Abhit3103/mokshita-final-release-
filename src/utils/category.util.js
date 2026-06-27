'use strict';

const pool = require('../config/db');
const { slugify } = require('./helpers.util');

const OTHERS_NAME = 'Others';
const OTHERS_SLUG = 'others';

/**
 * Ensure the default "Others" category exists. Returns its row.
 * @param {import('pg').PoolClient} [client] - optional transaction client
 */
async function ensureOthersCategory(client = null) {
  const db = client || pool;
  const existing = await db.query(
    'SELECT * FROM categories WHERE slug = $1',
    [OTHERS_SLUG]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const inserted = await db.query(
    `INSERT INTO categories (name, slug, description)
     VALUES ($1, $2, $3)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [OTHERS_NAME, OTHERS_SLUG, 'Default category for uncategorized products.']
  );
  return inserted.rows[0];
}

/**
 * Map products without category_id to Others and sync legacy category string.
 */
async function migrateUncategorizedProducts(client = null) {
  const db = client || pool;
  const others = await ensureOthersCategory(client);

  await db.query(
    `UPDATE products
     SET category_id = $1,
         category    = $2
     WHERE category_id IS NULL`,
    [others.id, OTHERS_NAME]
  );

  await db.query(
    `UPDATE products p
     SET category = c.name
     FROM categories c
     WHERE p.category_id = c.id
       AND (p.category IS NULL OR p.category <> c.name)`,
  );

  return others;
}

/**
 * Resolve category_id + legacy category string from request body.
 * Prefers category_id; falls back to matching name/slug; then Others.
 */
async function resolveCategoryFromBody(body, client = null) {
  const db = client || pool;
  const { category_id, category: legacyCategory, subcategory_id, subcategory: legacySubcategory } = body;

  let resolvedCategoryId = category_id || null;
  let resolvedCategoryName = null;
  let resolvedSubcategoryId = subcategory_id || null;
  let resolvedSubcategoryName = legacySubcategory || null;

  if (resolvedCategoryId) {
    const catRes = await db.query('SELECT id, name, slug FROM categories WHERE id = $1', [resolvedCategoryId]);
    if (catRes.rows.length === 0) {
      const err = new Error('Invalid category_id.');
      err.statusCode = 400;
      throw err;
    }
    resolvedCategoryName = catRes.rows[0].name;
  } else if (legacyCategory && String(legacyCategory).trim()) {
    const term = String(legacyCategory).trim();
    const catRes = await db.query(
      `SELECT id, name FROM categories
       WHERE LOWER(name) = LOWER($1) OR slug = $2
       LIMIT 1`,
      [term, slugify(term)]
    );
    if (catRes.rows.length > 0) {
      resolvedCategoryId = catRes.rows[0].id;
      resolvedCategoryName = catRes.rows[0].name;
    }
  }

  if (!resolvedCategoryId) {
    const others = await ensureOthersCategory(client);
    resolvedCategoryId = others.id;
    resolvedCategoryName = others.name;
  }

  if (resolvedSubcategoryId) {
    const scRes = await db.query(
      'SELECT id, name FROM subcategories WHERE id = $1 AND category_id = $2',
      [resolvedSubcategoryId, resolvedCategoryId]
    );
    if (scRes.rows.length === 0) {
      const err = new Error('Invalid subcategory_id for the selected category.');
      err.statusCode = 400;
      throw err;
    }
    resolvedSubcategoryName = scRes.rows[0].name;
  } else {
    resolvedSubcategoryId = null;
    resolvedSubcategoryName = null;
  }

  return {
    category_id: resolvedCategoryId,
    category: resolvedCategoryName,
    subcategory_id: resolvedSubcategoryId,
    subcategory: resolvedSubcategoryName,
  };
}

function isOthersCategory(row) {
  return row && (row.slug === OTHERS_SLUG || row.name === OTHERS_NAME);
}

module.exports = {
  OTHERS_NAME,
  OTHERS_SLUG,
  ensureOthersCategory,
  migrateUncategorizedProducts,
  resolveCategoryFromBody,
  isOthersCategory,
};
