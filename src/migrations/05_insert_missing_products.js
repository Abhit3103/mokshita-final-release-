'use strict';

/**
 * Migration 05: Insert Missing Products
 * ─────────────────────────────────────────────────────────────────────────────
 * Inserts the 4 products that exist locally in products.js but are missing
 * from the backend database catalog. Also seeds their corresponding product images.
 *
 * Safe and idempotent using ON CONFLICT DO NOTHING.
 *
 * Run: node src/migrations/05_insert_missing_products.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('../config/db');

async function migrate() {
  const client = pool; // use global pool
  try {
    console.log('🔄 Running Migration (05) — Inserting missing products...');
    
    // 1. Fetch category and subcategory IDs dynamically to prevent env mismatches
    const categoriesRes = await client.query('SELECT id, slug, name FROM categories');
    const categories = categoriesRes.rows;
    
    const subcategoriesRes = await client.query('SELECT id, slug, name, category_id FROM subcategories');
    const subcategories = subcategoriesRes.rows;

    const findCategory = (slug) => categories.find(c => c.slug === slug);
    const findSubcategory = (slug) => subcategories.find(s => s.slug === slug);

    const paintingsCat = findCategory('paintings');
    const marbleCat = findCategory('marble-decor');

    if (!paintingsCat || !marbleCat) {
      throw new Error('Required categories "Paintings" or "Marble Decor" are missing from database.');
    }

    const watercolourSub = findSubcategory('watercolour');
    const pichwaiSub = findSubcategory('pichwai');
    const inlaySub = findSubcategory('inlay-work');

    if (!watercolourSub || !pichwaiSub || !inlaySub) {
      throw new Error('Required subcategories "Watercolour", "Pichwai", or "Inlay Work" are missing from database.');
    }

    // 2. Define products list
    const productsToInsert = [
      {
        id: '151a358a-5f01-4c3d-9f67-3d0b1fcf843e',
        name: 'Taj Mahal Watercolour',
        slug: 'taj-mahal-watercolour',
        sku: 'ME001',
        category: paintingsCat.name,
        subcategory: watercolourSub.name,
        category_id: paintingsCat.id,
        subcategory_id: watercolourSub.id,
        description: 'Exquisite hand-painted Taj Mahal watercolour on A5 archival paper, bringing the monument of love to life. Delicate brushstrokes capture the ethereal beauty of the marble facade against a serene sky.',
        price: 600.00,
        compare_price: 850.00,
        stock: 10,
        material: 'Paper',
        region: 'Agra',
        image_url: 'images/items/watercolourtajmahal1.jpeg'
      },
      {
        id: 'b10a4a2f-4344-42a2-a4dd-fc6dcd9c54e7',
        name: 'Pichwai Art',
        slug: 'pichwai-art',
        sku: 'ME002',
        category: paintingsCat.name,
        subcategory: pichwaiSub.name,
        category_id: paintingsCat.id,
        subcategory_id: pichwaiSub.id,
        description: "Devotional paintings depicting Lord Krishna's life, crafted on handwoven cotton cloth with natural pigments.",
        price: 650.00,
        compare_price: 900.00,
        stock: 10,
        material: 'Paper',
        region: 'Nathdwara',
        image_url: 'images/items/pichwai art3.jpeg'
      },
      {
        id: 'eefd54e1-09c7-4117-b464-3b196f51e5a2',
        name: 'Watercolour Mini',
        slug: 'watercolour-mini',
        sku: 'ME003',
        category: paintingsCat.name,
        subcategory: watercolourSub.name,
        category_id: paintingsCat.id,
        subcategory_id: watercolourSub.id,
        description: 'Delicate miniature-inspired watercolours, perfect for elegant home decor and gifting.',
        price: 300.00,
        compare_price: null,
        stock: 10,
        material: 'Paper',
        region: 'Jaipur',
        image_url: 'images/items/watercolourpaint3.jpeg'
      },
      {
        id: 'f2d83731-cb8d-43aa-b711-95b2a0dc60f4',
        name: 'Marble Tortoise',
        slug: 'marble-tortoise',
        sku: 'ME004',
        category: marbleCat.name,
        subcategory: inlaySub.name,
        category_id: marbleCat.id,
        subcategory_id: inlaySub.id,
        description: 'Finely carved Makrana marble tortoise with authentic pietra dura stone inlay work.',
        price: 430.00,
        compare_price: null,
        stock: 10,
        material: 'Makrana Marble',
        region: 'Agra',
        image_url: 'images/items/Handcrafted marble plates with floral design (1).png'
      }
    ];

    // 3. Define product images
    const imagesToInsert = [
      { slug: 'taj-mahal-watercolour', images: ['images/items/watercolourtajmahal1.jpeg'] },
      { slug: 'pichwai-art', images: ['images/items/pichwai art3.jpeg'] },
      { slug: 'watercolour-mini', images: ['images/items/watercolourpaint3.jpeg', 'images/items/tajmahalblue.jpeg'] },
      { slug: 'marble-tortoise', images: ['images/items/Handcrafted marble plates with floral design (1).png'] }
    ];

    // Begin Transaction
    await client.query('BEGIN');

    let insertedProducts = 0;
    let insertedImages = 0;

    for (const p of productsToInsert) {
      const res = await client.query(
        `INSERT INTO products 
           (id, name, slug, sku, category, subcategory, category_id, subcategory_id, 
            description, price, compare_price, stock, material, region, image_url, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'active')
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [
          p.id, p.name, p.slug, p.sku, p.category, p.subcategory, p.category_id, p.subcategory_id,
          p.description, p.price, p.compare_price, p.stock, p.material, p.region, p.image_url
        ]
      );
      if (res.rows.length > 0) {
        insertedProducts++;
        console.log(`  ✅ Product inserted: ${p.name} (${p.slug})`);
      }
    }

    // Seed product images
    for (const entry of imagesToInsert) {
      const prodRes = await client.query('SELECT id FROM products WHERE slug = $1', [entry.slug]);
      if (prodRes.rows.length === 0) continue;
      const productId = prodRes.rows[0].id;

      for (let i = 0; i < entry.images.length; i++) {
        const imgUrl = entry.images[i];
        const res = await client.query(
          `INSERT INTO product_images (product_id, image_url, alt_text, display_order)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [productId, imgUrl, entry.slug.replace(/-/g, ' '), i]
        );
        if (res.rows.length > 0) {
          insertedImages++;
        }
      }
    }

    await client.query('COMMIT');
    console.log(`✅ Migration complete: ${insertedProducts} products inserted, ${insertedImages} product images inserted.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
