'use strict';

/**
 * Seed Script for Travel Packages & CMS Content
 * Extracted from mokshita_data.md
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('../config/db');
const { slugify } = require('../utils/helpers.util');

const travelPackages = [
  {
    name: "Agra — Taj Mahal & Beyond",
    slug: slugify("Agra — Taj Mahal & Beyond"),
    duration: "3 Days / 2 Nights",
    location: "Agra, Uttar Pradesh",
    price: 24500.00,
    description: "Experience the magic of the Taj Mahal and the rich heritage of Agra.",
    highlights: [
      "Sunrise Taj Mahal visit (before public opening)",
      "Marble inlay workshop with master craftsman",
      "Agra Fort — private guided exploration",
      "Heritage haveli dinner — local cuisine & stories",
      "Mehtab Bagh moonrise viewing (full moon dates)"
    ],
    image_url: "images/fort4.jpg"
  },
  {
    name: "Delhi — The Cosmopolitan Heart (Imperial Legacy)",
    slug: slugify("Delhi — The Cosmopolitan Heart"),
    duration: "3 Days / 2 Nights",
    location: "Delhi",
    price: 28000.00,
    description: "Explore the historic charm and cosmopolitan pulse of India's capital.",
    highlights: [
      "Delhi — Old city rickshaw ride & Red Fort exploration",
      "Discover the historic Qutub Minar",
      "Indulge in Mughal culinary traditions at Chandni Chowk",
      "Boutique stays in luxury colonial heritage estates"
    ],
    image_url: "images/fort1.jpg"
  },
  {
    name: "Jaipur — The Pink City (Royal City)",
    slug: slugify("Jaipur — The Pink City"),
    duration: "4 Days / 3 Nights",
    location: "Jaipur, Rajasthan",
    price: 36000.00,
    description: "Immerse yourself in the royal grandeur and vibrant culture of Jaipur.",
    highlights: [
      "Ascend to the majestic Amber Fort",
      "Wander through vibrant bazaars filled with block-printed textiles",
      "Explore the raw gemstones market spanning decades",
      "Immerse yourself in Rajasthan's royal heritage havelis"
    ],
    image_url: "images/fort2.jpg"
  }
];

const siteContent = [
  {
    section_key: 'brand_statistics',
    content: {
      promise: "Direct from artisans, 100% handmade, ethically sourced.",
      artisans_supported: "120+ Master Artisans across 18 states in India.",
      travellers: "2400+ Happy Travellers over a span of 8 years of storytelling.",
      core_benefits: ["Free Delivery above ₹999", "100% Authenticity Guaranteed", "COD Available Pan India", "WhatsApp Support"]
    }
  },
  {
    section_key: 'founder_quote',
    content: {
      quote: "India does not lack talent — it lacks the world's gaze turned toward her makers.",
      author: "Riya Mehta",
      role: "Founder · Mokshita Enterprises"
    }
  }
];

const categories = [
  { name: "Paintings", description: "Hand-painted art and watercolours" },
  { name: "Marble Decor", description: "Fine Makrana marble crafts with inlay work" },
  { name: "Wooden Items", description: "Hand-carved premium wooden pieces" },
  { name: "Crochet", description: "Lovingly handcrafted pure cotton yarn items" },
  { name: "Textile", description: "Premium fabric products with delicate motifs" },
  { name: "Zardozi", description: "Traditional metallic embroidery on rich fabrics" }
];

async function seedData() {
  const client = await pool.connect();
  try {
    console.log('🔄 Seeding Categories, Travel Packages, and CMS Content...');
    await client.query('BEGIN');

    // 1. Categories
    for (const cat of categories) {
      await client.query(
        `INSERT INTO categories (name, slug, description) 
         VALUES ($1, $2, $3) ON CONFLICT (slug) DO NOTHING`,
        [cat.name, slugify(cat.name), cat.description]
      );
    }
    console.log('  ✅ Categories seeded.');

    // 2. Travel Packages
    for (const pkg of travelPackages) {
      await client.query(
        `INSERT INTO travel_packages (name, slug, duration, location, price, description, highlights, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (slug) DO NOTHING`,
        [pkg.name, pkg.slug, pkg.duration, pkg.location, pkg.price, pkg.description, JSON.stringify(pkg.highlights), pkg.image_url]
      );
    }
    console.log('  ✅ Travel Packages seeded.');

    // 3. Site Content
    for (const cms of siteContent) {
      await client.query(
        `INSERT INTO site_content (section_key, content)
         VALUES ($1, $2)
         ON CONFLICT (section_key) DO UPDATE SET content = EXCLUDED.content`,
        [cms.section_key, JSON.stringify(cms.content)]
      );
    }
    console.log('  ✅ Site Content seeded.');

    // 4. Update existing products with category_id
    const catsRes = await client.query('SELECT id, name FROM categories');
    for (const row of catsRes.rows) {
      await client.query(
        'UPDATE products SET category_id = $1 WHERE category = $2 OR category LIKE $3',
        [row.id, row.name, `%${row.name}%`]
      );
    }
    console.log('  ✅ Product category_ids mapped.');

    await client.query('COMMIT');
    console.log('✅ Seeding completed successfully.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seedData();
