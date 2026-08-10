'use strict';

const express = require('express');
const { body } = require('express-validator');
const { getCart, addToCart, updateCartItem, removeCartItem, syncCart } = require('../controllers/cart.controller');
const { validate } = require('../middlewares/validate.middleware');

const router = express.Router();

// Auth: verifyUser is applied in app.js for /api/cart

router.get('/', getCart);

router.post(
  '/',
  [
    body('product_id').isUUID().withMessage('Valid product_id (UUID) is required.'),
    body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be a positive integer.'),
    validate,
  ],
  addToCart
);

router.put(
  '/item/:id',
  [
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1.'),
    validate,
  ],
  updateCartItem
);

router.delete('/item/:id', removeCartItem);

router.post(
  '/sync',
  [
    body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array.'),
    body('items.*.product_id').isUUID().withMessage('Each item must have a valid product_id.'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Each item must have quantity >= 1.'),
    validate,
  ],
  syncCart
);

module.exports = router;
