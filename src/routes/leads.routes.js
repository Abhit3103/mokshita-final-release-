'use strict';

const express = require('express');
const { body } = require('express-validator');
const { createLead, getLeads } = require('../controllers/leads.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/admin.middleware');
const { validate } = require('../middlewares/validate.middleware');

const router = express.Router();

// ─── Public: submit a lead (contact form) ────────────────────────────────────
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Full name is required.'),
    body('email').isEmail().normalizeEmail().withMessage('A valid email is required.'),
    body('message').trim().isLength({ min: 5 }).withMessage('Message must be at least 5 characters.'),
    body('phone').optional().trim(),
    body('interest').optional().trim(),
    body('item').optional().trim(),
    validate,
  ],
  createLead
);

// ─── Admin: view all leads ─────────────────────────────────────────────────────
router.get('/', authenticateToken, isAdmin, getLeads);

module.exports = router;
