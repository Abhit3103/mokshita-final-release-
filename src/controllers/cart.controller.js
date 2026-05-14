'use strict';

const pool = require('../config/db');
const { asyncHandler } = require('../utils/helpers.util');

/**
 * Internal helper: get or create a cart for a user.
 * Returns the cart id.
 */
const getOrCreateCart = async (userId) => {
  // UPSERT ensures one cart per user
  const result = await pool.query(
    `INSERT INTO carts (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING id`,
    [userId]
  );
  return result.rows[0].id;
};

/**
 * Internal helper: fetch full cart with items and total count.
 */
const fetchCartDetails = async (cartId) => {
  const items = await pool.query(
    `SELECT ci.id, ci.quantity, p.id AS product_id, p.name, p.slug, p.price, p.image_url, p.stock
     FROM cart_items ci
     JOIN products p ON ci.product_id = p.id
     WHERE ci.cart_id = $1`,
    [cartId]
  );

  const totalQty = items.rows.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.rows.reduce((sum, item) => sum + item.quantity * parseFloat(item.price), 0);

  return { items: items.rows, totalQty, subtotal: subtotal.toFixed(2) };
};

// ─── GET /api/cart ─────────────────────────────────────────────────────────────
const getCart = asyncHandler(async (req, res) => {
  const cartId = await getOrCreateCart(req.user.id);
  const cart = await fetchCartDetails(cartId);
  return res.json({ success: true, ...cart });
});

// ─── POST /api/cart ────────────────────────────────────────────────────────────
const addToCart = asyncHandler(async (req, res) => {
  const { product_id, quantity = 1 } = req.body;

  // Validate product exists and has sufficient stock
  const product = await pool.query('SELECT id, stock FROM products WHERE id = $1', [product_id]);
  if (product.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }
  if (product.rows[0].stock < 1) {
    return res.status(400).json({ success: false, message: 'Product is out of stock.' });
  }

  const cartId = await getOrCreateCart(req.user.id);

  // UPSERT: if item exists, increment quantity
  await pool.query(
    `INSERT INTO cart_items (cart_id, product_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (cart_id, product_id)
     DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity`,
    [cartId, product_id, parseInt(quantity)]
  );

  const cart = await fetchCartDetails(cartId);
  return res.status(201).json({ success: true, message: 'Item added to cart.', ...cart });
});

// ─── PUT /api/cart/item/:id ────────────────────────────────────────────────────
const updateCartItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  const cartItemId = req.params.id;

  if (!quantity || parseInt(quantity) < 1) {
    return res.status(400).json({ success: false, message: 'Quantity must be at least 1.' });
  }

  const cartId = await getOrCreateCart(req.user.id);

  const result = await pool.query(
    `UPDATE cart_items SET quantity = $1
     WHERE id = $2 AND cart_id = $3
     RETURNING id`,
    [parseInt(quantity), cartItemId, cartId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Cart item not found.' });
  }

  const cart = await fetchCartDetails(cartId);
  return res.json({ success: true, message: 'Cart item updated.', ...cart });
});

// ─── DELETE /api/cart/item/:id ─────────────────────────────────────────────────
const removeCartItem = asyncHandler(async (req, res) => {
  const cartId = await getOrCreateCart(req.user.id);

  const result = await pool.query(
    'DELETE FROM cart_items WHERE id = $1 AND cart_id = $2 RETURNING id',
    [req.params.id, cartId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Cart item not found.' });
  }

  const cart = await fetchCartDetails(cartId);
  return res.json({ success: true, message: 'Item removed from cart.', ...cart });
});

// ─── POST /api/cart/sync ───────────────────────────────────────────────────────
/**
 * Merges a guest localStorage cart into the authenticated user's DB cart.
 * Body: { items: [{ product_id, quantity }] }
 */
const syncCart = asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'No items to sync.' });
  }

  const cartId = await getOrCreateCart(req.user.id);

  // Use a transaction to safely UPSERT all guest items
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      const { product_id, quantity } = item;
      if (!product_id || !quantity || parseInt(quantity) < 1) continue;

      // Check product validity
      const prod = await client.query('SELECT id FROM products WHERE id = $1', [product_id]);
      if (prod.rows.length === 0) continue;

      await client.query(
        `INSERT INTO cart_items (cart_id, product_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (cart_id, product_id)
         DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity`,
        [cartId, product_id, parseInt(quantity)]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const cart = await fetchCartDetails(cartId);
  return res.json({ success: true, message: 'Cart synced successfully.', ...cart });
});

module.exports = { getCart, addToCart, updateCartItem, removeCartItem, syncCart };
