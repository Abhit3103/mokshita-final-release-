const bcrypt = require('bcryptjs');
require('dotenv').config();
const pool = require('./src/config/db');

(async () => {
  const email = process.env.RESET_ADMIN_EMAIL;
  const password = process.env.RESET_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('RESET_ADMIN_EMAIL and RESET_ADMIN_PASSWORD must be set.');
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, email]);
    console.log('Password updated successfully.');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
})();
