const pool = require('./src/config/db');
async function test() {
  try {
    const layout = ['trust-strip', 'hero', 'explore-cards', 'artisan-shop', 'experiences', 'our-story', 'testimonials', 'newsletter'];
    await pool.query(
      `INSERT INTO site_content (section_key, content, last_updated)
       VALUES ($1, $2, NOW())
       ON CONFLICT (section_key)
       DO UPDATE SET content = EXCLUDED.content, last_updated = NOW()`,
      ['homepage_layout', JSON.stringify(layout)]
    );
    console.log('Update successful');
    const res = await pool.query("SELECT * FROM site_content WHERE section_key = 'homepage_layout'");
    console.log(res.rows[0]);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
test();
