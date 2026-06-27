'use strict';

/**
 * Category system integrity checks (run from mokshita-new-backend):
 *   node scripts/validate-category-system.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../src/config/db');

const OTHERS_SLUG = 'others';
let passed = 0;
let failed = 0;

function ok(msg) { passed++; console.log(`  ✅ ${msg}`); }
function fail(msg) { failed++; console.error(`  ❌ ${msg}`); }

async function run() {
  console.log('\n=== Mokshita Category System Validation ===\n');

  const client = await pool.connect();
  try {
    const others = await client.query(
      `SELECT id, name, slug FROM categories WHERE slug = $1`,
      [OTHERS_SLUG]
    );
    if (others.rows.length === 1) ok('Others category exists');
    else fail('Others category missing — run migration 02_category_layer.js');

    const nullCat = await client.query(
      `SELECT COUNT(*)::int AS n FROM products WHERE category_id IS NULL`
    );
    if (nullCat.rows[0].n === 0) ok('All products have category_id');
    else fail(`${nullCat.rows[0].n} products missing category_id`);

    const orphanSub = await client.query(
      `SELECT COUNT(*)::int AS n FROM products p
       WHERE p.subcategory_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM subcategories sc WHERE sc.id = p.subcategory_id)`
    );
    if (orphanSub.rows[0].n === 0) ok('No orphan subcategory_id on products');
    else fail(`${orphanSub.rows[0].n} products with invalid subcategory_id`);

    const dupSlug = await client.query(
      `SELECT slug, COUNT(*) FROM categories GROUP BY slug HAVING COUNT(*) > 1`
    );
    if (dupSlug.rows.length === 0) ok('Category slugs unique');
    else fail(`Duplicate category slugs: ${dupSlug.rows.map((r) => r.slug).join(', ')}`);

    const cats = await client.query(
      `SELECT c.slug, COUNT(p.id)::int AS n
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       GROUP BY c.slug ORDER BY c.slug`
    );
    console.log('\n  Product counts by category:');
    cats.rows.forEach((r) => console.log(`     ${r.slug}: ${r.n}`));

    const subCount = await client.query(`SELECT COUNT(*)::int AS n FROM subcategories`);
    ok(`${subCount.rows[0].n} subcategories defined`);

    const legacySync = await client.query(
      `SELECT COUNT(*)::int AS n FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.category IS DISTINCT FROM c.name AND p.category IS NOT NULL`
    );
    if (legacySync.rows[0].n === 0) ok('Legacy category string synced with relational name');
    else console.log(`  ⚠️  ${legacySync.rows[0].n} products with legacy category string drift (non-blocking)`);

  } finally {
    client.release();
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
