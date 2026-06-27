'use strict';
/**
 * Master Seed Runner — runs all seed files in the correct dependency order.
 *
 * Order matters:
 *   1. seed-subcategories.js  → Seeds categories + subcategories (dependencies for products)
 *   2. seed-cms-content.js    → Seeds CMS sections (homepage hero, stats, footer, etc.)
 *   3. seed-travel-content.js → Seeds travel packages
 *   4. seed-product-images.js → Seeds product gallery images (requires products to exist)
 *
 * Run with: npm run db:seed  OR  node src/seeds/seed-all.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const seeds = [
  { name: 'Categories & Subcategories', file: './seed-subcategories' },
  { name: 'CMS Content',               file: './seed-cms-content' },
  { name: 'Travel Packages',           file: './seed-travel-content' },
  { name: 'Product Images',            file: './seed-product-images' },
];

async function runAllSeeds() {
  console.log('🌱 Mokshita — Starting database seed...\n');

  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i];
    console.log(`  [${i + 1}/${seeds.length}] Seeding: ${seed.name}...`);
    try {
      // Each seed module must export a function called `seed()`
      // or will be required and executed (self-invoking pattern).
      // We dynamically require and await the seed function if exported.
      const mod = require(seed.file);
      if (typeof mod === 'function') {
        await mod();
      } else if (mod && typeof mod.seed === 'function') {
        await mod.seed();
      }
      // If module is self-invoking (IIFE), it runs on require().
      console.log(`  ✅ ${seed.name} seeded.\n`);
    } catch (err) {
      console.error(`  ⚠️  ${seed.name} seed failed (non-fatal): ${err.message}\n`);
      // Non-fatal — continue with remaining seeds
    }
  }

  console.log('🎉 Seed complete.\n');
  console.log('   Your database now has categories, CMS content, travel packages,');
  console.log('   and product images ready for the storefront.\n');
  process.exit(0);
}

runAllSeeds().catch(err => {
  console.error('❌ Seed runner failed:', err.message);
  process.exit(1);
});
