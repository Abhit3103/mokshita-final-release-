'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { getAllOrders, updateOrderStatus, updateTrackingNote } = require('../controllers/admin.controller');
const {
  createCategory, updateCategory, deleteCategory,
  createSubcategory, updateSubcategory, deleteSubcategory,
  reassignProductCategory,
} = require('../controllers/adminCategory.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/admin.middleware');
const { validate } = require('../middlewares/validate.middleware');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticateToken, isAdmin);

router.get('/orders', getAllOrders);

router.put(
  '/orders/:id/status',
  [
    body('status')
      .isIn(['received', 'shipped', 'delivered', 'cancelled'])
      .withMessage('Status must be one of: received, shipped, delivered, cancelled.'),
    validate,
  ],
  updateOrderStatus
);

router.put(
  '/orders/:id/tracking',
  [
    body('tracking_note').trim().notEmpty().withMessage('tracking_note is required.'),
    validate,
  ],
  updateTrackingNote
);

// ─── Category Management ──────────────────────────────────────────────────────
router.post(
  '/categories',
  [ body('name').trim().notEmpty().withMessage('Category name is required.'), validate ],
  createCategory
);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// ─── Subcategory Management ───────────────────────────────────────────────────
router.post(
  '/subcategories',
  [
    body('name').trim().notEmpty().withMessage('Subcategory name is required.'),
    body('category_id').isUUID().withMessage('Valid category_id (UUID) is required.'),
    validate,
  ],
  createSubcategory
);
router.put('/subcategories/:id', updateSubcategory);
router.delete('/subcategories/:id', deleteSubcategory);

// ─── Product Category Reassignment ────────────────────────────────────────────
router.put(
  '/products/:id/category',
  [ body('category_id').isUUID().withMessage('Valid category_id (UUID) is required.'), validate ],
  reassignProductCategory
);

module.exports = router;
