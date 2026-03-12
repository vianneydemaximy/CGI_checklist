/**
 * config/db.js
 * MySQL connection pool using mysql2/promise.
 * Uses XAMPP-compatible defaults.
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || '127.0.0.1',
  port:               parseInt(process.env.DB_PORT || '3306', 10),
  database:           process.env.DB_NAME     || 'ai_doc_orchestrator',
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+00:00',   // store UTC
});

/**
 * Verifies database connectivity at startup.
 */
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Database connected successfully');
    conn.release();
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = { pool, testConnection };