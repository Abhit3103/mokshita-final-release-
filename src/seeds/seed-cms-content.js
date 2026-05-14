'use strict';

/**
 * CMS Content Seed — Full Site Content
 * Populates site_content with structured JSONB for all named sections.
 * Run: node src/seeds/seed-cms-content.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('../config/db');

const sections = [
  {
    section_key: 'homepage_hero',
    content: {
      headline    : 'Discover the Soul of India',
      subheadline : 'Handcrafted treasures and curated experiences, direct from artisans to you.',
      cta_primary : { label: 'Shop Handicrafts', url: '/handicrafts.html' },
      cta_secondary: { label: 'Explore Travel', url: '/travel.html' },
    },
  },
  {
    section_key: 'homepage_stats',
    content: {
      stats: [
        { value: '120+', label: 'Master Artisans', detail: 'Across 18 states in India' },
        { value: '2400+', label: 'Happy Travellers', detail: 'Over 8 years of storytelling' },
        { value: '100%', label: 'Handmade', detail: 'Every item is ethically sourced' },
      ],
    },
  },
  {
    section_key: 'brand_statistics',
    content: {
      promise      : 'Direct from artisans, 100% handmade, ethically sourced.',
      artisans     : '120+ Master Artisans across 18 states in India.',
      travellers   : '2400+ Happy Travellers over a span of 8 years of storytelling.',
      core_benefits: [
        'Free Delivery above ₹999',
        '100% Authenticity Guaranteed',
        'COD Available Pan India',
        'WhatsApp Support',
      ],
    },
  },
  {
    section_key: 'founder_quote',
    content: {
      quote  : 'India does not lack talent — it lacks the world\'s gaze turned toward her makers.',
      author : 'Riya Mehta',
      role   : 'Founder · Mokshita Enterprises',
    },
  },
  {
    section_key: 'about_brand',
    content: {
      title       : 'The Mokshita Story',
      body        : 'Mokshita Enterprises was founded with a single belief: India\'s most extraordinary creators deserved a global stage. We work directly with master artisans from Agra, Jaipur, Nathdwara, and beyond — bringing their centuries-old crafts to homes around the world without middlemen, without compromise.',
      mission     : 'Connecting artisans to the world. Preserving India\'s craft legacy. One handmade piece at a time.',
      founding_year: 2018,
    },
  },
  {
    section_key: 'homepage_benefits',
    content: {
      benefits: [
        { icon: 'truck',    title: 'Free Delivery',       detail: 'On all orders above ₹999' },
        { icon: 'shield',   title: '100% Authentic',      detail: 'Every item is genuinely handmade' },
        { icon: 'cash',     title: 'Cash on Delivery',    detail: 'Available Pan India' },
        { icon: 'whatsapp', title: 'WhatsApp Support',    detail: 'Get help instantly on WhatsApp' },
      ],
    },
  },
  {
    section_key: 'footer_links',
    content: {
      columns: [
        {
          heading: 'Shop',
          links  : [
            { label: 'All Handicrafts', url: '/handicrafts.html' },
            { label: 'Paintings',       url: '/handicrafts.html?category=paintings' },
            { label: 'Zardozi',         url: '/handicrafts.html?category=zardozi' },
            { label: 'Crochet',         url: '/handicrafts.html?category=crochet' },
          ],
        },
        {
          heading: 'Travel',
          links  : [
            { label: 'Travel Packages', url: '/travel.html' },
            { label: 'Agra',            url: '/travel.html#agra' },
            { label: 'Jaipur',          url: '/travel.html#jaipur' },
            { label: 'Delhi',           url: '/travel.html#delhi' },
          ],
        },
        {
          heading: 'Help',
          links  : [
            { label: 'Contact Us',   url: '/contact.html' },
            { label: 'My Account',   url: '/account.html' },
            { label: 'My Orders',    url: '/account.html#orders' },
            { label: 'Cart',         url: '/cart.html' },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Mokshita Enterprises. All rights reserved.`,
      social   : [
        { platform: 'instagram', url: '#' },
        { platform: 'whatsapp',  url: '#' },
      ],
    },
  },
];

async function seedCmsContent() {
  const client = await pool.connect();
  try {
    console.log('🔄 Seeding CMS site_content...');
    await client.query('BEGIN');

    let upserted = 0;
    for (const s of sections) {
      await client.query(
        `INSERT INTO site_content (section_key, content)
         VALUES ($1, $2)
         ON CONFLICT (section_key) DO UPDATE SET content = EXCLUDED.content, last_updated = NOW()`,
        [s.section_key, JSON.stringify(s.content)]
      );
      console.log(`  ✅ ${s.section_key}`);
      upserted++;
    }

    await client.query('COMMIT');
    console.log(`\n✅ CMS seeding complete — ${upserted} sections upserted.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedCmsContent();
