'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { getAllOrders, updateOrderStatus, updateTrackingNote } = require('../controllers/admin.controller');
const {
  getAllCategories,
  createCategory, updateCategory, deleteCategory,
  updateCategoryOrder, reorderCategories,
  createSubcategory, updateSubcategory, deleteSubcategory,
  reassignProductCategory,
} = require('../controllers/adminCategory.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { isAdmin }           = require('../middlewares/admin.middleware');
const { validate }          = require('../middlewares/validate.middleware');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticateToken, isAdmin);

// ─── Order Management ─────────────────────────────────────────────────────────
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

// Bulk reorder — MUST be registered BEFORE /:id routes to avoid param conflict
router.put(
  '/categories/reorder',
  [
    body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array.'),
    validate,
  ],
  reorderCategories
);

router.get('/categories', getAllCategories);

router.post(
  '/categories',
  [
    body('name').trim().notEmpty().withMessage('Category name is required.'),
    body('display_order').optional().isInt({ min: 0 }).withMessage('display_order must be a non-negative integer.'),
    body('homepage_visible').optional().isBoolean().withMessage('homepage_visible must be a boolean.'),
    body('navigation_visible').optional().isBoolean().withMessage('navigation_visible must be a boolean.'),
    validate,
  ],
  createCategory
);

router.put(
  '/categories/:id',
  [
    body('display_order').optional().isInt({ min: 0 }).withMessage('display_order must be a non-negative integer.'),
    body('homepage_visible').optional().isBoolean().withMessage('homepage_visible must be a boolean.'),
    body('navigation_visible').optional().isBoolean().withMessage('navigation_visible must be a boolean.'),
    validate,
  ],
  updateCategory
);

// Dedicated display_order update
router.put(
  '/categories/:id/order',
  [
    body('display_order').isInt({ min: 0 }).withMessage('display_order must be a non-negative integer.'),
    validate,
  ],
  updateCategoryOrder
);

router.delete('/categories/:id', deleteCategory);

// ─── Subcategory Management ───────────────────────────────────────────────────
router.post(
  '/subcategories',
  [
    body('name').trim().notEmpty().withMessage('Subcategory name is required.'),
    body('category_id').isUUID().withMessage('Valid category_id (UUID) is required.'),
    body('display_order').optional().isInt({ min: 0 }).withMessage('display_order must be a non-negative integer.'),
    body('featured').optional().isBoolean().withMessage('featured must be a boolean.'),
    validate,
  ],
  createSubcategory
);

router.put(
  '/subcategories/:id',
  [
    body('display_order').optional().isInt({ min: 0 }).withMessage('display_order must be a non-negative integer.'),
    body('featured').optional().isBoolean().withMessage('featured must be a boolean.'),
    validate,
  ],
  updateSubcategory
);

router.delete('/subcategories/:id', deleteSubcategory);

// ─── Product Category Reassignment ────────────────────────────────────────────
router.put(
  '/products/:id/category',
  [
    body('category_id').isUUID().withMessage('Valid category_id (UUID) is required.'),
    validate,
  ],
  reassignProductCategory
);

module.exports = router;
