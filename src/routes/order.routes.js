'use strict';

const express = require('express');
const { body } = require('express-validator');
const { checkout, getMyOrders } = require('../controllers/order.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');

const router = express.Router();

// ─── POST /api/orders/checkout ─────────────────────────────────────────────────
// Auth is optional — guest checkout is allowed (user_id will be null)
// To support both, we try to decode the token but don't hard-fail if missing
router.post(
  '/checkout',
  (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return require('../middlewares/auth.middleware').authenticateToken(req, res, next);
    }
    next(); // Guest checkout: req.user will be undefined
  },
  [
    body('customer_name').trim().notEmpty().withMessage('Customer name is required.'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
    body('phone').isMobilePhone().withMessage('Valid phone number is required.'),
    body('address_line').trim().notEmpty().withMessage('Address is required.'),
    body('city').trim().notEmpty().withMessage('City is required.'),
    body('state').trim().notEmpty().withMessage('State is required.'),
    body('pincode').trim().notEmpty().withMessage('Pincode is required.'),
    body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array.'),
    body('items.*.product_id').isUUID().withMessage('Each item must have a valid product_id.'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Each item quantity must be >= 1.'),
    validate,
  ],
  checkout
);

// ─── GET /api/orders/my-orders ─────────────────────────────────────────────────
router.get('/my-orders', authenticateToken, getMyOrders);

module.exports = router;
