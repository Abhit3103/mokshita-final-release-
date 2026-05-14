'use strict';

/**
 * Middleware: isAdmin
 * Must be used AFTER authenticateToken.
 * Restricts access to users with role === 'admin'.
 */
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden. Admin access required.' });
  }

  next();
};

module.exports = { isAdmin };
