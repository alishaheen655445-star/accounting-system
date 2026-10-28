// -----------------------------------------------------------------------------
//  Purchase model — DB access for `purchases` + `purchase_items`.
//  Same pattern as invoiceModel: WRITE fns take a `conn` so header + items +
//  journal entry commit atomically; READ fns use the shared pool. All parameterized.
//  Money columns return as STRINGS (pool decimalNumbers:false).
// -----------------------------------------------------------------------------
const { pool } = require('../config/db');

const generateNextNumber = async (conn, year) => {
  // Highest existing sequence for the year (+1) — gap-safe (see invoice model).
  const [rows] = await conn.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(purchase_number, '-', -1) AS UNSIGNED)), 0) AS max_seq
     FROM purchases WHERE purchase_number LIKE ?`, [`PUR-${year}-%`]
  );
  return `PUR-${year}-${String(rows[0].max_seq + 1).padStart(4, '0')}`;
};

const getSupplier = async (conn, id) => {
  const [rows] = await conn.query(
    'SELECT id, name, account_id FROM suppliers WHERE id = ? AND is_active = 1 LIMIT 1', [id]
  );
  return rows[0] || null;
};

const createHeader = async (conn, p) => {
  const [result] = await conn.query(
    `INSERT INTO purchases
       (purchase_number, supplier_id, purchase_date, subtotal, total_amount, amount_paid, status, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'issued', ?, ?)`,
    [p.purchaseNumber, p.supplierId, p.purchaseDate, p.subtotal, p.totalAmount, p.amountPaid || '0.00', p.notes || null, p.createdBy || null]
  );
  return result.insertId;
};

const insertItem = async (conn, item) => {
  const [result] = await conn.query(
    `INSERT INTO purchase_items (purchase_id, product_id, description, quantity, unit_cost, line_total, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [item.purchaseId, item.productId, item.description, item.quantity, item.unitCost, item.lineTotal, item.sortOrder]
  );
  return result.insertId;
};

const getPurchaseFull = async (id) => {
  const [headers] = await pool.query(
    `SELECT pu.id, pu.purchase_number, pu.supplier_id, s.name AS supplier_name,
            pu.purchase_date, pu.subtotal, pu.total_amount, pu.amount_paid, pu.status, pu.notes,
            pu.created_by, pu.created_at, pu.updated_at
     FROM purchases pu JOIN suppliers s ON s.id = pu.supplier_id
     WHERE pu.id = ? LIMIT 1`, [id]
  );
  if (!headers[0]) return null;
  const [items] = await pool.query(
    `SELECT pi.id, pi.product_id, p.sku, pi.description, pi.quantity, pi.unit_cost, pi.line_total, pi.sort_order
     FROM purchase_items pi LEFT JOIN products p ON p.id = pi.product_id
     WHERE pi.purchase_id = ? ORDER BY pi.sort_order ASC, pi.id ASC`, [id]
  );
  return { ...headers[0], items };
};

const list = async ({ limit = 20, offset = 0 }) => {
  const [rows] = await pool.query(
    `SELECT pu.id, pu.purchase_number, pu.supplier_id, s.name AS supplier_name,
            pu.purchase_date, pu.total_amount, pu.amount_paid, pu.status, pu.created_at
     FROM purchases pu JOIN suppliers s ON s.id = pu.supplier_id
     ORDER BY pu.id DESC LIMIT ? OFFSET ?`, [limit, offset]
  );
  const [countRows] = await pool.query('SELECT COUNT(*) AS total FROM purchases');
  return { rows, total: countRows[0].total };
};

module.exports = {
  generateNextNumber, getSupplier, createHeader, insertItem, getPurchaseFull, list,
};
