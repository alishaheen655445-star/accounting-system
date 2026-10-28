// -----------------------------------------------------------------------------
//  Database connection (mysql2/promise) — a shared connection POOL.
//  Why a pool? Opening a new DB connection per request is slow; a pool keeps a
//  set of reusable connections. We export the pool and reuse it everywhere.
// -----------------------------------------------------------------------------
const mysql = require('mysql2/promise');
require('dotenv').config();

const baseOptions = {
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Return DECIMAL columns as strings so we control money parsing precisely,
  // and map DB dates without timezone surprises.
  decimalNumbers: false,
  dateStrings: true,
};

// Managed providers (Render, PlanetScale...) sometimes require TLS. Toggle with
// DB_SSL=true; Railway/localhost need it off. rejectUnauthorized:false keeps the
// common self-signed managed certs working without extra CA setup.
function sslFromEnv() {
  const v = String(process.env.DB_SSL || process.env.DB_REQUIRE_SSL || '').toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return { rejectUnauthorized: false };
  return undefined;
}

// Accept connection info from EITHER the granular DB_* vars (local/.env) OR a
// single DATABASE_URL / Railway MYSQL* vars — so the same image runs on Railway
// and Render with zero code change. URL wins when present.
function buildConfig() {
  const url = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.MYSQLURL;
  if (url) {
    const ssl = sslFromEnv();
    return { uri: url, options: ssl ? { ...baseOptions, ssl } : baseOptions };
  }
  const ssl = sslFromEnv();
  const options = {
    ...baseOptions,
    host: process.env.DB_HOST || process.env.MYSQLHOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'accounting_system',
  };
  if (ssl) options.ssl = ssl;
  return { options };
}

const cfg = buildConfig();
const pool = cfg.uri ? mysql.createPool(cfg.uri, cfg.options) : mysql.createPool(cfg.options);

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
