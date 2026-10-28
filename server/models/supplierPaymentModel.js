// -----------------------------------------------------------------------------
//  Supplier-payment model — DB access for `supplier_payments` (Accounts Payable).
//  Mirrors paymentModel but for the AP side. WRITE fns take a `conn` so the
//  payment + its journal entry + the purchase.amount_paid update commit atomically.
//  `getPurchaseForUpdate` row-locks the purchase so concurrent settlements can't
//  over-pay. All parameterized. Money columns return as STRINGS (decimalNumbers:false).
// -----------------------------------------------------------------------------
const { pool } = require('../config/db');

const generateNextNumber = async (conn, year) => {
  // Highest existing sequence for the year (+1) — gap-safe (see purchase model).
  const [rows] = await conn.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(payment_number, '-', -1) AS UNSIGNED)), 0) AS max_seq
     FROM supplier_payments WHERE payment_number LIKE ?`, [`SPMT-${year}-%`]
  );
  return `SPMT-${year}-${String(rows[0].max_seq + 1).padStart(4, '0')}`;
};

const getSupplier = async (conn, id) => {
  const [rows] = await conn.query(
    'SELECT id, name, account_id FROM suppliers WHERE id = ? AND is_active = 1 LIMIT 1', [id]
  );
  return rows[0] || null;
};

/** Lock the purchase row for the duration of the transaction. */
const getPurchaseForUpdate = async (conn, id) => {
  const [rows] = await conn.query(
    `SELECT id, supplier_id, purchase_number, total_amount, amount_paid
     FROM purchases WHERE id = ? LIMIT 1 FOR UPDATE`, [id]
  );
  return rows[0] || null;
};

const create = async (conn, p) => {
  const [result] = await conn.query(
    `INSERT INTO supplier_payments
       (payment_number, supplier_id, purchase_id, amount, payment_date, method, reference, journal_entry_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.paymentNumber, p.supplierId, p.purchaseId || null, p.amount, p.paymentDate,
     p.method, p.reference || null, p.journalEntryId || null, p.createdBy || null]
  );
  return result.insertId;
};

const updatePurchasePaid = async (conn, purchaseId, amountPaidStr) => {
  await conn.query('UPDATE purchases SET amount_paid = ? WHERE id = ?', [amountPaidStr, purchaseId]);
};

const getById = async (id) => {
  const [rows] = await pool.query(
    `SELECT sp.id, sp.payment_number, sp.supplier_id, s.name AS supplier_name,
            sp.purchase_id, pu.purchase_number, sp.amount, sp.payment_date, sp.method,
            sp.reference, sp.journal_entry_id, sp.created_by, sp.created_at
     FROM supplier_payments sp
     JOIN suppliers s ON s.id = sp.supplier_id
     LEFT JOIN purchases pu ON pu.id = sp.purchase_id
     WHERE sp.id = ? LIMIT 1`, [id]
  );
  return rows[0] || null;
};

const list = async ({ limit = 20, offset = 0 }) => {
  const [rows] = await pool.query(
    `SELECT sp.id, sp.payment_number, sp.supplier_id, s.name AS supplier_name,
            sp.purchase_id, pu.purchase_number, sp.amount, sp.payment_date, sp.method, sp.created_at
     FROM supplier_payments sp
     JOIN suppliers s ON s.id = sp.supplier_id
     LEFT JOIN purchases pu ON pu.id = sp.purchase_id
     ORDER BY sp.id DESC LIMIT ? OFFSET ?`, [limit, offset]
  );
  const [countRows] = await pool.query('SELECT COUNT(*) AS total FROM supplier_payments');
  return { rows, total: countRows[0].total };
};

module.exports = {
  generateNextNumber, getSupplier, getPurchaseForUpdate, create, updatePurchasePaid, getById, list,
};
