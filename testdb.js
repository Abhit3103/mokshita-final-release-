require("dotenv").config();
const pool = require("./db");

async function testDatabase() {
  try {
    const result = await pool.query(
      "SELECT NOW() AS server_time, current_database() AS database_name"
    );

    console.log("✅ Database connected successfully");
    console.table(result.rows);
  } catch (error) {
    console.error("❌ Database connection failed");
    console.error(error.message);
  } finally {
    await pool.end();
  }
}

testDatabase();