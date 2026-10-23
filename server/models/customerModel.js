// -----------------------------------------------------------------------------
//  Customer model — all DB access for the `customers` table.
//  SECURITY: every query is PARAMETERIZED (`?` placeholders) -> no SQL injection.
//  Money columns (credit_limit, opening_balance) come back as STRINGS because the
//  pool sets decimalNumbers:false, preserving exact decimal value (req. 24).
// -----------------------------------------------------------------------------
const { pool } = require('../config/db');

const SAFE_COLUMNS = `
  id, customer_code, name, email, phone, address,
  credit_limit, opening_balance, account_id, is_active, created_at, updated_at`;

/** List with optional search + active filter + pagination. Returns { rows, total }. */
const findAll = async ({ search = '', isActive = null, limit = 10, offset = 0 }) => {
  const where = [];
  const params = [];

  if (search) {
    where.push('(name LIKE ? OR customer_code LIKE ? OR email LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (isActive !== null) {
    where.push('is_active = ?');
    params.push(isActive ? 1 : 0);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM customers ${whereSql}`, params
  );

  const [rows] = await pool.query(
    `SELECT ${SAFE_COLUMNS} FROM customers ${whereSql}
     ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { rows, total: countRows[0].total };
};

const findById = async (id) => {
  const [rows] = await pool.query(
    `SELECT ${SAFE_COLUMNS} FROM customers WHERE id = ? LIMIT 1`, [id]
  );
  return rows[0] || null;
};

/** Check whether a customer_code already exists (optionally excluding an id on update). */
const codeExists = async (code, excludeId = null) => {
  let sql = 'SELECT 1 FROM customers WHERE customer_code = ?';
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
    INSERT INTO customers
      (customer_code, name, email, phone, address, credit_limit, opening_balance, account_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    data.customerCode, data.name, data.email || null, data.phone || null,
    data.address || null, data.creditLimit ?? '0.00', data.openingBalance ?? '0.00',
    data.accountId || null,
  ];
  const [result] = await executor.query(sql, params);
  return result.insertId;
};

/**
 * Partial update — only the provided fields are changed.
 * Column names are whitelisted by the caller, never taken from raw input.
 */
const update = async (id, fields, executor = pool) => {
  const keys = Object.keys(fields);
  if (keys.length === 0) return false;
  const setSql = keys.map((k) => `${k} = ?`).join(', ');
  const params = [...Object.values(fields), id];
  await executor.query(`UPDATE customers SET ${setSql} WHERE id = ?`, params);
  return true;
};

/** Soft delete — keeps financial history intact (invoices still reference the customer). */
const deactivate = async (id) => {
  const [result] = await pool.query('UPDATE customers SET is_active = 0 WHERE id = ?', [id]);
  return result.affectedRows > 0;
};

/** Suggest the next sequential code like 'CUS-004' based on the highest numeric id. */
const generateNextCode = async () => {
  const [rows] = await pool.query('SELECT COALESCE(MAX(id), 0) + 1 AS next FROM customers');
  return `CUS-${String(rows[0].next).padStart(3, '0')}`;
};

module.exports = { findAll, findById, codeExists, create, update, deactivate, generateNextCode };
