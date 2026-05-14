'use strict';

/**
 * Category & Subcategory Routes
 * ──────────────────────────────────────────────────
 * GET /api/categories                      → all categories + subcategories + counts
 * GET /api/categories/:slug                → single category detail
 * GET /api/categories/:slug/products       → paginated products in category
 * GET /api/subcategories                   → all subcategories + parent category
 * GET /api/subcategories/:slug/products    → paginated products in subcategory
 */

const express = require('express');
const {
  getAllCategories,
  getCategoryBySlug,
  getProductsByCategory,
  getAllSubcategories,
  getProductsBySubcategory,
  getFeaturedCategories,
} = require('../controllers/category.controller');

const router = express.Router();

// ─── Category Routes ──────────────────────────────────────────────────────────
router.get('/',                   getAllCategories);
router.get('/subcategories',      getAllSubcategories);    // literal — before /:slug
router.get('/featured',           getFeaturedCategories); // literal — before /:slug
router.get('/:slug',              getCategoryBySlug);
router.get('/:slug/products',     getProductsByCategory);

// ─── Subcategory product route (mounted at /api/subcategories) ────────────────
// Exported separately — see subcategory.routes.js
router.get('/sub/:slug/products',     getProductsBySubcategory);

module.exports = router;
