'use strict';

/**
 * Seed subcategories from the actual product data in the DB.
 * Run once: node src/seeds/seed-subcategories.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('../config/db');

function slugify(str) {
  return str.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Subcategory definitions derived from the actual product data + business context
const subcategoryMap = [
  // category_slug → subcategories
  { category: 'zardozi',      name: 'Ornaments',      description: 'Decorative Zardozi ornament pieces' },
  { category: 'zardozi',      name: 'Accessories',    description: 'Zardozi coin purses and wearable pieces' },
  { category: 'crochet',      name: 'Dolls & Animals',description: 'Crochet dolls, turtles and figures' },
  { category: 'crochet',      name: 'Keyrings',       description: 'Crochet keyrings and accessories' },
  { category: 'paintings',    name: 'Watercolour',    description: 'Original watercolour artworks' },
  { category: 'paintings',    name: 'Pichwai',        description: 'Traditional Pichwai devotional paintings' },
  { category: 'marble-decor', name: 'Inlay Work',     description: 'Pietra dura stone inlay on marble' },
  { category: 'marble-decor', name: 'Decorative',     description: 'Marble coasters, plates and decor' },
  { category: 'wooden-items', name: 'Idols',          description: 'Hand-carved wooden religious idols' },
  { category: 'wooden-items', name: 'Novelties',      description: 'Wooden novelty and giftable items' },
  { category: 'textile',      name: 'Pouches & Bags', description: 'Hand-painted fabric pouches and bags' },
];

// Map specific products to subcategories (by product slug)
const productSubcategoryMap = [
  // Zardozi Ornaments
  { slug: 'zardozi-double-elephant', subcat: 'Ornaments', cat: 'zardozi' },
  { slug: 'zardozi-elephant',        subcat: 'Ornaments', cat: 'zardozi' },
  { slug: 'zardozi-camel',           subcat: 'Ornaments', cat: 'zardozi' },
  { slug: 'zardozi-carrot',          subcat: 'Ornaments', cat: 'zardozi' },
  { slug: 'zardozi-elephant-trunk',  subcat: 'Ornaments', cat: 'zardozi' },
  { slug: 'zardozi-tiger',           subcat: 'Ornaments', cat: 'zardozi' },
  { slug: 'zardozi-tuk-tuk',         subcat: 'Ornaments', cat: 'zardozi' },
  { slug: 'zardozi-halloween',       subcat: 'Ornaments', cat: 'zardozi' },
  // Zardozi Accessories
  { slug: 'zardozi-coin-purse',      subcat: 'Accessories', cat: 'zardozi' },
  // Crochet Dolls & Animals
  { slug: 'crochet-doll',            subcat: 'Dolls & Animals', cat: 'crochet' },
  { slug: 'crochet-turtle',          subcat: 'Dolls & Animals', cat: 'crochet' },
  // Crochet Keyrings
  { slug: 'sunflower-keyring',       subcat: 'Keyrings', cat: 'crochet' },
  // Paintings
  { slug: 'taj-mahal-watercolour',   subcat: 'Watercolour', cat: 'paintings' },
  { slug: 'watercolour-mini',        subcat: 'Watercolour', cat: 'paintings' },
  { slug: 'pichwai-art',             subcat: 'Pichwai', cat: 'paintings' },
  // Marble
  { slug: 'marble-tortoise',         subcat: 'Inlay Work',   cat: 'marble-decor' },
  { slug: 'coaster-plates',          subcat: 'Decorative',   cat: 'marble-decor' },
  // Wooden
  { slug: 'wooden-ganesha',          subcat: 'Idols',      cat: 'wooden-items' },
  { slug: 'wooden-dice',             subcat: 'Novelties',  cat: 'wooden-items' },
  // Textile
  { slug: 'elephant-pouch',          subcat: 'Pouches & Bags', cat: 'textile' },
];

async function seedSubcategories() {
  const client = await pool.connect();
  try {
    console.log('🔄 Seeding subcategories...');
    await client.query('BEGIN');

    // 1. Insert subcategory rows
    const subcatIds = {}; // "cat_slug:subcat_name" → uuid
    for (const sc of subcategoryMap) {
      const catRes = await client.query('SELECT id FROM categories WHERE slug = $1', [sc.category]);
      if (catRes.rows.length === 0) {
        console.warn(`  ⚠️  Category not found: ${sc.category} — skipping`);
        continue;
      }
      const catId = catRes.rows[0].id;
      const scSlug = slugify(sc.name);

      const res = await client.query(
        `INSERT INTO subcategories (category_id, name, slug, description)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (category_id, slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
         RETURNING id`,
        [catId, sc.name, scSlug, sc.description]
      );
      subcatIds[`${sc.category}:${sc.name}`] = res.rows[0].id;
      console.log(`  ✅ Subcategory: ${sc.category} / ${sc.name} [${scSlug}]`);
    }

    // 2. Link products to subcategories
    let linked = 0;
    for (const entry of productSubcategoryMap) {
      const subcatId = subcatIds[`${entry.cat}:${entry.subcat}`];
      if (!subcatId) { console.warn(`  ⚠️  Subcategory ID not found for ${entry.cat}:${entry.subcat}`); continue; }

      const res = await client.query(
        'UPDATE products SET subcategory_id = $1, subcategory = $2 WHERE slug = $3 RETURNING slug',
        [subcatId, entry.subcat, entry.slug]
      );
      if (res.rows.length > 0) { linked++; }
    }
    console.log(`  ✅ ${linked} products linked to subcategories.`);

    await client.query('COMMIT');
    console.log('✅ Subcategory seeding complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedSubcategories();
