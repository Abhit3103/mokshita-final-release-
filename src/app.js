'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const { createCorsMiddleware } = require('./config/cors.config');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const cartRoutes = require('./routes/cart.routes');
const orderRoutes = require('./routes/order.routes');
const adminRoutes = require('./routes/admin.routes');
const uploadRoutes = require('./routes/upload.routes');
const categoryRoutes    = require('./routes/category.routes');
const subcategoryRoutes = require('./routes/subcategory.routes');
const travelRoutes      = require('./routes/travel.routes');
const contentRoutes     = require('./routes/content.routes');
const leadsRoutes       = require('./routes/leads.routes');
const navigationRoutes  = require('./routes/navigation.routes');
const paymentRoutes     = require('./routes/payment.routes');

const errorHandler      = require('./middlewares/errorHandler.middleware');
const { verifyUser }    = require('./middlewares/auth.middleware');
const pool              = require('./config/db');

const app = express();

// ─── Trust Proxy ─────────────────────────────────────────────────────────────
// REQUIRED when hosted behind a reverse proxy (Render, Railway, Nginx, etc.)
// Without this, express-rate-limit sees the proxy IP, not the real visitor IP,
// which would cause all users to share one rate-limit bucket.
app.set('trust proxy', 1);


app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ─── CORS (environment-aware — see src/config/cors.config.js) ─────────────────
app.use(createCorsMiddleware());

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── HTTP Logging ─────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Global Rate Limiter ──────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX) || 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api', globalLimiter);

// ─── Stricter Limiter for Auth ────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts, please wait 15 minutes.' },
});
app.use('/api/auth', authLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);

// Supabase JWT required for cart + orders (checkout, my-orders, COD)
app.use('/api/cart', verifyUser);
app.use('/api/orders', verifyUser);

app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/categories',    categoryRoutes);
app.use('/api/subcategories', subcategoryRoutes);
app.use('/api/travel-packages', travelRoutes);
app.use('/api/content',         contentRoutes);
app.use('/api/leads',           leadsRoutes);
app.use('/api/navigation',      navigationRoutes);
app.use('/api/payments',        paymentRoutes);      // Razorpay payment gateway


// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT NOW()');
    res.status(200).json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: 'Database unavailable'
    });
  }
});
// ─── Root Route ───────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Mokshita Enterprises Backend is running',
    status: 'OK',
    health: '/health'
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
