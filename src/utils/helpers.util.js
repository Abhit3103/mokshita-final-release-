'use strict';

/**
 * Generates a unique order number in the format: MKS-YYYYMMDD-XXXXXX
 * e.g., MKS-20260505-A3F9C1
 * @returns {string}
 */
const generateOrderNumber = () => {
  const date = new Date();
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).toUpperCase().slice(2, 8);
  return `MKS-${datePart}-${randomPart}`;
};

/**
 * Creates a URL-friendly slug from a product name.
 * @param {string} name
 * @returns {string}
 */
const slugify = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Wraps an async express handler to forward errors to the global error handler.
 * @param {Function} fn - Async route handler
 * @returns {Function}
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { generateOrderNumber, slugify, asyncHandler };
