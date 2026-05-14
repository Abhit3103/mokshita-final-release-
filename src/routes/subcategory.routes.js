'use strict';

/**
 * Standalone subcategory routes
 * ──────────────────────────────────────────────────
 * GET /api/subcategories                   → all subcategories
 * GET /api/subcategories/:slug/products    → products in subcategory
 */

const express = require('express');
const {
  getAllSubcategories,
  getProductsBySubcategory,
} = require('../controllers/category.controller');

const router = express.Router();

router.get('/',                   getAllSubcategories);
router.get('/:slug/products',     getProductsBySubcategory);

module.exports = router;
