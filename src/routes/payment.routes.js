'use strict';

/**
 * Payment Routes — Razorpay
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * POST /api/payments/create-order  → Create a Razorpay order (auth optional)
 * POST /api/payments/verify        → Verify payment signature + update DB order
 * POST /api/payments/webhook       → Razorpay async webhook (raw body required)
 */

const express = require('express');
const { body } = require('express-validator');
const router  = express.Router();

const { createRazorpayOrder, verifyPayment, handleWebhook, getPaymentStatus } = require('../controllers/payment.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');

// ─── Webhook — MUST use raw body parser (Razorpay signs raw bytes) ────────────
// This route is mounted BEFORE express.json() in app.js so the raw buffer
// is preserved on req.body for signature verification.
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  handleWebhook
);

// ─── Create Razorpay Order ────────────────────────────────────────────────────
router.post(
  '/create-order',
  authenticateToken,
  [
    body('order_id')
      .isUUID()
      .withMessage('order_id must be a valid UUID.'),
    body('receipt')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 40 })
      .withMessage('receipt must be a string of max 40 characters.'),
    validate,
  ],
  createRazorpayOrder
);

// ─── Payment Status ─────────────────────────────────────────────────────────
router.get('/:orderId/status', getPaymentStatus);

// ─── Verify Payment ───────────────────────────────────────────────────────────
router.post(
  '/verify',
  authenticateToken,
  [
    body('razorpay_payment_id').notEmpty().withMessage('razorpay_payment_id is required.'),
    body('razorpay_order_id').notEmpty().withMessage('razorpay_order_id is required.'),
    body('razorpay_signature').notEmpty().withMessage('razorpay_signature is required.'),
    body('order_id').isUUID().withMessage('order_id must be a valid UUID.'),
    validate,
  ],
  verifyPayment
);

module.exports = router;
