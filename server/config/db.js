// -----------------------------------------------------------------------------
//  Database connection (mysql2/promise) — a shared connection POOL.
//  Why a pool? Opening a new DB connection per request is slow; a pool keeps a
//  set of reusable connections. We export the pool and reuse it everywhere.
// -----------------------------------------------------------------------------
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'accounting_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Return DECIMAL columns as strings so we control money parsing precisely,
  // and map DB dates without timezone surprises.
  decimalNumbers: false,
  dateStrings: true,
});

// Small helper used at startup to fail fast if the DB is unreachable.
async function testConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SELECT 1');
  } finally {
    conn.release();
  }
}

module.exports = { pool, testConnection };
