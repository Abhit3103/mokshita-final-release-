'use strict';

/**
 * Payment Controller — Razorpay Integration
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Flow:
 *   1. Frontend calls POST /api/payments/create-order with { amount_paise, order_metadata }
 *      → Backend creates a Razorpay order and returns { razorpay_order_id, amount, currency }
 *
 *   2. Frontend opens Razorpay checkout modal with razorpay_order_id
 *      → On success, frontend gets { razorpay_payment_id, razorpay_order_id, razorpay_signature }
 *
 *   3. Frontend calls POST /api/payments/verify with { razorpay_payment_id, razorpay_order_id,
 *      razorpay_signature, order_db_id } to confirm payment server-side.
 *      → Backend verifies HMAC signature and marks order as 'received'.
 *
 *   4. Razorpay also sends a webhook to POST /api/payments/webhook for async confirmation.
 *
 * Required env vars:
 *   RAZORPAY_KEY_ID         → from Razorpay dashboard
 *   RAZORPAY_KEY_SECRET     → from Razorpay dashboard
 *   RAZORPAY_WEBHOOK_SECRET → webhook secret set in Razorpay dashboard
 */

const Razorpay = require('razorpay');
const crypto  = require('crypto');
const pool    = require('../config/db');
const { asyncHandler } = require('../utils/helpers.util');

// ─── Lazily-initialised Razorpay instance ─────────────────────────────────────
let razorpayClient = null;

function getRazorpay() {
  if (razorpayClient) return razorpayClient;

  const key_id     = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error(
      'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file.'
    );
  }

  razorpayClient = new Razorpay({ key_id, key_secret });
  return razorpayClient;
}

// ─── POST /api/payments/create-order ──────────────────────────────────────────
/**
 * Creates a Razorpay order and returns its ID to the frontend.
 * The frontend passes { amount_paise (integer), receipt } in the request body.
 *
 * amount_paise = total in paisa (e.g., ₹499 → 49900).
 * receipt      = a short reference string (e.g., the DB order_number).
 */
const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { amount_paise, receipt, notes = {} } = req.body;

  if (!amount_paise || isNaN(parseInt(amount_paise)) || parseInt(amount_paise) < 100) {
    return res.status(400).json({ success: false, message: 'amount_paise must be an integer ≥ 100 (₹1).' });
  }

  const rzp = getRazorpay();

  const razorpayOrder = await rzp.orders.create({
    amount:   parseInt(amount_paise),
    currency: 'INR',
    receipt:  receipt || `mks-${Date.now()}`,
    notes,
  });

  return res.status(201).json({
    success:          true,
    razorpay_order_id: razorpayOrder.id,
    amount:           razorpayOrder.amount,
    currency:         razorpayOrder.currency,
  });
});

// ─── POST /api/payments/verify ────────────────────────────────────────────────
/**
 * Verifies the Razorpay payment signature after the user completes payment.
 * If valid, marks the order as 'received' in the database.
 *
 * Request body:
 *   {
 *     razorpay_payment_id: string,
 *     razorpay_order_id:   string,
 *     razorpay_signature:  string,
 *     order_db_id:         UUID  — the ID of the order row in our DB
 *   }
 */
const verifyPayment = asyncHandler(async (req, res) => {
  const {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    order_db_id,
  } = req.body;

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !order_db_id) {
    return res.status(400).json({ success: false, message: 'Missing required payment verification fields.' });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return res.status(500).json({ success: false, message: 'Payment gateway not configured on server.' });
  }

  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSig = crypto
    .createHmac('sha256', keySecret)
    .update(body)
    .digest('hex');

  const receivedBuffer = Buffer.from(razorpay_signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSig, 'utf8');

  if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) {
    await pool.query(
      `UPDATE orders SET status = 'payment_failed', razorpay_order_id = $1 WHERE id = $2`,
      [razorpay_order_id, order_db_id]
    );
    return res.status(400).json({ success: false, message: 'Payment verification failed. Signature mismatch.' });
  }

  const result = await pool.query(
    `UPDATE orders
     SET status              = 'received',
         razorpay_order_id   = $1,
         razorpay_payment_id = $2,
         razorpay_signature  = $3
     WHERE id = $4
     RETURNING id, order_number, status, total`,
    [razorpay_order_id, razorpay_payment_id, razorpay_signature, order_db_id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Order not found in database.' });
  }

  return res.json({
    success: true,
    message: 'Payment verified successfully.',
    order: result.rows[0],
  });
});

// ─── POST /api/payments/webhook ───────────────────────────────────────────────
/**
 * Razorpay webhook handler — called by Razorpay servers on payment events.
 * Verifies the webhook signature and handles payment.captured / payment.failed.
 *
 * This is an async confirmation fallback: even if the user closes their browser
 * before the /verify call completes, the webhook will still update the order.
 *
 * NOTE: The route for this must use express.raw() NOT express.json()
 * because Razorpay signs the raw body bytes.
 */
const handleWebhook = asyncHandler(async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('⚠️  RAZORPAY_WEBHOOK_SECRET not set — skipping webhook signature check.');
    return res.status(200).json({ received: true });
  }

  const receivedSig = Array.isArray(req.headers['x-razorpay-signature'])
    ? req.headers['x-razorpay-signature'][0]
    : req.headers['x-razorpay-signature'];
  const expectedSig = crypto
    .createHmac('sha256', webhookSecret)
    .update(req.body)
    .digest('hex');

  const receivedBuffer = Buffer.from(receivedSig || '', 'utf8');
  const expectedBuffer = Buffer.from(expectedSig, 'utf8');

  if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) {
    console.warn('⚠️  Invalid Razorpay webhook signature — ignoring event.');
    return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
  }

  const event = JSON.parse(req.body.toString());
  const eventType = event?.event;

  if (eventType === 'payment.captured') {
    const payment = event?.payload?.payment?.entity;
    const rzpOrderId = payment?.order_id;

    if (rzpOrderId) {
      await pool.query(
        `UPDATE orders
         SET status = 'received',
             razorpay_payment_id = COALESCE($1, razorpay_payment_id)
         WHERE razorpay_order_id = $2
           AND status IN ('pending_payment', 'payment_failed', 'received')`,
        [payment.id, rzpOrderId]
      );
      console.log(`✅ Webhook: payment.captured — razorpay_order_id=${rzpOrderId}`);
    }
  } else if (eventType === 'payment.failed') {
    const payment = event?.payload?.payment?.entity;
    const rzpOrderId = payment?.order_id;

    if (rzpOrderId) {
      await pool.query(
        `UPDATE orders
         SET status = 'payment_failed', razorpay_payment_id = COALESCE($1, razorpay_payment_id)
         WHERE razorpay_order_id = $2
           AND status IN ('pending_payment', 'received', 'payment_failed')`,
        [payment.id, rzpOrderId]
      );
      console.log(`⚠️  Webhook: payment.failed — razorpay_order_id=${rzpOrderId}`);
    }
  } else if (eventType === 'order.paid') {
    const order = event?.payload?.order?.entity;
    const rzpOrderId = order?.id;
    const paymentId = event?.payload?.payment?.entity?.id || null;

    if (rzpOrderId) {
      await pool.query(
        `UPDATE orders
         SET status = 'received',
             razorpay_order_id = COALESCE($1, razorpay_order_id),
             razorpay_payment_id = COALESCE($2, razorpay_payment_id)
         WHERE razorpay_order_id = $1
           AND status IN ('pending_payment', 'payment_failed', 'received')`,
        [rzpOrderId, paymentId]
      );
      console.log(`✅ Webhook: order.paid — razorpay_order_id=${rzpOrderId}`);
    }
  }

  return res.status(200).json({ received: true });
});

const getPaymentStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  if (!orderId) {
    return res.status(400).json({ success: false, message: 'orderId is required.' });
  }

  const result = await pool.query(
    `SELECT id, order_number, status, total, payment_method, razorpay_order_id, razorpay_payment_id, created_at
     FROM orders
     WHERE id = $1 OR order_number = $1`,
    [orderId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Order not found.' });
  }

  return res.json({ success: true, order: result.rows[0] });
});

module.exports = { createRazorpayOrder, verifyPayment, handleWebhook, getPaymentStatus };
