// -----------------------------------------------------------------------------
//  Payment model — DB access for the `payments` table.
//  WRITE functions take a `conn` (transaction). `getInvoiceForUpdate` locks the
//  invoice row so concurrent payments can't over-collect (race-safe).
// -----------------------------------------------------------------------------
const { pool } = require('../config/db');

const generateNextNumber = async (conn, year) => {
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS c FROM payments WHERE YEAR(payment_date) = ?', [year]
  );
  return `PMT-${year}-${String(rows[0].c + 1).padStart(4, '0')}`;
};

const getCustomer = async (conn, id) => {
  const [rows] = await conn.query(
    'SELECT id, name, account_id FROM customers WHERE id = ? AND is_active = 1 LIMIT 1', [id]
  );
  return rows[0] || null;
};

/** Lock the invoice row for the duration of the transaction. */
const getInvoiceForUpdate = async (conn, id) => {
  const [rows] = await conn.query(
    `SELECT id, customer_id, invoice_number, total_amount, amount_paid, status
     FROM invoices WHERE id = ? LIMIT 1 FOR UPDATE`, [id]
  );
  return rows[0] || null;
};

const create = async (conn, p) => {
  const [result] = await conn.query(
    `INSERT INTO payments
       (payment_number, customer_id, invoice_id, amount, payment_date, method, reference, journal_entry_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.paymentNumber, p.customerId, p.invoiceId || null, p.amount, p.paymentDate,
     p.method, p.reference || null, p.journalEntryId || null, p.createdBy || null]
  );
  return result.insertId;
};

const updateInvoicePaid = async (conn, invoiceId, amountPaidStr, status) => {
  await conn.query(
    'UPDATE invoices SET amount_paid = ?, status = ? WHERE id = ?',
    [amountPaidStr, status, invoiceId]
  );
};

const getById = async (id) => {
  const [rows] = await pool.query(
    `SELECT p.id, p.payment_number, p.customer_id, c.name AS customer_name,
            p.invoice_id, i.invoice_number, p.amount, p.payment_date, p.method,
            p.reference, p.journal_entry_id, p.created_by, p.created_at
     FROM payments p
     JOIN customers c ON c.id = p.customer_id
     LEFT JOIN invoices i ON i.id = p.invoice_id
     WHERE p.id = ? LIMIT 1`, [id]
  );
  return rows[0] || null;
};

const list = async ({ limit = 20, offset = 0 }) => {
  const [rows] = await pool.query(
    `SELECT p.id, p.payment_number, p.customer_id, c.name AS customer_name,
            p.invoice_id, p.amount, p.payment_date, p.method, p.created_at
     FROM payments p JOIN customers c ON c.id = p.customer_id
     ORDER BY p.id DESC LIMIT ? OFFSET ?`, [limit, offset]
  );
  const [countRows] = await pool.query('SELECT COUNT(*) AS total FROM payments');
  return { rows, total: countRows[0].total };
};

module.exports = { generateNextNumber, getCustomer, getInvoiceForUpdate, create, updateInvoicePaid, getById, list };
