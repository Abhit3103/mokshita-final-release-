'use strict';

const pool = require('../config/db');
const { asyncHandler, generateOrderNumber } = require('../utils/helpers.util');

// Fixed shipping cost threshold (assumption: free shipping above 999)
const FREE_SHIPPING_THRESHOLD = 999;
const FLAT_SHIPPING_COST = 80;

// ─── POST /api/orders/checkout ─────────────────────────────────────────────────
/**
 * Server-side checkout:
 * 1. Accepts items array from frontend.
 * 2. Re-validates prices from DB (frontend prices are NOT trusted).
 * 3. Calculates subtotal + shipping server-side.
 * 4. Deducts stock atomically inside a transaction.
 * 5. Clears user's DB cart on success.
 *
 * Payment flow:
 *   COD       → status = 'received' immediately.
 *   RAZORPAY  → status = 'pending_payment'. Frontend then calls:
 *               POST /api/payments/create-order (to get razorpay_order_id)
 *               Opens Razorpay checkout modal
 *               POST /api/payments/verify (to confirm + set status = 'received')
 */
const checkout = asyncHandler(async (req, res) => {
  const {
    customer_name, email, phone,
    address_line, city, state, pincode,
    payment_method = 'COD',
    items, // [{ product_id, quantity }]
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Order must contain at least one item.' });
  }

  // Validate payment_method
  const VALID_PAYMENT_METHODS = ['COD', 'RAZORPAY'];
  const normalizedPayment = (payment_method || 'COD').toUpperCase();
  if (!VALID_PAYMENT_METHODS.includes(normalizedPayment)) {
    return res.status(400).json({
      success: false,
      message: `payment_method must be one of: ${VALID_PAYMENT_METHODS.join(', ')}.`,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Re-validate all prices from DB ──────────────────────────────────────
    let subtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const { product_id, quantity } = item;
      if (!product_id || !quantity || parseInt(quantity) < 1) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Invalid item in order.' });
      }

      const prodResult = await client.query(
        'SELECT id, name, price, stock FROM products WHERE id = $1 FOR UPDATE',
        [product_id]
      );

      if (prodResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Product ${product_id} not found.` });
      }

      const product = prodResult.rows[0];

      if (product.stock < parseInt(quantity)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}". Available: ${product.stock}`,
        });
      }

      const price = parseFloat(product.price);
      subtotal += price * parseInt(quantity);
      validatedItems.push({
        product_id: product.id,
        quantity: parseInt(quantity),
        price_at_time: price,
        name: product.name,
      });
    }

    // ── Calculate shipping ───────────────────────────────────────────────────
    const shipping_cost = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_COST;
    const total = subtotal + shipping_cost;
    const order_number = generateOrderNumber();

    // ── Order status: COD confirmed immediately; Razorpay waits for payment ─
    const initialStatus = normalizedPayment === 'RAZORPAY' ? 'pending_payment' : 'received';

    // ── Create order record ──────────────────────────────────────────────────
    const orderResult = await client.query(
      `INSERT INTO orders
         (user_id, order_number, customer_name, email, phone, address_line, city, state, pincode,
          payment_method, subtotal, shipping_cost, total, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        req.user?.id || null, order_number, customer_name, email, phone,
        address_line, city, state, pincode,
        normalizedPayment, subtotal.toFixed(2), shipping_cost.toFixed(2), total.toFixed(2),
        initialStatus,
      ]
    );

    const order = orderResult.rows[0];

    // ── Insert order items & deduct stock ────────────────────────────────────
    for (const item of validatedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price_at_time)
         VALUES ($1, $2, $3, $4)`,
        [order.id, item.product_id, item.quantity, item.price_at_time]
      );

      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    // ── Clear user's DB cart after successful order ──────────────────────────
    if (req.user?.id) {
      const cartResult = await client.query('SELECT id FROM carts WHERE user_id = $1', [req.user.id]);
      if (cartResult.rows.length > 0) {
        await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartResult.rows[0].id]);
      }
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: normalizedPayment === 'RAZORPAY'
        ? 'Order created. Complete payment to confirm your order.'
        : 'Order placed successfully.',
      order: {
        ...order,
        items: validatedItems.map(({ product_id, quantity, price_at_time, name }) => ({
          product_id, quantity, price_at_time, name,
        })),
        // For Razorpay: frontend needs amount_paise to pass to the Razorpay checkout SDK
        amount_paise: normalizedPayment === 'RAZORPAY' ? Math.round(total * 100) : undefined,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ─── GET /api/orders/my-orders ─────────────────────────────────────────────────
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await pool.query(
    `SELECT o.id, o.order_number, o.status, o.total, o.subtotal, o.shipping_cost,
            o.payment_method, o.tracking_note, o.created_at, o.shipped_at, o.delivered_at,
            json_agg(
              json_build_object(
                'product_id', oi.product_id,
                'product_name', p.name,
                'quantity', oi.quantity,
                'price_at_time', oi.price_at_time
              )
            ) AS items
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE o.user_id = $1
     GROUP BY o.id
     ORDER BY o.created_at DESC`,
    [req.user.id]
  );

  return res.json({ success: true, orders: orders.rows });
});

module.exports = { checkout, getMyOrders };
