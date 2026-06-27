'use strict';

/**
 * Navigation Routes
 * ──────────────────────────────────────────────────────────────────────────────
 * Mounted at /api/navigation
 *
 * Optimized, lightweight payloads for storefront navigation.
 * No auth required — public read endpoints.
 *
 *   GET /api/navigation           → full desktop nav tree (categories + subcategories)
 *   GET /api/navigation/homepage  → homepage category cards (homepage_visible=true)
 *   GET /api/navigation/mobile    → mobile-optimized flat nav list
 */

const express = require('express');
const {
  getNavigation,
  getHomepageCategories,
  getMobileNavigation,
} = require('../controllers/navigation.controller');

const router = express.Router();

// Literal sub-paths BEFORE any parameterized routes
router.get('/homepage', getHomepageCategories);
router.get('/mobile',   getMobileNavigation);
router.get('/',         getNavigation);

module.exports = router;
