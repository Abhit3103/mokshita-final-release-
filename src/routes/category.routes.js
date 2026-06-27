'use strict';

/**
 * Category & Subcategory Routes — Commerce Edition
 * ──────────────────────────────────────────────────────────────────────────────
 * PUBLIC ROUTES (no auth required):
 *
 *   GET /api/categories                          → all categories (commerce-ready)
 *   GET /api/categories/featured                 → featured/homepage spotlights
 *   GET /api/categories/subcategories            → all subcategories (legacy compat)
 *   GET /api/categories/:slug                    → category landing page data
 *   GET /api/categories/:slug/products           → paginated products in category
 *   GET /api/categories/:slug/subcategories      → subcategories of a category
 *
 * SHOP URL SUPPORT:
 *   The backend supports /shop/:categorySlug and /shop/:categorySlug/:subcategorySlug
 *   via the existing /:slug and /api/subcategories/:slug/products endpoints.
 */

const express = require('express');
const {
  getAllCategories,
  getCategoryBySlug,
  getProductsByCategory,
  getSubcategoriesByCategory,
  getAllSubcategories,
  getFeaturedCategories,
} = require('../controllers/category.controller');

const router = express.Router();

// ─── Literal routes MUST come before /:slug ──────────────────────────────────
router.get('/subcategories',              getAllSubcategories);       // backward compat
router.get('/featured',                   getFeaturedCategories);     // homepage spotlights

// ─── Parameterized category routes ───────────────────────────────────────────
router.get('/',                           getAllCategories);
router.get('/:slug',                      getCategoryBySlug);
router.get('/:slug/products',             getProductsByCategory);
router.get('/:slug/subcategories',        getSubcategoriesByCategory); // nav dropdown

module.exports = router;
