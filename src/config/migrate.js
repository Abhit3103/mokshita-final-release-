'use strict';

/**
 * Database Migration Script — Unified Runner
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs all migrations in order within a single database session.
 * Each migration is idempotent (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
 *
 * Order:
 *   0. Base schema      (users, products, carts, orders, leads, indexes)
 *   1. 01_schema_expansion   (categories, subcategories, travel, CMS, tags, product_images)
 *   2. 02_category_layer     (category featured flag, Others default category)
 *   3. 03_commerce_category_schema  (banner, SEO, display_order, visibility flags)
 *   4. 04_supabase_auth_identity    (users.supabase_user_id link)
 *
 * Run with: npm run migrate  OR  node src/config/migrate.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('./db');
const { ensureOthersCategory, migrateUncategorizedProducts } = require('../utils/category.util');

// ─── 0. BASE SCHEMA ──────────────────────────────────────────────────────────
const BASE_SCHEMA = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255)  UNIQUE NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  role          VARCHAR(20)   NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  full_name     VARCHAR(255),
  phone         VARCHAR(20),
  address_line  TEXT,
  city          VARCHAR(100),
  state         VARCHAR(100),
  pincode       VARCHAR(20),
  country       VARCHAR(100)  DEFAULT 'India',
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── Products ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug          VARCHAR(255)  UNIQUE NOT NULL,
  name          VARCHAR(255)  NOT NULL,
  price         NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  category      VARCHAR(100),
  stock         INTEGER       NOT NULL DEFAULT 0 CHECK (stock >= 0),
  description   TEXT,
  image_url     TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── Carts ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carts (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id)
);

-- ─── Cart Items ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cart_items (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id       UUID          NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id    UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity      INTEGER       NOT NULL DEFAULT 1 CHECK (quantity > 0),
  UNIQUE(cart_id, product_id)
);

-- ─── Orders ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID          REFERENCES users(id) ON DELETE SET NULL,
  order_number        VARCHAR(50)   UNIQUE NOT NULL,
  customer_name       VARCHAR(255)  NOT NULL,
  email               VARCHAR(255)  NOT NULL,
  phone               VARCHAR(20)   NOT NULL,
  address_line        TEXT          NOT NULL,
  city                VARCHAR(100)  NOT NULL,
  state               VARCHAR(100)  NOT NULL,
  pincode             VARCHAR(20)   NOT NULL,
  payment_method      VARCHAR(50)   NOT NULL DEFAULT 'COD',
  subtotal            NUMERIC(10,2) NOT NULL,
  shipping_cost       NUMERIC(10,2) NOT NULL DEFAULT 0,
  total               NUMERIC(10,2) NOT NULL,
  status              VARCHAR(30)   NOT NULL DEFAULT 'received'
                      CHECK (status IN ('received', 'pending_payment', 'payment_failed', 'shipped', 'delivered', 'cancelled')),
  razorpay_order_id   VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  razorpay_signature  VARCHAR(255),
  tracking_note       TEXT,
  shipped_at          TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── Order Items ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      UUID          REFERENCES products(id) ON DELETE SET NULL,
  quantity        INTEGER       NOT NULL CHECK (quantity > 0),
  price_at_time   NUMERIC(10,2) NOT NULL
);

-- ─── Leads ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255)  NOT NULL,
  email           VARCHAR(255)  NOT NULL,
  phone           VARCHAR(50),
  interest        VARCHAR(100),
  item            VARCHAR(255),
  message         TEXT          NOT NULL,
  source          VARCHAR(50)   DEFAULT 'contact_form',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── Indexes for performance ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id      ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id    ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id          ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status           ON orders(status);
CREATE INDEX IF NOT EXISTS idx_products_slug           ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category       ON products(category);
`;

// ─── 1. SCHEMA EXPANSION ─────────────────────────────────────────────────────
const MIGRATION_01 = `
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

CREATE TABLE IF NOT EXISTS product_images (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id    UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url     TEXT        NOT NULL,
  alt_text      VARCHAR(255),
  display_order INTEGER     DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tags (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100)  UNIQUE NOT NULL,
  slug        VARCHAR(100)  UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_tags (
  product_id  UUID  NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_id      UUID  NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);

CREATE TABLE IF NOT EXISTS travel_packages (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255)  NOT NULL,
  slug        VARCHAR(255)  UNIQUE NOT NULL,
  duration    VARCHAR(100)  NOT NULL,
  location    VARCHAR(255)  NOT NULL,
  price       NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  description TEXT,
  highlights  JSONB         DEFAULT '[]'::jsonb,
  image_url   TEXT,
  featured    BOOLEAN       DEFAULT false,
  status      VARCHAR(20)   DEFAULT 'active',
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_content (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_key   VARCHAR(100)  UNIQUE NOT NULL,
  content       JSONB         NOT NULL,
  last_updated  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category_id     ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_subcategory_id  ON products(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_travel_packages_slug     ON travel_packages(slug);
CREATE INDEX IF NOT EXISTS idx_site_content_section_key ON site_content(section_key);
`;

// ─── 2. CATEGORY LAYER ────────────────────────────────────────────────────────
const MIGRATION_02 = `
ALTER TABLE categories ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
`;

// ─── 3. COMMERCE CATEGORY SCHEMA ─────────────────────────────────────────────
const MIGRATION_03 = `
ALTER TABLE categories ADD COLUMN IF NOT EXISTS short_description VARCHAR(500);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS seo_title VARCHAR(255);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS seo_description VARCHAR(500);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS homepage_visible BOOLEAN DEFAULT true;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS navigation_visible BOOLEAN DEFAULT true;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS seo_title VARCHAR(255);
ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS seo_description VARCHAR(500);
ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_categories_display_order       ON categories(display_order DESC);
CREATE INDEX IF NOT EXISTS idx_categories_homepage_visible    ON categories(homepage_visible) WHERE homepage_visible = true;
CREATE INDEX IF NOT EXISTS idx_categories_navigation_visible  ON categories(navigation_visible) WHERE navigation_visible = true;
CREATE INDEX IF NOT EXISTS idx_categories_featured_order      ON categories(featured, display_order DESC);
CREATE INDEX IF NOT EXISTS idx_subcategories_category_featured ON subcategories(category_id, featured);
CREATE INDEX IF NOT EXISTS idx_subcategories_display_order    ON subcategories(category_id, display_order);

UPDATE categories    SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE subcategories SET updated_at = created_at WHERE updated_at IS NULL;
`;

// ─── 4. SUPABASE AUTH IDENTITY ───────────────────────────────────────────────
const MIGRATION_04 = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_user_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_supabase_user_id
ON users(supabase_user_id)
WHERE supabase_user_id IS NOT NULL;
`;

// ─── 5. (05 was a data seed — no schema changes) ──────────────────────────────

// ─── 6. ORDERS — RAZORPAY PAYMENT COLUMNS ────────────────────────────────────
const MIGRATION_06 = `
-- Add Razorpay columns to orders (safe, idempotent — COD orders unaffected)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_order_id   TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_signature  TEXT;

-- Extend status CHECK to cover Razorpay lifecycle values
DO $$
BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
EXCEPTION WHEN others THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN (
      'pending_payment', 'received', 'payment_failed',
      'processing', 'shipped', 'out_for_delivery',
      'delivered', 'cancelled', 'refunded'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id
  ON orders(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_razorpay_payment_id
  ON orders(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
`;

// ─── RUNNER ──────────────────────────────────────────────────────────────────
async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Mokshita — Starting unified database migration...\n');

    await client.query('BEGIN');

    console.log('  [0/4] Running base schema (users, products, carts, orders, leads)...');
    await client.query(BASE_SCHEMA);
    console.log('  ✅ Base schema ready.\n');

    console.log('  [1/4] Running migration 01 — schema expansion (categories, product_images, travel, CMS)...');
    await client.query(MIGRATION_01);
    console.log('  ✅ Migration 01 complete.\n');

    console.log('  [2/4] Running migration 02 — category layer (featured flag, Others category)...');
    await client.query(MIGRATION_02);
    await ensureOthersCategory(client);
    await migrateUncategorizedProducts(client);
    console.log('  ✅ Migration 02 complete — "Others" category bootstrapped.\n');

    console.log('  [3/4] Running migration 03 — commerce category schema (SEO, banners, display_order)...');
    await client.query(MIGRATION_03);
    console.log('  ✅ Migration 03 complete.\n');

    console.log('  [4/5] Running migration 04 — Supabase auth identity (supabase_user_id)...');
    await client.query(MIGRATION_04);
    console.log('  ✅ Migration 04 complete.\n');

    console.log('  [5/5] Running migration 06 — orders Razorpay columns...');
    await client.query(MIGRATION_06);
    console.log('  ✅ Migration 06 complete.\n');

    await client.query('COMMIT');

    console.log('🎉 All migrations complete. Database is production-ready.');
    console.log('   Next step: run  npm run db:seed  to populate categories, CMS, and travel data.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed — all changes rolled back.');
    console.error('   Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
