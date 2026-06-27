'use strict';

require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 3000;

// Test DB connection on startup
const pool = require('./src/config/db');

pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  }

  console.log('✅ PostgreSQL connected successfully');

  const { ensureOthersCategory, migrateUncategorizedProducts } = require('./src/utils/category.util');
  ensureOthersCategory()
    .then(() => migrateUncategorizedProducts())
    .then(() => console.log('✅ Category layer verified (Others + sync)'))
    .catch((catErr) => console.warn('⚠️  Category bootstrap skipped:', catErr.message));

  app.listen(PORT, () => {
    console.log(`🚀 Mokshita API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️  Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
