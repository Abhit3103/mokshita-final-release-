'use strict';

const express = require('express');
const { body } = require('express-validator');
const { checkout, getMyOrders } = require('../controllers/order.controller');
const { verifyUser } = require('../middlewares/auth.middleware');

const router = express.Router();

// ─── POST /api/orders/checkout ─────────────────────────────────────────────────
router.post(
  '/checkout',
  verifyUser,
  checkout
);

// ─── GET /api/orders/my-orders ─────────────────────────────────────────────────
router.get('/my-orders', getMyOrders);

module.exports = router;
