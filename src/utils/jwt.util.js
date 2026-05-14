'use strict';

const jwt = require('jsonwebtoken');

/**
 * Signs a JWT token for a given user payload.
 * @param {Object} payload - { id, email, role }
 * @returns {string} Signed JWT string
 */
const signToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

module.exports = { signToken };
