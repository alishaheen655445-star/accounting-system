// -----------------------------------------------------------------------------
//  User model — all DB access for the `users` table lives here.
//  SECURITY: every query is PARAMETERIZED (uses `?` placeholders) so user input
//  can never be interpreted as SQL (prevents SQL Injection, requirement 20).
//  We NEVER select password_hash into application-level objects that reach the
//  client; login fetches it explicitly and it is stripped before responding.
// -----------------------------------------------------------------------------
const { pool } = require('../config/db');

/** Find a user by username OR email (used at login). Returns the full row incl. hash. */
const findByUsernameOrEmail = async (identifier) => {
  const sql = `
    SELECT id, username, email, password_hash, full_name, role, is_active
    FROM users
    WHERE username = ? OR email = ?
    LIMIT 1`;
  const [rows] = await pool.query(sql, [identifier, identifier]);
  return rows[0] || null;
};

/** Find a user by id WITHOUT the password hash (safe for responses). */
const findByIdSafe = async (id) => {
  const sql = `
    SELECT id, username, email, full_name, role, is_active, created_at
    FROM users
    WHERE id = ?
    LIMIT 1`;
  const [rows] = await pool.query(sql, [id]);
  return rows[0] || null;
};

/** Insert a new user. `passwordHash` must already be bcrypt-hashed by the caller. */
const create = async ({ username, email, passwordHash, fullName, role }) => {
  const sql = `
    INSERT INTO users (username, email, password_hash, full_name, role)
    VALUES (?, ?, ?, ?, ?)`;
  const [result] = await pool.query(sql, [username, email, passwordHash, fullName, role]);
  return result.insertId;
};

// Columns safe to return to the client — NEVER password_hash.
const SAFE_COLUMNS = `
  id, username, email, full_name, role, is_active, created_at, updated_at`;

/** List users with optional search + pagination. Returns { rows, total }. */
const findAll = async ({ search = '', limit = 10, offset = 0 }) => {
  const where = [];
  const params = [];
  if (search) {
    where.push('(username LIKE ? OR email LIKE ? OR full_name LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM users ${whereSql}`, params);
  const [rows] = await pool.query(
    `SELECT ${SAFE_COLUMNS} FROM users ${whereSql} ORDER BY id ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return { rows, total: countRows[0].total };
};

/** Full safe row by id (no hash). */
const findById = async (id) => {
  const [rows] = await pool.query(`SELECT ${SAFE_COLUMNS} FROM users WHERE id = ? LIMIT 1`, [id]);
  return rows[0] || null;
};

/** True if the username or email is taken (optionally by another row on update). */
const usernameOrEmailTaken = async ({ username, email, excludeId = null }) => {
  let sql = 'SELECT 1 FROM users WHERE (username = ? OR email = ?)';
  const params = [username, email];
  if (excludeId) {
    sql += ' AND id <> ?';
    params.push(excludeId);
  }
  const [rows] = await pool.query(sql, params);
  return rows.length > 0;
};

/** Partial update — only whitelisted fields provided by the caller are changed. */
const update = async (id, fields) => {
  const keys = Object.keys(fields);
  if (keys.length === 0) return false;
  const setSql = keys.map((k) => `${k} = ?`).join(', ');
  const params = [...Object.values(fields), id];
  await pool.query(`UPDATE users SET ${setSql} WHERE id = ?`, params);
  return true;
};

/** Soft disable — keeps the audit trail / created rows attributed to the user. */
const deactivate = async (id) => {
  const [result] = await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
  return result.affectedRows > 0;
};

module.exports = {
  findByUsernameOrEmail, findByIdSafe, create,
  findAll, findById, usernameOrEmailTaken, update, deactivate,
};
