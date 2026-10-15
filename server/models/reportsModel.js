// -----------------------------------------------------------------------------
//  Reports model — read-only aggregate queries powering the accounting reports.
//  All queries are parameterized; money columns return as exact decimal strings.
// -----------------------------------------------------------------------------
const { pool } = require('../config/db');

/** Trial Balance: per LEAF account, summed debits and credits from the ledger. */
const trialBalanceRows = async () => {
  const [rows] = await pool.query(
    `SELECT ca.id, ca.code, ca.name, ca.name_en, ca.account_type,
            COALESCE(SUM(jl.debit), 0)  AS total_debit,
            COALESCE(SUM(jl.credit), 0) AS total_credit
     FROM chart_of_accounts ca
     LEFT JOIN journal_lines jl ON jl.account_id = ca.id
     WHERE ca.is_group = 0
     GROUP BY ca.id, ca.code, ca.name, ca.name_en, ca.account_type
     HAVING total_debit <> 0 OR total_credit <> 0
     ORDER BY ca.code ASC`
  );
  return rows;
};

/**
 * Chart of Accounts: EVERY account (groups + leaves) with its own direct
 * postings. Group accounts hold no postings themselves — their balances are
 * rolled up from descendants in the service layer. Hierarchy via parent_id.
 */
const chartOfAccountsRows = async () => {
  const [rows] = await pool.query(
    `SELECT ca.id, ca.code, ca.name, ca.name_en, ca.account_type, ca.is_group, ca.parent_id, ca.description, ca.description_en,
            COALESCE(SUM(jl.debit), 0)  AS total_debit,
            COALESCE(SUM(jl.credit), 0) AS total_credit
     FROM chart_of_accounts ca
     LEFT JOIN journal_lines jl ON jl.account_id = ca.id
     GROUP BY ca.id, ca.code, ca.name, ca.name_en, ca.account_type, ca.is_group, ca.parent_id, ca.description, ca.description_en
     ORDER BY ca.code ASC`
  );
  return rows;
};

const getAccount = async (id) => {
  const [rows] = await pool.query(
    'SELECT id, code, name, name_en, account_type, is_group FROM chart_of_accounts WHERE id = ? LIMIT 1', [id]
  );
  return rows[0] || null;
};

/** General Ledger: every posting line for one account, chronologically. */
const ledgerRows = async (accountId) => {
  const [rows] = await pool.query(
    `SELECT jl.id, je.entry_number, je.entry_date, je.description, je.description_en, jl.debit, jl.credit, jl.memo, jl.memo_en
     FROM journal_lines jl
     JOIN journal_entries je ON je.id = jl.entry_id
     WHERE jl.account_id = ?
     ORDER BY je.entry_date ASC, je.id ASC, jl.id ASC`, [accountId]
  );
  return rows;
};

/** Profit & Loss source: summed debits/credits for all leaf accounts of a type. */
const profitLossRows = async (type) => {
  const [rows] = await pool.query(
    `SELECT ca.id, ca.code, ca.name, ca.name_en,
            COALESCE(SUM(jl.debit), 0)  AS total_debit,
            COALESCE(SUM(jl.credit), 0) AS total_credit
     FROM chart_of_accounts ca
     JOIN journal_lines jl ON jl.account_id = ca.id
     WHERE ca.is_group = 0 AND ca.account_type = ?
     GROUP BY ca.id, ca.code, ca.name, ca.name_en
     ORDER BY ca.code ASC`, [type]
  );
  return rows;
};

const getCustomer = async (id) => {
  const [rows] = await pool.query(
    'SELECT id, customer_code, name, account_id FROM customers WHERE id = ? LIMIT 1', [id]
  );
  return rows[0] || null;
};

const customerInvoices = async (customerId) => {
  const [rows] = await pool.query(
    `SELECT id, invoice_number, invoice_date, total_amount, amount_paid, status
     FROM invoices WHERE customer_id = ? ORDER BY id DESC`, [customerId]
  );
  return rows;
};

const customerPayments = async (customerId) => {
  const [rows] = await pool.query(
    `SELECT id, payment_number, payment_date, amount, method
     FROM payments WHERE customer_id = ? ORDER BY id DESC`, [customerId]
  );
  return rows;
};

module.exports = {
  trialBalanceRows, chartOfAccountsRows, getAccount, ledgerRows, profitLossRows,
  getCustomer, customerInvoices, customerPayments,
};
