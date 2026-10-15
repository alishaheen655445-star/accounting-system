// -----------------------------------------------------------------------------
//  Product model — all DB access for the `products` table.
//  Same pattern as customer/supplier models: parameterized queries, soft delete,
//  sku generation. Money columns (selling_price, cost_price) return as STRINGS.
// -----------------------------------------------------------------------------
const { pool } = require('../config/db');

const SAFE_COLUMNS = `
  id, sku, name, description, unit, selling_price, cost_price,
  revenue_account_id, inventory_account_id, is_active, created_at, updated_at`;

const findAll = async ({ search = '', isActive = null, limit = 10, offset = 0 }) => {
  const where = [];
  const params = [];

  if (search) {
    where.push('(name LIKE ? OR sku LIKE ? OR description LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (isActive !== null) {
    where.push('is_active = ?');
    params.push(isActive ? 1 : 0);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM products ${whereSql}`, params
  );

  const [rows] = await pool.query(
    `SELECT ${SAFE_COLUMNS} FROM products ${whereSql}
     ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { rows, total: countRows[0].total };
};

const findById = async (id) => {
  const [rows] = await pool.query(
    `SELECT ${SAFE_COLUMNS} FROM products WHERE id = ? LIMIT 1`, [id]
  );
  return rows[0] || null;
};

const skuExists = async (sku, excludeId = null) => {
  let sql = 'SELECT 1 FROM products WHERE sku = ?';
  const params = [sku];
  if (excludeId) {
    sql += ' AND id <> ?';
    params.push(excludeId);
  }
  const [rows] = await pool.query(sql, params);
  return rows.length > 0;
};

const create = async (data) => {
  const sql = `
    INSERT INTO products
      (sku, name, description, unit, selling_price, cost_price, revenue_account_id, inventory_account_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    data.sku, data.name, data.description || null, data.unit || 'pcs',
    data.sellingPrice ?? '0.00', data.costPrice ?? '0.00',
    data.revenueAccountId || null, data.inventoryAccountId || null,
  ];
  const [result] = await pool.query(sql, params);
  return result.insertId;
};

const update = async (id, fields) => {
  const keys = Object.keys(fields);
  if (keys.length === 0) return false;
  const setSql = keys.map((k) => `${k} = ?`).join(', ');
  const params = [...Object.values(fields), id];
  await pool.query(`UPDATE products SET ${setSql} WHERE id = ?`, params);
  return true;
};

const deactivate = async (id) => {
  const [result] = await pool.query('UPDATE products SET is_active = 0 WHERE id = ?', [id]);
  return result.affectedRows > 0;
};

/** Suggest the next sequential sku like 'P-004'. */
const generateNextSku = async () => {
  const [rows] = await pool.query('SELECT COALESCE(MAX(id), 0) + 1 AS next FROM products');
  return `P-${String(rows[0].next).padStart(3, '0')}`;
};

module.exports = { findAll, findById, skuExists, create, update, deactivate, generateNextSku };
