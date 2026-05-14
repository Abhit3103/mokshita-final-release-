'use strict';

/**
 * Database Migration Script
 * Idempotently creates all tables using IF NOT EXISTS.
 * Run with: node src/config/migrate.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('./db');

const SQL = `
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
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID          REFERENCES users(id) ON DELETE SET NULL,
  order_number    VARCHAR(50)   UNIQUE NOT NULL,
  customer_name   VARCHAR(255)  NOT NULL,
  email           VARCHAR(255)  NOT NULL,
  phone           VARCHAR(20)   NOT NULL,
  address_line    TEXT          NOT NULL,
  city            VARCHAR(100)  NOT NULL,
  state           VARCHAR(100)  NOT NULL,
  pincode         VARCHAR(20)   NOT NULL,
  payment_method  VARCHAR(50)   NOT NULL DEFAULT 'COD',
  subtotal        NUMERIC(10,2) NOT NULL,
  shipping_cost   NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL,
  status          VARCHAR(20)   NOT NULL DEFAULT 'received'
                  CHECK (status IN ('received', 'shipped', 'delivered', 'cancelled')),
  tracking_note   TEXT,
  shipped_at      TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
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

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running database migrations...');
    await client.query(SQL);
    console.log('✅ All tables created/verified successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
