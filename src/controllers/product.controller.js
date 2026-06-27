'use strict';

const pool = require('../config/db');
const { asyncHandler, slugify } = require('../utils/helpers.util');
const { resolveCategoryFromBody, ensureOthersCategory } = require('../utils/category.util');

// ─── GET /api/products ────────────────────────────────────────────────────────
const getAllProducts = asyncHandler(async (req, res) => {
  const { category, min_price, max_price, in_stock, sort = 'created_at', order = 'desc', page = 1, limit = 20 } = req.query;

  const conditions = [];
  const params = [];
  let idx = 1;

  if (req.query.category_id) {
    conditions.push(`category_id = $${idx++}`);
    params.push(req.query.category_id);
  } else if (category) {
    conditions.push(`(category = $${idx} OR category_id IN (SELECT id FROM categories WHERE slug = $${idx}))`);
    params.push(category);
    idx++;
  }
  if (min_price) {
    conditions.push(`price >= $${idx++}`);
    params.push(parseFloat(min_price));
  }
  if (max_price) {
    conditions.push(`price <= $${idx++}`);
    params.push(parseFloat(max_price));
  }
  if (in_stock === 'true') {
    conditions.push(`stock > 0`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Whitelist sort columns to prevent SQL injection
  const allowedSort = ['created_at', 'price', 'name', 'stock'];
  const safeSort = allowedSort.includes(sort) ? sort : 'created_at';
  const safeOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const offset = (parseInt(page) - 1) * parseInt(limit);

  params.push(parseInt(limit), offset);

  const [productsResult, countResult] = await Promise.all([
    pool.query(
      `SELECT id, slug, name, price, category, category_id, subcategory_id, stock, description, image_url, created_at
       FROM products ${whereClause}
       ORDER BY ${safeSort} ${safeOrder}
       LIMIT $${idx++} OFFSET $${idx}`,
      params
    ),
    pool.query(`SELECT COUNT(*) FROM products ${whereClause}`, params.slice(0, -2)),
  ]);

  return res.json({
    success: true,
    total: parseInt(countResult.rows[0].count),
    page: parseInt(page),
    limit: parseInt(limit),
    products: productsResult.rows,
  });
});

// ─── GET /api/products/:slug ──────────────────────────────────────────────────
// LEGACY: kept exactly as-is for full frontend compatibility.
const getProductBySlug = asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM products WHERE slug = $1',
    [req.params.slug]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }

  return res.json({ success: true, product: result.rows[0] });
});

// ─── GET /api/products/detail/:slug ───────────────────────────────────────────
// ENRICHED: returns category/subcategory objects, related products, images, SEO.
// Does NOT replace /:slug — registered as a separate named path in routes.
const getRichProductBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  // ── 1. Fetch product with category + subcategory JOIN ─────────────────────
  const productRes = await pool.query(
    `SELECT
       p.*,
       -- Relational category object
       CASE WHEN c.id IS NOT NULL THEN
         json_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'description', c.description)
       ELSE NULL END AS category_obj,
       -- Relational subcategory object
       CASE WHEN sc.id IS NOT NULL THEN
         json_build_object('id', sc.id, 'name', sc.name, 'slug', sc.slug, 'description', sc.description)
       ELSE NULL END AS subcategory_obj
     FROM products p
     LEFT JOIN categories    c  ON c.id  = p.category_id
     LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
     WHERE p.slug = $1`,
    [slug]
  );

  if (productRes.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }

  const raw = productRes.rows[0];

  // ── 2. Compute stock_status ────────────────────────────────────────────────
  let stock_status = 'out_of_stock';
  if (raw.stock >= 10)     stock_status = 'in_stock';
  else if (raw.stock > 0) stock_status = 'low_stock';

  // ── 3. Fetch product images ────────────────────────────────────────────────
  const imagesRes = await pool.query(
    `SELECT id, image_url, alt_text, display_order
     FROM product_images
     WHERE product_id = $1
     ORDER BY display_order ASC`,
    [raw.id]
  );

  // ── 4. Fetch related products (same category, exclude self, max 4) ─────────
  let relatedProducts = [];
  if (raw.category_id) {
    const relatedRes = await pool.query(
      `SELECT p.id, p.name, p.slug, p.price, p.compare_price, p.image_url,
              p.stock, p.featured, p.material, p.region,
              CASE WHEN sc.id IS NOT NULL THEN
                json_build_object('id', sc.id, 'name', sc.name, 'slug', sc.slug)
              ELSE NULL END AS subcategory
       FROM products p
       LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
       WHERE p.category_id = $1
         AND p.id        != $2
         AND p.status     = 'active'
         AND p.stock      > 0
       ORDER BY
         CASE WHEN p.subcategory_id = $3 THEN 0 ELSE 1 END,
         p.created_at DESC
       LIMIT 4`,
      [raw.category_id, raw.id, raw.subcategory_id]
    );
    relatedProducts = relatedRes.rows;
  }

  // ── 5. Build SEO metadata ──────────────────────────────────────────────────
  const catName  = raw.category_obj?.name  || raw.category   || '';
  const descText = raw.short_description   || raw.description || '';
  const seo = {
    title            : `${raw.name}${catName ? ` | ${catName}` : ''} — Mokshita Enterprises`,
    description      : descText
      ? descText.slice(0, 160)
      : `Buy ${raw.name} — handcrafted in ${raw.region || 'India'} at Mokshita Enterprises.`,
    canonical_slug   : raw.slug,
    og_image         : raw.image_url || null,
  };

  // ── 6. Compose final response (strip internal JOIN aliases) ───────────────
  const { category_obj, subcategory_obj, category_id, subcategory_id, ...productFields } = raw;

  return res.json({
    success  : true,
    product  : {
      ...productFields,           // all original columns preserved
      category_id,                // keep FK for client-side use
      subcategory_id,
      category     : category_obj,
      subcategory  : subcategory_obj,
      stock_status,
      images       : imagesRes.rows,
      seo,
    },
    related_products: relatedProducts,
  });
});

// ─── POST /api/products (Admin) ───────────────────────────────────────────────
const createProduct = asyncHandler(async (req, res) => {
  const { name, price, stock, description, image_url, slug: customSlug } = req.body;

  const slug = customSlug ? slugify(customSlug) : slugify(name);
  let catFields;
  try {
    catFields = await resolveCategoryFromBody(req.body);
  } catch (err) {
    return res.status(err.statusCode || 400).json({ success: false, message: err.message });
  }

  const result = await pool.query(
    `INSERT INTO products (
       slug, name, price, category, category_id, subcategory, subcategory_id,
       stock, description, image_url
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      slug,
      name,
      parseFloat(price),
      catFields.category,
      catFields.category_id,
      catFields.subcategory,
      catFields.subcategory_id,
      parseInt(stock) || 0,
      description || null,
      image_url || null,
    ]
  );

  return res.status(201).json({ success: true, message: 'Product created.', product: result.rows[0] });
});

// ─── PUT /api/products/:id (Admin) ────────────────────────────────────────────
const updateProduct = asyncHandler(async (req, res) => {
  const { name, price, stock, description, image_url, slug } = req.body;
  const { id } = req.params;

  const hasCategoryPayload =
    req.body.category_id !== undefined ||
    req.body.category !== undefined ||
    req.body.subcategory_id !== undefined ||
    req.body.subcategory !== undefined;

  let catFields = null;
  if (hasCategoryPayload) {
    const existing = await pool.query('SELECT category_id, category, subcategory_id, subcategory FROM products WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    const current = existing.rows[0];
    try {
      catFields = await resolveCategoryFromBody({
        category_id: req.body.category_id !== undefined ? req.body.category_id : current.category_id,
        category: req.body.category !== undefined ? req.body.category : current.category,
        subcategory_id: req.body.subcategory_id !== undefined ? req.body.subcategory_id : current.subcategory_id,
        subcategory: req.body.subcategory !== undefined ? req.body.subcategory : current.subcategory,
      });
    } catch (err) {
      return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
  } else {
    await ensureOthersCategory();
  }

  const result = await pool.query(
    `UPDATE products
     SET name            = COALESCE($1, name),
         price           = COALESCE($2, price),
         category        = COALESCE($3, category),
         category_id     = COALESCE($4, category_id),
         subcategory     = COALESCE($5, subcategory),
         subcategory_id  = COALESCE($6, subcategory_id),
         stock           = COALESCE($7, stock),
         description     = COALESCE($8, description),
         image_url       = COALESCE($9, image_url),
         slug            = COALESCE($10, slug)
     WHERE id = $11
     RETURNING *`,
    [
      name || null,
      price != null ? parseFloat(price) : null,
      catFields ? catFields.category : null,
      catFields ? catFields.category_id : null,
      catFields ? catFields.subcategory : null,
      catFields ? catFields.subcategory_id : null,
      stock != null ? parseInt(stock) : null,
      description || null,
      image_url || null,
      slug ? slugify(slug) : null,
      id,
    ]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }

  if (!result.rows[0].category_id) {
    const others = await ensureOthersCategory();
    const fixed = await pool.query(
      `UPDATE products SET category_id = $1, category = $2 WHERE id = $3 RETURNING *`,
      [others.id, others.name, id]
    );
    return res.json({ success: true, message: 'Product updated.', product: fixed.rows[0] });
  }

  return res.json({ success: true, message: 'Product updated.', product: result.rows[0] });
});

// ─── DELETE /api/products/:id (Admin) ────────────────────────────────────────
const deleteProduct = asyncHandler(async (req, res) => {
  const result = await pool.query(
    'DELETE FROM products WHERE id = $1 RETURNING id, name',
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }

  return res.json({ success: true, message: `Product "${result.rows[0].name}" deleted.` });
});

// ─── GET /api/products/search?q= ───────────────────────────────────────────────────
// Full-text search across name, description, short_description, sku, tags, material, region.
// Supports pagination, sorting, and category/price filters.
const searchProducts = asyncHandler(async (req, res) => {
  const q          = (req.query.q || '').trim();
  const page       = Math.max(1, parseInt(req.query.page)  || 1);
  const limit      = Math.min(100, Math.max(1, parseInt(req.query.limit) || 12));
  const offset     = (page - 1) * limit;

  const ALLOWED_SORT = { created_at: 'p.created_at', price: 'p.price', name: 'p.name', stock: 'p.stock' };
  const safeSort = ALLOWED_SORT[req.query.sort] || 'p.created_at';
  const safeOrder = (req.query.order || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const conditions = ["p.status = 'active'", '(p.name ILIKE $1 OR p.description ILIKE $1 OR p.short_description ILIKE $1 OR p.sku ILIKE $1 OR p.tags ILIKE $1 OR p.material ILIKE $1 OR p.region ILIKE $1)'];
  const params     = [`%${q}%`];
  let idx = 2;

  if (req.query.category_id) {
    conditions.push(`p.category_id = $${idx++}`);
    params.push(req.query.category_id);
  }
  if (req.query.min_price) { conditions.push(`p.price >= $${idx++}`); params.push(parseFloat(req.query.min_price)); }
  if (req.query.max_price) { conditions.push(`p.price <= $${idx++}`); params.push(parseFloat(req.query.max_price)); }
  if (req.query.in_stock === 'true') { conditions.push('p.stock > 0'); }

  const WHERE = `WHERE ${conditions.join(' AND ')}`;
  const countParams   = [...params];
  const productParams = [...params, limit, offset];

  const [countRes, productsRes] = await Promise.all([
    pool.query(
      `SELECT COUNT(DISTINCT p.id)::int AS total
       FROM products p
       LEFT JOIN categories    c  ON c.id  = p.category_id
       LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
       ${WHERE}`,
      countParams
    ),
    pool.query(
      `SELECT
         p.id, p.name, p.slug, p.sku, p.price, p.compare_price, p.stock,
         p.short_description, p.image_url, p.material, p.region,
         p.featured, p.status, p.created_at,
         CASE WHEN c.id IS NOT NULL THEN json_build_object('id', c.id, 'name', c.name, 'slug', c.slug) ELSE NULL END AS category,
         CASE WHEN sc.id IS NOT NULL THEN json_build_object('id', sc.id, 'name', sc.name, 'slug', sc.slug) ELSE NULL END AS subcategory
       FROM products p
       LEFT JOIN categories    c  ON c.id  = p.category_id
       LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
       ${WHERE}
       ORDER BY ${safeSort} ${safeOrder}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      productParams
    ),
  ]);

  const total = countRes.rows[0].total;
  return res.json({
    success     : true,
    query       : q,
    total,
    page,
    limit,
    total_pages : Math.ceil(total / limit),
    products    : productsRes.rows,
  });
});

// ─── GET /api/products/featured ──────────────────────────────────────────────────
const getFeaturedProducts = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 8));

  const result = await pool.query(
    `SELECT
       p.id, p.name, p.slug, p.price, p.compare_price, p.stock,
       p.short_description, p.image_url, p.material, p.region, p.featured, p.created_at,
       CASE WHEN c.id IS NOT NULL THEN json_build_object('id', c.id, 'name', c.name, 'slug', c.slug) ELSE NULL END AS category,
       CASE WHEN sc.id IS NOT NULL THEN json_build_object('id', sc.id, 'name', sc.name, 'slug', sc.slug) ELSE NULL END AS subcategory
     FROM products p
     LEFT JOIN categories    c  ON c.id  = p.category_id
     LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
     WHERE p.featured = true AND p.status = 'active' AND p.stock > 0
     ORDER BY p.created_at DESC
     LIMIT $1`,
    [limit]
  );

  // Fallback: if no featured products exist, return newest active products
  let products = result.rows;
  if (products.length === 0) {
    const fallback = await pool.query(
      `SELECT p.id, p.name, p.slug, p.price, p.compare_price, p.stock,
              p.short_description, p.image_url, p.material, p.region, p.featured, p.created_at,
              CASE WHEN c.id IS NOT NULL THEN json_build_object('id', c.id, 'name', c.name, 'slug', c.slug) ELSE NULL END AS category
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.status = 'active' AND p.stock > 0
       ORDER BY p.created_at DESC LIMIT $1`,
      [limit]
    );
    products = fallback.rows;
  }

  return res.json({
    success          : true,
    total            : products.length,
    is_fallback      : result.rows.length === 0,
    products,
  });
});

module.exports = { getAllProducts, getProductBySlug, getRichProductBySlug, searchProducts, getFeaturedProducts, createProduct, updateProduct, deleteProduct };
