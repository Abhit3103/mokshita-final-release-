const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'mokshita_db',
  password: process.env.DB_PASSWORD || 'Apurvsingh@123',
  port: process.env.DB_PORT || 5432,
});

(async () => {
  try {
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, 'admin@test.com']);
    console.log('Password updated successfully.');
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
})();
