'use strict';

const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe, updateProfile } = require('../controllers/auth.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');

const router = express.Router();

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
    body('full_name').optional().trim().isLength({ max: 255 }),
    validate,
  ],
  register
);

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
    validate,
  ],
  login
);

// ─── Compatibility aliases for common frontend clients ──────────────────────
router.post('/signup', (req, res, next) => {
  req.body = { ...req.body, full_name: req.body.full_name || req.body.name || null };
  next();
}, register);

router.post('/logout', (_req, res) => {
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', authenticateToken, getMe);

// ─── PUT /api/auth/profile ────────────────────────────────────────────────────
router.put(
  '/profile',
  authenticateToken,
  [
    body('phone').optional().isMobilePhone().withMessage('Invalid phone number.'),
    body('pincode').optional().isPostalCode('IN').withMessage('Invalid pincode.'),
    validate,
  ],
  updateProfile
);

module.exports = router;
