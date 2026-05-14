'use strict';

/**
 * Validation Utilities
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralizes reusable validation chains used across multiple route files.
 * Import these instead of rewriting body() chains repeatedly.
 */

const { body, query, param } = require('express-validator');

// ─── Slug validator ───────────────────────────────────────────────────────────
const slugParam = (fieldName = 'slug') =>
  param(fieldName)
    .trim()
    .notEmpty().withMessage(`${fieldName} is required.`)
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).withMessage(`${fieldName} must be a valid slug (lowercase, hyphens only).`);

// ─── UUID param validator ────────────────────────────────────────────────────
const uuidParam = (fieldName = 'id') =>
  param(fieldName)
    .isUUID().withMessage(`${fieldName} must be a valid UUID.`);

// ─── Pagination query validators ─────────────────────────────────────────────
const paginationQuery = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer.').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100.').toInt(),
];

// ─── Price range validators ──────────────────────────────────────────────────
const priceRangeQuery = [
  query('min_price').optional().isFloat({ min: 0 }).withMessage('min_price must be a non-negative number.').toFloat(),
  query('max_price').optional().isFloat({ min: 0 }).withMessage('max_price must be a non-negative number.').toFloat(),
];

// ─── Sort query validator ─────────────────────────────────────────────────────
const sortQuery = [
  query('sort').optional().isIn(['created_at', 'price', 'name', 'stock']).withMessage("sort must be one of: created_at, price, name, stock."),
  query('order').optional().isIn(['asc', 'desc']).withMessage("order must be 'asc' or 'desc'."),
];

// ─── Search query validator ───────────────────────────────────────────────────
const searchQuery =
  query('q')
    .trim()
    .notEmpty().withMessage('Search query (q) is required.')
    .isLength({ min: 2 }).withMessage('Search query must be at least 2 characters.')
    .isLength({ max: 100 }).withMessage('Search query must not exceed 100 characters.');

// ─── Product body validators ──────────────────────────────────────────────────
const productBodyCreate = [
  body('name').trim().notEmpty().withMessage('Product name is required.'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number.'),
  body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer.'),
];

const productBodyUpdate = [
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a non-negative number.'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a non-negative integer.'),
  body('status').optional().isIn(['active', 'draft', 'archived']).withMessage("status must be one of: active, draft, archived."),
];

// ─── Category body validators ────────────────────────────────────────────────
const categoryBodyCreate = [
  body('name').trim().notEmpty().withMessage('Category name is required.'),
];

const subcategoryBodyCreate = [
  body('name').trim().notEmpty().withMessage('Subcategory name is required.'),
  body('category_id').isUUID().withMessage('Valid category_id (UUID) is required.'),
];

module.exports = {
  slugParam,
  uuidParam,
  paginationQuery,
  priceRangeQuery,
  sortQuery,
  searchQuery,
  productBodyCreate,
  productBodyUpdate,
  categoryBodyCreate,
  subcategoryBodyCreate,
};
