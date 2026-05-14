'use strict';

/**
 * Product Images Controller
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages multi-image gallery entries in product_images table.
 * products.image_url is NEVER touched — full backward compatibility.
 *
 * Routes:
 *   GET    /api/products/:productId/images        → list images for a product
 *   POST   /api/products/:productId/images        → add image record (admin)
 *   PUT    /api/products/:productId/images/:id    → update alt/order (admin)
 *   DELETE /api/products/:productId/images/:id    → remove image record (admin)
 *   PUT    /api/products/:productId/images/:id/primary → set as primary (admin)
 */

const pool = require('../config/db');
const { asyncHandler } = require('../utils/helpers.util');

// ─── Verify product exists helper ────────────────────────────────────────────
async function resolveProduct(productId) {
  const r = await pool.query(
    'SELECT id, name, image_url FROM products WHERE id = $1',
    [productId]
  );
  return r.rows[0] || null;
}

// ─── GET /api/products/:productId/images ─────────────────────────────────────
const getProductImages = asyncHandler(async (req, res) => {
  const product = await resolveProduct(req.params.productId);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }

  const result = await pool.query(
    `SELECT id, image_url, alt_text, display_order, created_at
     FROM product_images
     WHERE product_id = $1
     ORDER BY display_order ASC, created_at ASC`,
    [product.id]
  );

  return res.json({
    success       : true,
    product_id    : product.id,
    product_name  : product.name,
    primary_image : product.image_url,   // legacy field — always included
    images        : result.rows,
  });
});

// ─── POST /api/products/:productId/images ─────────────────────────────────────
// Registers a URL into product_images (URL already uploaded via /api/upload).
// Also optionally syncs products.image_url if this is the first/primary image.
const addProductImage = asyncHandler(async (req, res) => {
  const { image_url, alt_text = null, display_order = 0, set_as_primary = false } = req.body;

  if (!image_url || !image_url.trim()) {
    return res.status(400).json({ success: false, message: 'image_url is required.' });
  }

  const product = await resolveProduct(req.params.productId);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert image record
    const insertRes = await client.query(
      `INSERT INTO product_images (product_id, image_url, alt_text, display_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [product.id, image_url.trim(), alt_text, parseInt(display_order) || 0]
    );
    const newImage = insertRes.rows[0];

    // Sync products.image_url if product has no primary yet or caller requests it
    if (set_as_primary || !product.image_url) {
      await client.query(
        'UPDATE products SET image_url = $1 WHERE id = $2',
        [image_url.trim(), product.id]
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success   : true,
      message   : 'Image added to product gallery.',
      image     : newImage,
      synced_primary: set_as_primary || !product.image_url,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ─── PUT /api/products/:productId/images/:id ─────────────────────────────────
const updateProductImage = asyncHandler(async (req, res) => {
  const { alt_text, display_order } = req.body;
  const { productId, id } = req.params;

  const result = await pool.query(
    `UPDATE product_images
     SET alt_text      = COALESCE($1, alt_text),
         display_order = COALESCE($2, display_order)
     WHERE id = $3 AND product_id = $4
     RETURNING *`,
    [
      alt_text     !== undefined ? alt_text            : null,
      display_order !== undefined ? parseInt(display_order) : null,
      id,
      productId,
    ]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Image not found for this product.' });
  }

  return res.json({ success: true, message: 'Image updated.', image: result.rows[0] });
});

// ─── DELETE /api/products/:productId/images/:id ───────────────────────────────
const deleteProductImage = asyncHandler(async (req, res) => {
  const { productId, id } = req.params;

  const result = await pool.query(
    'DELETE FROM product_images WHERE id = $1 AND product_id = $2 RETURNING id, image_url',
    [id, productId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Image not found for this product.' });
  }

  return res.json({
    success : true,
    message : 'Image removed from gallery.',
    deleted : result.rows[0],
  });
});

// ─── PUT /api/products/:productId/images/:id/primary ──────────────────────────
// Sets this gallery image as the product's primary image_url (backward compat sync).
const setPrimaryImage = asyncHandler(async (req, res) => {
  const { productId, id } = req.params;

  // Verify the image belongs to this product
  const imgRes = await pool.query(
    'SELECT image_url FROM product_images WHERE id = $1 AND product_id = $2',
    [id, productId]
  );
  if (imgRes.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Image not found for this product.' });
  }

  // Sync products.image_url — keeps the legacy field consistent
  await pool.query(
    'UPDATE products SET image_url = $1 WHERE id = $2',
    [imgRes.rows[0].image_url, productId]
  );

  return res.json({
    success       : true,
    message       : 'Primary image updated. products.image_url synced.',
    primary_image : imgRes.rows[0].image_url,
  });
});

module.exports = {
  getProductImages,
  addProductImage,
  updateProductImage,
  deleteProductImage,
  setPrimaryImage,
};
