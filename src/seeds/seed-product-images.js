'use strict';

/**
 * Seed product_images table from mokshita_data.md image paths.
 * Products.image_url is also synced where null.
 * Run: node src/seeds/seed-product-images.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('../config/db');

// Image map: product slug → local image path(s) from mokshita_data.md
const productImageMap = [
  { slug: 'taj-mahal-watercolour',   images: ['images/items/watercolourtajmahal1.jpeg'] },
  { slug: 'pichwai-art',             images: ['images/items/pichwai art3.jpeg'] },
  { slug: 'watercolour-mini',        images: ['images/items/watercolourpaint3.jpeg', 'images/items/tajmahalblue.jpeg'] },
  { slug: 'marble-tortoise',         images: ['images/items/Handcrafted marble plates with floral design (1).png'] },
  { slug: 'coaster-plates',          images: ['images/items/Handcrafted marble plates with floral design (1).png'] },
  { slug: 'wooden-dice',             images: ['images/items/Wooden dice and wooden die holder.jpg.jpeg'] },
  { slug: 'wooden-ganesha',          images: ['images/items/Handcrafted Ganesha idol on white background.png'] },
  { slug: 'crochet-doll',            images: ['images/items/Handmade crochet doll with vibrant yarn details.png'] },
  { slug: 'crochet-turtle',          images: ['images/items/Crochet turtles side by side.png'] },
  { slug: 'sunflower-keyring',       images: ['images/items/Sunflower.jpg.jpeg'] },
  { slug: 'elephant-pouch',          images: ['images/items/Vibrant folk-art elephant pouch design.png'] },
  { slug: 'zardozi-double-elephant', images: ['images/items/Intricate Zardozi elephant ornament on velvet.png'] },
  { slug: 'zardozi-elephant',        images: ['images/items/Red Elephant( Zardozi).png'] },
  { slug: 'zardozi-camel',           images: ['images/items/Green and gold camel ornament.png'] },
  { slug: 'zardozi-carrot',          images: ['images/items/Beaded carrot ornament close-up.png'] },
  { slug: 'zardozi-elephant-trunk',  images: ['images/items/Green and gold elephant ornament.png'] },
  { slug: 'zardozi-tiger',           images: ['images/items/Intricate Zardozi embroidered elephant pouches.png'] },
  { slug: 'zardozi-tuk-tuk',         images: ['images/items/Beaded auto-rickshaw ornaments in vibrant colours.png'] },
  { slug: 'zardozi-coin-purse',      images: ['images/items/Intricate Zardozi embroidered elephant pouches.png'] },
  { slug: 'zardozi-halloween',       images: ['images/items/halloween pumpkin.png'] },
];

async function seedProductImages() {
  const client = await pool.connect();
  try {
    console.log('🔄 Seeding product_images from mokshita_data.md...');
    await client.query('BEGIN');

    let inserted = 0;
    let skipped  = 0;
    let synced   = 0;

    for (const entry of productImageMap) {
      // Resolve product id + current image_url
      const prodRes = await client.query(
        'SELECT id, image_url FROM products WHERE slug = $1',
        [entry.slug]
      );
      if (prodRes.rows.length === 0) {
        console.warn(`  ⚠️  Product not found: ${entry.slug}`);
        skipped++;
        continue;
      }
      const { id: productId, image_url: currentPrimary } = prodRes.rows[0];

      // Insert each image with display_order
      for (let i = 0; i < entry.images.length; i++) {
        const imageUrl = entry.images[i];

        // Check for duplicate
        const dup = await client.query(
          'SELECT id FROM product_images WHERE product_id = $1 AND image_url = $2',
          [productId, imageUrl]
        );
        if (dup.rows.length > 0) { continue; }

        await client.query(
          `INSERT INTO product_images (product_id, image_url, alt_text, display_order)
           VALUES ($1, $2, $3, $4)`,
          [productId, imageUrl, entry.slug.replace(/-/g, ' '), i]
        );
        inserted++;
      }

      // Sync products.image_url from first image if currently null
      if (!currentPrimary && entry.images.length > 0) {
        await client.query(
          'UPDATE products SET image_url = $1 WHERE id = $2',
          [entry.images[0], productId]
        );
        synced++;
      }
    }

    await client.query('COMMIT');
    console.log(`  ✅ product_images: ${inserted} inserted, ${skipped} products skipped.`);
    console.log(`  ✅ products.image_url synced for ${synced} products that had no image.`);
    console.log('✅ Product image seeding complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedProductImages();
