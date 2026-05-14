'use strict';

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/admin.middleware');
const { uploadMiddleware } = require('../middlewares/upload.middleware');

// POST /api/upload
// Requires JWT auth and Admin role
router.post('/', authenticateToken, isAdmin, uploadMiddleware, (req, res) => {
  // If middleware passes, file is successfully uploaded and accessible at req.file
  const imageUrl = `/uploads/products/${req.file.filename}`;
  
  res.status(200).json({
    success: true,
    imageUrl: imageUrl
  });
});

module.exports = router;
