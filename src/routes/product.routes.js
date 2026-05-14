'use strict';

const express = require('express');
const { body } = require('express-validator');
const {
  getAllProducts, getProductBySlug, getRichProductBySlug,
  searchProducts, getFeaturedProducts,
  createProduct, updateProduct, deleteProduct,
} = require('../controllers/product.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/admin.middleware');
const { validate } = require('../middlewares/validate.middleware');
const productImagesRouter = require('./productImages.routes');

const router = express.Router();

// ─── Nested: product gallery images (/api/products/:productId/images) ─────────
router.use('/:productId/images', productImagesRouter);


// ─── Public Routes ────────────────────────────────────────────────────────────
router.get('/',              getAllProducts);
router.get('/search',        searchProducts);         // must be before /:slug
router.get('/featured',      getFeaturedProducts);    // must be before /:slug
router.get('/detail/:slug',  getRichProductBySlug);   // enriched — must be before /:slug
router.get('/:slug',         getProductBySlug);        // legacy — unchanged

// ─── Admin-only Routes ────────────────────────────────────────────────────────
router.post(
  '/',
  authenticateToken,
  isAdmin,
  [
    body('name').trim().notEmpty().withMessage('Product name is required.'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number.'),
    body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer.'),
    validate,
  ],
  createProduct
);

router.put(
  '/:id',
  authenticateToken,
  isAdmin,
  [
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a non-negative number.'),
    body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a non-negative integer.'),
    validate,
  ],
  updateProduct
);

router.delete('/:id', authenticateToken, isAdmin, deleteProduct);

module.exports = router;
