// -----------------------------------------------------------------------------
//  Supplier model — all DB access for the `suppliers` table.
//  Mirrors customerModel.js: parameterized queries, soft delete, code generation.
//  Money column (opening_balance) returns as a STRING (pool decimalNumbers:false).
// -----------------------------------------------------------------------------
const { pool } = require('../config/db');

const SAFE_COLUMNS = `
  id, supplier_code, name, email, phone, address,
  opening_balance, account_id, is_active, created_at, updated_at`;

/** List with optional search + active filter + pagination. Returns { rows, total }. */
const findAll = async ({ search = '', isActive = null, limit = 10, offset = 0 }) => {
  const where = [];
  const params = [];

  if (search) {
    where.push('(name LIKE ? OR supplier_code LIKE ? OR email LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (isActive !== null) {
    where.push('is_active = ?');
    params.push(isActive ? 1 : 0);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM suppliers ${whereSql}`, params
  );

  const [rows] = await pool.query(
    `SELECT ${SAFE_COLUMNS} FROM suppliers ${whereSql}
     ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { rows, total: countRows[0].total };
};

const findById = async (id) => {
  const [rows] = await pool.query(
    `SELECT ${SAFE_COLUMNS} FROM suppliers WHERE id = ? LIMIT 1`, [id]
  );
  return rows[0] || null;
};

const codeExists = async (code, excludeId = null) => {
  let sql = 'SELECT 1 FROM suppliers WHERE supplier_code = ?';
  const params = [code];
  if (excludeId) {
    sql += ' AND id <> ?';
    params.push(excludeId);
  }
  const [rows] = await pool.query(sql, params);
  return rows.length > 0;
};

const create = async (data, executor = pool) => {
  const sql = `
    INSERT INTO suppliers
      (supplier_code, name, email, phone, address, opening_balance, account_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    data.supplierCode, data.name, data.email || null, data.phone || null,
    data.address || null, data.openingBalance ?? '0.00', data.accountId || null,
  ];
  const [result] = await executor.query(sql, params);
  return result.insertId;
};

/** Partial update — only provided fields change; column names whitelisted by caller. */
const update = async (id, fields, executor = pool) => {
  const keys = Object.keys(fields);
  if (keys.length === 0) return false;
  const setSql = keys.map((k) => `${k} = ?`).join(', ');
  const params = [...Object.values(fields), id];
  await executor.query(`UPDATE suppliers SET ${setSql} WHERE id = ?`, params);
  return true;
};

/** Soft delete — keeps AP history intact (journal still references the supplier). */
const deactivate = async (id) => {
  const [result] = await pool.query('UPDATE suppliers SET is_active = 0 WHERE id = ?', [id]);
  return result.affectedRows > 0;
};

/** Suggest the next sequential code like 'SUP-003'. */
const generateNextCode = async () => {
  const [rows] = await pool.query('SELECT COALESCE(MAX(id), 0) + 1 AS next FROM suppliers');
  return `SUP-${String(rows[0].next).padStart(3, '0')}`;
};

module.exports = { findAll, findById, codeExists, create, update, deactivate, generateNextCode };
