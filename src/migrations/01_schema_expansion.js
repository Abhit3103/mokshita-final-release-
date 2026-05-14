'use strict';

/**
 * Migration 01: Schema Expansion
 * Adds categories, subcategories, travel_packages, site_content, tags, product_tags, product_images.
 * Expands products table with new fields.
 * Safely idempotent (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('../config/db');

const SQL = `
-- 1. CATEGORIES & SUBCATEGORIES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255)  UNIQUE NOT NULL,
  slug        VARCHAR(255)  UNIQUE NOT NULL,
  description TEXT,
  image_url   TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subcategories (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID          NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name        VARCHAR(255)  NOT NULL,
  slug        VARCHAR(255)  NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(category_id, slug)
);

-- 2. EXTEND PRODUCTS TABLE ────────────────────────────────────────────────────
-- Note: Some of these might already exist from the CSV seed script.
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES subcategories(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS short_description VARCHAR(500);
ALTER TABLE products ADD COLUMN IF NOT EXISTS artisan_story TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS care_instructions TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(50);
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS compare_price NUMERIC(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS material VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS region VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS dimensions VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS tags TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- 3. PRODUCT IMAGES (Gallery) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_images (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url   TEXT          NOT NULL,
  alt_text    VARCHAR(255),
  display_order INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 4. TAGS SYSTEM (Normalized) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100)  UNIQUE NOT NULL,
  slug        VARCHAR(100)  UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_tags (
  product_id  UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_id      UUID          NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);

-- 5. TRAVEL PACKAGES ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS travel_packages (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255)  NOT NULL,
  slug        VARCHAR(255)  UNIQUE NOT NULL,
  duration    VARCHAR(100)  NOT NULL,
  location    VARCHAR(255)  NOT NULL,
  price       NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  description TEXT,
  highlights  JSONB         DEFAULT '[]'::jsonb, -- Array of strings
  image_url   TEXT,
  featured    BOOLEAN       DEFAULT false,
  status      VARCHAR(20)   DEFAULT 'active',
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 6. SITE / CMS CONTENT ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_content (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_key   VARCHAR(100)  UNIQUE NOT NULL, -- e.g., 'homepage_hero', 'founder_quote'
  content       JSONB         NOT NULL,        -- Stores structured content (title, text, image, etc.)
  last_updated  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_subcategory_id ON products(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_travel_packages_slug ON travel_packages(slug);
CREATE INDEX IF NOT EXISTS idx_site_content_section_key ON site_content(section_key);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running Schema Expansion Migration...');
    await client.query('BEGIN');
    await client.query(SQL);
    await client.query('COMMIT');
    console.log('✅ Schema expansion completed successfully.');
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
