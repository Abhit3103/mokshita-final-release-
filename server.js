'use strict';

require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 3000;
const pool = require('./src/config/db');

/**
 * Attempt a DB connection with retries.
 * Railway / Render can take a few seconds to establish the first connection
 * on a cold boot — retrying avoids a hard process.exit(1) on a transient error.
 */
async function connectWithRetry(maxRetries = 5, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await pool.query('SELECT NOW()');
      return; // success
    } catch (err) {
      if (attempt === maxRetries) {
        console.error(`❌ Database connection failed after ${maxRetries} attempts:`, err.message);
        process.exit(1);
      }
      console.warn(`⚠️  DB connection attempt ${attempt}/${maxRetries} failed — retrying in ${delayMs / 1000}s...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function start() {
  await connectWithRetry();

  console.log('✅ PostgreSQL connected successfully');

  const { ensureOthersCategory, migrateUncategorizedProducts } = require('./src/utils/category.util');
  try {
    await ensureOthersCategory();
    await migrateUncategorizedProducts();
    console.log('✅ Category layer verified (Others + sync)');
  } catch (catErr) {
    console.warn('⚠️  Category bootstrap skipped:', catErr.message);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Mokshita API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
}

start();

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️  Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
