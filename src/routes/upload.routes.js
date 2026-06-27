'use strict';

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/admin.middleware');
const { uploadMiddleware } = require('../middlewares/upload.middleware');

/**
 * POST /api/upload
 * Requires: JWT auth + Admin role
 *
 * Accepts: multipart/form-data with field name "image"
 * Returns: { success: true, imageUrl: "<supabase-cdn-url>" }
 *
 * The uploadMiddleware handles:
 *  1. Validating file type + size
 *  2. Uploading buffer to Supabase Storage
 *  3. Setting req.uploadedImageUrl to the permanent CDN URL
 */
router.post('/', authenticateToken, isAdmin, uploadMiddleware, (req, res) => {
  return res.status(200).json({
    success: true,
    imageUrl: req.uploadedImageUrl,
  });
});

module.exports = router;
