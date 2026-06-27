'use strict';

const { Pool } = require('pg');

/**
 * Database Connection Pool
 * ─────────────────────────────────────────────────────────────────────────────
 * Priority order:
 *   1. DATABASE_URL  — Supabase Transaction Pooler connection string (production)
 *      Format: postgresql://postgres.[ref]:[pass]@aws-0-*.pooler.supabase.com:6543/postgres
 *   2. Individual DB_* vars — used for local development
 *
 * NOTE: Supabase requires port 6543 (Transaction Pooler) — NOT 5432.
 * Use "Transaction pooler" connection string from:
 *   Supabase Dashboard → Project Settings → Database → Connection string → Node.js
 */

const poolConfig = process.env.DATABASE_URL
  ? {
      // ── Production / Supabase ──────────────────────────────────────────────
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,                      // Supabase free tier: max 15 connections total
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }
  : {
      // ── Local Development ──────────────────────────────────────────────────
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'mokshita_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool(poolConfig);

// Log pool errors to avoid crashing the server
pool.on('error', (err) => {
  console.error('❌ Unexpected DB pool error:', err.message);
});

module.exports = pool;
