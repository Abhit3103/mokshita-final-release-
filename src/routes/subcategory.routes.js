'use strict';

/**
 * Subcategory Routes — Commerce Edition
 * ──────────────────────────────────────────────────────────────────────────────
 * Mounted at /api/subcategories
 *
 *   GET /api/subcategories                   → all subcategories (enriched)
 *   GET /api/subcategories/:slug             → single subcategory detail + parent + SEO
 *   GET /api/subcategories/:slug/products    → paginated products in subcategory
 *
 * Supports clean commerce URLs:
 *   /shop/:categorySlug/:subcategorySlug  →  /api/subcategories/:slug/products
 */

const express = require('express');
const {
  getAllSubcategories,
  getSubcategoryBySlug,
  getProductsBySubcategory,
} = require('../controllers/category.controller');

const router = express.Router();

router.get('/',                   getAllSubcategories);
router.get('/:slug',              getSubcategoryBySlug);      // NEW: subcategory landing page detail
router.get('/:slug/products',     getProductsBySubcategory);

module.exports = router;
