'use strict';

/**
 * CSV Seed Script
 * Imports data from "New folder" CSVs into mokshita_db.
 * Run with: node seed-from-csv.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const CSV_DIR = path.join(__dirname, 'New folder');

// ── helpers ──────────────────────────────────────────────────────────────────

function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.replace(/\r/g, '').split('\n').filter(Boolean);
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    return Object.fromEntries(headers.map((h, i) => [h.trim(), (vals[i] || '').trim()]));
  });
}

function nullIf(val) {
  return val === '' || val === undefined ? null : val;
}

// ── step 1 : ensure leads table exists ───────────────────────────────────────

async function ensureLeadsTable(client) {
  console.log('\n📋 Ensuring leads table exists...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
      created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      name        VARCHAR(255),
      email       VARCHAR(255),
      phone       VARCHAR(30),
      interest    VARCHAR(100),
      item        TEXT,
      message     TEXT,
      status      VARCHAR(50)   DEFAULT 'NEW'
    );
  `);
  console.log('  ✅ leads table ready.');
}

// ── step 2 : ensure extra product columns exist ───────────────────────────────

async function ensureProductColumns(client) {
  console.log('\n📋 Ensuring extra product columns exist...');
  const extra = [
    { col: 'sku',           def: 'VARCHAR(50)'  },
    { col: 'subcategory',   def: 'VARCHAR(100)' },
    { col: 'compare_price', def: 'NUMERIC(10,2)'},
    { col: 'material',      def: 'VARCHAR(100)' },
    { col: 'region',        def: 'VARCHAR(100)' },
    { col: 'dimensions',    def: 'VARCHAR(255)' },
    { col: 'tags',          def: 'TEXT'         },
    { col: 'featured',      def: 'BOOLEAN DEFAULT false' },
    { col: 'status',        def: "VARCHAR(20) DEFAULT 'active'" },
  ];
  for (const { col, def } of extra) {
    await client.query(
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS ${col} ${def};`
    );
  }
  console.log('  ✅ Product columns ready.');
}

// ── step 3 : seed products ────────────────────────────────────────────────────

async function seedProducts(client) {
  console.log('\n📦 Seeding products...');
  const rows = parseCSV(path.join(CSV_DIR, 'products_rows.csv'));
  let inserted = 0, skipped = 0;

  for (const r of rows) {
    const res = await client.query(
      `INSERT INTO products
         (id, name, slug, sku, category, subcategory, description,
          price, compare_price, stock, material, region, dimensions,
          tags, image_url, featured, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (id) DO NOTHING`,
      [
        r.id, r.name, r.slug, nullIf(r.sku), nullIf(r.category),
        nullIf(r.subcategory), nullIf(r.description),
        parseFloat(r.price) || 0,
        nullIf(r.compare_price) ? parseFloat(r.compare_price) : null,
        parseInt(r.stock) || 0,
        nullIf(r.material), nullIf(r.region), nullIf(r.dimensions),
        nullIf(r.tags), nullIf(r.image_url),
        r.featured === 'true',
        r.status || 'active',
        r.created_at || new Date().toISOString(),
      ]
    );
    res.rowCount > 0 ? inserted++ : skipped++;
  }
  console.log(`  ✅ products → ${inserted} inserted, ${skipped} already existed.`);
  return { inserted, skipped, total: rows.length };
}

// ── step 4 : ensure ghost users for cart FK constraints ───────────────────────

async function ensureGhostUsers(client, userIds) {
  console.log('\n👻 Ensuring ghost users for cart FK references...');
  let created = 0;
  for (const uid of userIds) {
    const res = await client.query(
      `INSERT INTO users (id, email, password_hash, role)
       VALUES ($1, $2, 'GHOST_NO_LOGIN', 'customer')
       ON CONFLICT (id) DO NOTHING`,
      [uid, `ghost_${uid.slice(0, 8)}@imported.local`]
    );
    if (res.rowCount > 0) created++;
  }
  console.log(`  ✅ ${created} ghost user(s) created (others already existed).`);
}

// ── step 5 : seed carts ───────────────────────────────────────────────────────

async function seedCarts(client) {
  console.log('\n🛒 Seeding carts...');
  const rows = parseCSV(path.join(CSV_DIR, 'carts_rows.csv'));

  // Make sure all referenced user_ids exist
  const userIds = [...new Set(rows.map(r => r.user_id))];
  await ensureGhostUsers(client, userIds);

  // Ensure created_at column
  await client.query(
    `ALTER TABLE carts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`
  );

  let inserted = 0, skipped = 0;
  for (const r of rows) {
    const res = await client.query(
      `INSERT INTO carts (id, user_id, created_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [r.id, r.user_id, r.created_at || new Date().toISOString()]
    );
    res.rowCount > 0 ? inserted++ : skipped++;
  }
  console.log(`  ✅ carts → ${inserted} inserted, ${skipped} already existed.`);
  return { inserted, skipped, total: rows.length };
}

// ── step 6 : seed cart_items ──────────────────────────────────────────────────

async function seedCartItems(client) {
  console.log('\n🧺 Seeding cart_items...');
  const rows = parseCSV(path.join(CSV_DIR, 'cart_items_rows.csv'));

  // Ensure added_at column
  await client.query(
    `ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ DEFAULT NOW();`
  );

  let inserted = 0, skipped = 0;
  for (const r of rows) {
    const res = await client.query(
      `INSERT INTO cart_items (id, cart_id, product_id, quantity, added_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [r.id, r.cart_id, r.product_id, parseInt(r.quantity) || 1, r.added_at || new Date().toISOString()]
    );
    res.rowCount > 0 ? inserted++ : skipped++;
  }
  console.log(`  ✅ cart_items → ${inserted} inserted, ${skipped} already existed.`);
  return { inserted, skipped, total: rows.length };
}

// ── step 7 : seed leads ───────────────────────────────────────────────────────

async function seedLeads(client) {
  console.log('\n📬 Seeding leads...');
  const rows = parseCSV(path.join(CSV_DIR, 'leads_rows.csv'));
  let inserted = 0, skipped = 0;

  for (const r of rows) {
    const res = await client.query(
      `INSERT INTO leads (id, created_at, name, email, phone, interest, item, message, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO NOTHING`,
      [
        r.id, r.created_at || new Date().toISOString(),
        nullIf(r.name), nullIf(r.email), nullIf(r.phone),
        nullIf(r.interest), nullIf(r.item), nullIf(r.message),
        r.status || 'NEW',
      ]
    );
    res.rowCount > 0 ? inserted++ : skipped++;
  }
  console.log(`  ✅ leads → ${inserted} inserted, ${skipped} already existed.`);
  return { inserted, skipped, total: rows.length };
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 CSV Seed Script — mokshita_db');
  console.log('='.repeat(50));

  const client = await pool.connect();
  const report = {};

  try {
    await client.query('BEGIN');

    await ensureLeadsTable(client);
    await ensureProductColumns(client);

    report.products   = await seedProducts(client);
    report.carts      = await seedCarts(client);
    report.cart_items = await seedCartItems(client);
    report.leads      = await seedLeads(client);

    await client.query('COMMIT');

    console.log('\n' + '='.repeat(50));
    console.log('✅ ALL DONE — Summary:');
    console.log('='.repeat(50));

    const csvFiles = ['products_rows.csv', 'carts_rows.csv', 'cart_items_rows.csv', 'leads_rows.csv'];
    console.log('\n📁 Files processed:');
    csvFiles.forEach(f => console.log(`  ✅ ${f}`));

    console.log('\n📊 Row counts:');
    for (const [table, stats] of Object.entries(report)) {
      console.log(`  ${table.padEnd(15)} → total: ${stats.total}, inserted: ${stats.inserted}, skipped: ${stats.skipped}`);
    }

    console.log('\n⚠️  Tables with NO CSV data (may need manual updates):');
    const noCsvTables = ['users', 'orders', 'order_items'];
    noCsvTables.forEach(t => console.log(`  ❌ ${t} — no CSV provided`));

    console.log('\n💡 Note: "carts" ghost users created with password_hash=GHOST_NO_LOGIN.');
    console.log('   These cannot log in. Replace with real users when available.\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Seed failed — rolled back all changes.');
    console.error('   Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
