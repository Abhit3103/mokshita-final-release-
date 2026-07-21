'use strict';

require('dotenv').config();
const { Pool } = require('pg');

/**
 * Database Connection Pool
 * ─────────────────────────────────────────────────────────────────────────────
 * Uses DATABASE_URL only, as required for Supabase session pooling.
 * Expected format:
 *   postgresql://postgres.[ref]:[password]@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres
 */

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Set it to your Supabase Session Pooler URL.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Log pool errors to avoid crashing the server
pool.on('error', (err) => {
  console.error('❌ Unexpected DB pool error:', err.message);
});

module.exports = pool;
