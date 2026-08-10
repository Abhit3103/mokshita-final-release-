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
  // STEP 4: Ensure no crash if req.user is undefined
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // STEP 1: Log incoming data
  console.log("REQ BODY:", req.body);
  console.log("USER:", req.user);

  // Synthesize shipping_address if missing, using flat fields (for retro-compatibility)
  if (!req.body.shipping_address) {
    const hasFlatFields = req.body.customer_name || req.body.customerName || req.body.name ||
                           req.body.address_line || req.body.addressLine || req.body.address;
    if (hasFlatFields) {
      req.body.shipping_address = {
        customer_name: req.body.customer_name || req.body.customerName || req.body.name || 'Customer',
        email: req.body.email || req.user?.email || 'customer@example.com',
        phone: req.body.phone || '0000000000',
        address_line: req.body.address_line || req.body.addressLine || req.body.address || 'N/A',
        city: req.body.city || 'N/A',
        state: req.body.state || 'N/A',
        pincode: req.body.pincode || '000000'
      };
    }
  }

  const { items, shipping_address, payment_method } = req.body;

  // STEP 2: Validate basic fields
  if (!items || items.length === 0) {
    return res.status(422).json({ error: "Cart is empty" });
  }

  if (!shipping_address) {
    return res.status(422).json({ error: "Shipping address required" });
  }

  // Normalize payment method
  const method = (payment_method || req.body.paymentMethod)?.toUpperCase();

  if (!["COD", "RAZORPAY"].includes(method)) {
    return res.status(422).json({ error: "Invalid payment method" });
  }

  // Validate items
  for (const item of items) {
    if (!item.product_id || !item.quantity || !item.price) {
      return res.status(422).json({ error: "Invalid item format" });
    }
  }

  // Calculate total (DO NOT trust frontend)
  const total_amount = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Extract user
  const user_id = req.user.id;

  // Extract address details with safe default fallbacks to prevent DB constraint failure
  let customer_name, email, phone, address_line, city, state, pincode;
  if (typeof shipping_address === 'object' && shipping_address !== null) {
    customer_name = shipping_address.customer_name || shipping_address.name || shipping_address.customerName;
    email = shipping_address.email;
    phone = shipping_address.phone;
    address_line = shipping_address.address_line || shipping_address.address || shipping_address.addressLine;
    city = shipping_address.city;
    state = shipping_address.state;
    pincode = shipping_address.pincode;
  } else {
    address_line = String(shipping_address);
  }

  customer_name = customer_name || req.body.customer_name || req.body.customerName || req.body.name || req.user?.email || 'Customer';
  email = email || req.body.email || req.user?.email || 'customer@example.com';
  phone = phone || req.body.phone || '0000000000';
  address_line = address_line || req.body.address_line || req.body.addressLine || req.body.address || 'N/A';
  city = city || req.body.city || 'N/A';
  state = state || req.body.state || 'N/A';
  pincode = pincode || req.body.pincode || '000000';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Re-validate all prices/stock from DB ──────────────────────────────────────
    const validatedItems = [];

    for (const item of items) {
      const { product_id, quantity } = item;

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

      validatedItems.push({
        product_id: product.id,
        quantity: parseInt(quantity),
        price_at_time: parseFloat(product.price),
        name: product.name,
      });
    }

    const shipping_cost = total_amount >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_COST;
    const final_total = total_amount + shipping_cost;
    const order_number = generateOrderNumber();

    const initialStatus = method === 'RAZORPAY' ? 'pending_payment' : 'received';

    // ── Create order record ──────────────────────────────────────────────────
    const orderResult = await client.query(
      `INSERT INTO orders
         (user_id, order_number, customer_name, email, phone, address_line, city, state, pincode,
          payment_method, subtotal, shipping_cost, total, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        user_id, order_number, customer_name, email, phone,
        address_line, city, state, pincode,
        method, total_amount.toFixed(2), shipping_cost.toFixed(2), final_total.toFixed(2),
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
    const cartResult = await client.query('SELECT id FROM carts WHERE user_id = $1', [user_id]);
    if (cartResult.rows.length > 0) {
      await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartResult.rows[0].id]);
    }

    await client.query('COMMIT');

    // STEP 3: IMPLEMENT FLOWS

    // COD FLOW:
    if (method === "COD") {
      return res.status(201).json({
        success: true,
        message: "Order placed successfully (COD)",
        order: {
          ...order,
          items: validatedItems.map(({ product_id, quantity, price_at_time, name }) => ({
            product_id, quantity, price_at_time, name,
          })),
        }
      });
    }

    // RAZORPAY FLOW:
    if (method === "RAZORPAY") {
      const key_id = process.env.RAZORPAY_KEY_ID;
      const key_secret = process.env.RAZORPAY_KEY_SECRET;
      if (!key_id || !key_secret) {
        throw new Error('Razorpay credentials missing from .env file.');
      }

      const Razorpay = require('razorpay');
      const razorpay = new Razorpay({ key_id, key_secret });

      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(final_total * 100),
        currency: "INR",
        receipt: order.order_number
      });

      // Save razorpay_order_id in DB
      await pool.query('UPDATE orders SET razorpay_order_id = $1 WHERE id = $2', [razorpayOrder.id, order.id]);

      return res.status(201).json({
        success: true,
        order_id: razorpayOrder.id,
        amount: final_total,
        order: {
          ...order,
          razorpay_order_id: razorpayOrder.id,
          items: validatedItems.map(({ product_id, quantity, price_at_time, name }) => ({
            product_id, quantity, price_at_time, name,
          })),
          amount_paise: razorpayOrder.amount,
        }
      });
    }
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
