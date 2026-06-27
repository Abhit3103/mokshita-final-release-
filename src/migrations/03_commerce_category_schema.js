'use strict';

/**
 * Migration 03: Commerce Category Schema
 * ─────────────────────────────────────────────────────────────────────────────
 * Enriches categories and subcategories tables with commerce browsing fields.
 *
 * SAFE: All operations use ADD COLUMN IF NOT EXISTS.
 * IDEMPOTENT: Safe to re-run multiple times.
 * NO BREAKING CHANGES: Zero existing queries affected.
 *
 * Run: node src/migrations/03_commerce_category_schema.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('../config/db');

const SQL = `
-- ─── 1. ENRICH CATEGORIES TABLE ───────────────────────────────────────────────

-- Short tagline for category cards (homepage / nav)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS short_description VARCHAR(500);

-- Hero/banner image for category landing pages
ALTER TABLE categories ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Admin-controlled display ordering (higher = shown first)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- SEO override fields
ALTER TABLE categories ADD COLUMN IF NOT EXISTS seo_title VARCHAR(255);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS seo_description VARCHAR(500);

-- Storefront visibility controls
ALTER TABLE categories ADD COLUMN IF NOT EXISTS homepage_visible BOOLEAN DEFAULT true;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS navigation_visible BOOLEAN DEFAULT true;

-- Audit timestamp
ALTER TABLE categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ─── 2. ENRICH SUBCATEGORIES TABLE ────────────────────────────────────────────

-- Thumbnail for subcategory cards
ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Featured within parent category page
ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;

-- Admin-controlled ordering within parent category
ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- SEO override fields
ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS seo_title VARCHAR(255);
ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS seo_description VARCHAR(500);

-- Audit timestamp
ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ─── 3. PERFORMANCE INDEXES ───────────────────────────────────────────────────

-- Category browsing indexes
CREATE INDEX IF NOT EXISTS idx_categories_display_order      ON categories(display_order DESC);
CREATE INDEX IF NOT EXISTS idx_categories_homepage_visible   ON categories(homepage_visible) WHERE homepage_visible = true;
CREATE INDEX IF NOT EXISTS idx_categories_navigation_visible ON categories(navigation_visible) WHERE navigation_visible = true;
CREATE INDEX IF NOT EXISTS idx_categories_featured_order     ON categories(featured, display_order DESC);

-- Subcategory browsing indexes
CREATE INDEX IF NOT EXISTS idx_subcategories_category_featured ON subcategories(category_id, featured);
CREATE INDEX IF NOT EXISTS idx_subcategories_display_order     ON subcategories(category_id, display_order);

-- ─── 4. BACKFILL updated_at WHERE NULL ───────────────────────────────────────

UPDATE categories    SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE subcategories SET updated_at = created_at WHERE updated_at IS NULL;
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running Commerce Category Schema Migration (03)...');
    await client.query('BEGIN');
    await client.query(SQL);
    await client.query('COMMIT');
    console.log('✅ Commerce category schema migration completed successfully.');
    console.log('   Added to categories:    short_description, banner_url, display_order, seo_title, seo_description, homepage_visible, navigation_visible, updated_at');
    console.log('   Added to subcategories: image_url, featured, display_order, seo_title, seo_description, updated_at');
    console.log('   Added 6 new performance indexes.');
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
