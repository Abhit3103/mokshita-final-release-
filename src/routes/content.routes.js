'use strict';

/**
 * CMS Content Routes
 * ─────────────────────────────────────────────────────────────────────────────
 * IMPORTANT ordering: named literal routes must come BEFORE /:key
 * to prevent Express treating 'homepage', 'brand', etc. as key values.
 *
 * Public:
 *   GET /api/content              → all sections map
 *   GET /api/content/homepage     → homepage composite
 *   GET /api/content/brand        → brand identity
 *   GET /api/content/about        → about brand
 *   GET /api/content/footer       → footer links
 *   GET /api/content/:key         → any section by key (legacy + generic)
 *
 * Admin:
 *   PUT /api/content/:key         → upsert/update section (JWT + admin required)
 */

const express = require('express');
const {
  getAllContent,
  getContentByKey,
  getHomepageContent,
  getBrandContent,
  getAboutContent,
  getFooterContent,
  upsertContent,
} = require('../controllers/content.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { isAdmin }           = require('../middlewares/admin.middleware');

const router = express.Router();

// ─── Public — named sections (MUST be before /:key) ──────────────────────────
router.get('/',          getAllContent);
router.get('/homepage',  getHomepageContent);
router.get('/brand',     getBrandContent);
router.get('/about',     getAboutContent);
router.get('/footer',    getFooterContent);

// ─── Public — generic key lookup (legacy + catch-all) ────────────────────────
router.get('/:key',  getContentByKey);

// ─── Admin — upsert content section ──────────────────────────────────────────
router.put('/:key',  authenticateToken, isAdmin, upsertContent);

module.exports = router;
