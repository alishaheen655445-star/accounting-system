// -----------------------------------------------------------------------------
//  Invoice model — DB access for invoices + invoice_items.
//  WRITE functions take a `conn` so header + items + journal entry all commit
//  together atomically. READ functions use the shared pool. All parameterized.
// -----------------------------------------------------------------------------
const { pool } = require('../config/db');
const { pick } = require('../utils/i18n');

const generateNextNumber = async (conn, year) => {
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS c FROM invoices WHERE YEAR(invoice_date) = ?', [year]
  );
  return `INV-${year}-${String(rows[0].c + 1).padStart(4, '0')}`;
};

const getCustomer = async (conn, id) => {
  const [rows] = await conn.query(
    'SELECT id, name, account_id FROM customers WHERE id = ? AND is_active = 1 LIMIT 1', [id]
  );
  return rows[0] || null;
};

const getProduct = async (conn, id) => {
  const [rows] = await conn.query(
    'SELECT id, name, selling_price, revenue_account_id FROM products WHERE id = ? AND is_active = 1 LIMIT 1', [id]
  );
  return rows[0] || null;
};

const createHeader = async (conn, i) => {
  const [result] = await conn.query(
    `INSERT INTO invoices
       (invoice_number, customer_id, invoice_date, due_date, subtotal, tax_rate, tax_amount,
        total_amount, amount_paid, status, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, ?)`,
    [i.invoiceNumber, i.customerId, i.invoiceDate, i.dueDate || null, i.subtotal, i.taxRate,
     i.taxAmount, i.totalAmount, i.status, i.notes || null, i.createdBy || null]
  );
  return result.insertId;
};

const insertItem = async (conn, item) => {
  const [result] = await conn.query(
    `INSERT INTO invoice_items (invoice_id, product_id, description, quantity, unit_price, line_total, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [item.invoiceId, item.productId || null, item.description, item.quantity, item.unitPrice, item.lineTotal, item.sortOrder]
  );
  return result.insertId;
};

const getInvoiceFull = async (id, lang) => {
  const [headers] = await pool.query(
    `SELECT i.id, i.invoice_number, i.customer_id, c.name AS customer_name,
            i.invoice_date, i.due_date, i.subtotal, i.tax_rate, i.tax_amount,
            i.total_amount, i.amount_paid, i.status, i.notes, i.notes_en, i.created_by, i.created_at, i.updated_at
     FROM invoices i JOIN customers c ON c.id = i.customer_id
     WHERE i.id = ? LIMIT 1`, [id]
  );
  if (!headers[0]) return null;
  const [items] = await pool.query(
    `SELECT id, product_id, description, quantity, unit_price, line_total, sort_order
     FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC, id ASC`, [id]
  );
  const header = headers[0];
  return { ...header, notes: pick(header, 'notes', lang), notes_en: undefined, items };
};

const list = async ({ limit = 20, offset = 0 }) => {
  const [rows] = await pool.query(
    `SELECT i.id, i.invoice_number, i.customer_id, c.name AS customer_name,
            i.invoice_date, i.total_amount, i.amount_paid, i.status, i.created_at
     FROM invoices i JOIN customers c ON c.id = i.customer_id
     ORDER BY i.id DESC LIMIT ? OFFSET ?`, [limit, offset]
  );
  const [countRows] = await pool.query('SELECT COUNT(*) AS total FROM invoices');
  return { rows, total: countRows[0].total };
};

module.exports = {
  generateNextNumber, getCustomer, getProduct, createHeader, insertItem, getInvoiceFull, list,
};
