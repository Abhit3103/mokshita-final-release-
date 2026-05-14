'use strict';

/**
 * Product Images Routes
 * ─────────────────────────────────────────────────────────────────────────────
 * Public:   GET /api/products/:productId/images
 * Admin:    POST / PUT / DELETE / PUT .../primary
 *
 * Mounted in app.js at /api/products so full paths become:
 *   GET    /api/products/:productId/images
 *   POST   /api/products/:productId/images
 *   PUT    /api/products/:productId/images/:id
 *   DELETE /api/products/:productId/images/:id
 *   PUT    /api/products/:productId/images/:id/primary
 */

const express = require('express');
const router  = express.Router({ mergeParams: true }); // gives access to :productId from parent
const { body } = require('express-validator');
const {
  getProductImages,
  addProductImage,
  updateProductImage,
  deleteProductImage,
  setPrimaryImage,
} = require('../controllers/productImages.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { isAdmin }           = require('../middlewares/admin.middleware');
const { validate }          = require('../middlewares/validate.middleware');

// ─── Public ───────────────────────────────────────────────────────────────────
router.get('/', getProductImages);

// ─── Admin-only ───────────────────────────────────────────────────────────────
router.post(
  '/',
  authenticateToken, isAdmin,
  [ body('image_url').trim().notEmpty().withMessage('image_url is required.'), validate ],
  addProductImage
);

router.put(
  '/:id',
  authenticateToken, isAdmin,
  updateProductImage
);

router.delete(
  '/:id',
  authenticateToken, isAdmin,
  deleteProductImage
);

router.put(
  '/:id/primary',
  authenticateToken, isAdmin,
  setPrimaryImage
);

module.exports = router;
