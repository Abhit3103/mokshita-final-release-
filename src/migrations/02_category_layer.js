'use strict';

/**
 * Migration 02: Category management layer
 * - Adds categories.featured
 * - Seeds default "Others" category
 * - Assigns uncategorized products to Others
 * - Syncs legacy products.category strings
 *
 * Run: node src/migrations/02_category_layer.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('../config/db');
const { ensureOthersCategory, migrateUncategorizedProducts } = require('../utils/category.util');

const SQL = `
ALTER TABLE categories ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running Category Layer Migration (02)...');
    await client.query('BEGIN');
    await client.query(SQL);
    await ensureOthersCategory(client);
    const others = await migrateUncategorizedProducts(client);
    await client.query('COMMIT');
    console.log(`✅ Category layer ready. Default category: ${others.name} (${others.slug})`);
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
