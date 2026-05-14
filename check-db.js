require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const pool = require('./src/config/db');

async function test() {
  try {
    const res = await pool.query("SELECT content FROM site_content WHERE section_key = 'homepage_layout'");
    if (res.rows.length > 0) {
      console.log('homepage_layout from DB:', res.rows[0].content);
    } else {
      console.log('homepage_layout not found in DB!');
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
test();
