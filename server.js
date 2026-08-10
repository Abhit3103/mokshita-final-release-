'use strict';

require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 5000;
const pool = require('./src/config/db');

let server;
let shuttingDown = false;

/**
 * Attempt a DB connection with retries.
 * Railway / Render can take a few seconds to establish the first connection
 * on a cold boot — retrying avoids a hard process.exit(1) on a transient error.
 */
async function connectWithRetry(maxRetries = 5, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await pool.query('SELECT NOW()');
      return;
    } catch (err) {
      if (attempt === maxRetries) {
        console.error(`❌ Database connection failed after ${maxRetries} attempts:`, err.message);
        process.exit(1);
      }
      console.warn(`⚠️  DB connection attempt ${attempt}/${maxRetries} failed — retrying in ${delayMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`Received ${signal}. Closing server...`);

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      console.log('HTTP server closed.');
    }
  } catch (err) {
    console.error('Failed to close HTTP server cleanly:', err.message);
  }

  try {
    await pool.end();
    console.log('PostgreSQL pool closed.');
  } catch (err) {
    console.error('Failed to close PostgreSQL pool cleanly:', err.message);
  }

  process.exit(0);
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

  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️  Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
