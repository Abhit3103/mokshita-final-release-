'use strict';

/**
 * Migration 04: Supabase Auth Identity Link
 * ─────────────────────────────────────────────────────────────────────────────
 * Adds a nullable supabase_user_id column to the users table and creates a
 * unique index for the auth identity mapping used by the Supabase migration.
 *
 * SAFE: All operations use IF NOT EXISTS.
 * IDEMPOTENT: Safe to re-run multiple times.
 *
 * Run: node src/migrations/04_supabase_auth_identity.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('../config/db');

const SQL = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_user_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_supabase_user_id
ON users(supabase_user_id)
WHERE supabase_user_id IS NOT NULL;
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running Supabase Auth Identity Migration (04)...');
    await client.query('BEGIN');
    await client.query(SQL);
    await client.query('COMMIT');
    console.log('✅ Supabase auth identity migration completed successfully.');
    console.log('   Added users.supabase_user_id and unique index.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
