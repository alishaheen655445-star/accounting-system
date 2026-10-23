// -----------------------------------------------------------------------------
//  ledgerAccountFactory — ensures every customer/supplier has a dedicated
//  Accounts-Receivable / Accounts-Payable LEAF account so that invoices and
//  payments can post their double-entry line and each party's balance stays
//  derivable from the ledger (mirrors the per-customer 1301.. / per-supplier
//  2101.. sub-accounts created in database/seed.sql).
//
//  Each function accepts an `executor` (a pooled connection inside a
//  transaction, or the pool itself) so callers can keep account creation atomic
//  with the party insert. All queries are PARAMETERIZED.
// -----------------------------------------------------------------------------
const { pool } = require('../config/db');
const accounts = require('../config/accounting');
const ApiError = require('../utils/ApiError');

// Next free leaf code in a control account's numeric block.
// controlCode '1300' -> children share prefix '13' -> MAX(13xx)+1 ('1304').
const nextChildCode = async (executor, controlCode) => {
  const prefix = controlCode.replace(/0+$/, ''); // '1300' -> '13'
  const [rows] = await executor.query(
    `SELECT COALESCE(MAX(CAST(code AS UNSIGNED)), 0) AS maxCode
       FROM chart_of_accounts
      WHERE code LIKE ?`,
    [`${prefix}%`],
  );
  const max = Number(rows[0].maxCode) || Number(controlCode);
  return String(max + 1);
};

// Create a postable leaf under the SAME group as the control account.
const createLeaf = async (executor, { controlCode, name, nameEn }) => {
  const [ctrl] = await executor.query(
    'SELECT id, parent_id, account_type FROM chart_of_accounts WHERE code = ?',
    [controlCode],
  );
  if (!ctrl.length) {
    throw new ApiError(500, `Control account ${controlCode} is missing from the chart of accounts`);
  }
  const control = ctrl[0];
  const code = await nextChildCode(executor, controlCode);
  const [result] = await executor.query(
    `INSERT INTO chart_of_accounts
       (code, name, name_en, account_type, is_group, parent_id, description, description_en)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
    [
      code, name, nameEn || null, control.account_type, control.parent_id,
      'حساب فرعي أُنشئ تلقائيًا', 'Auto-created sub-account',
    ],
  );
  return result.insertId;
};

// Create the AR leaf for a customer and return its new account id.
const ensureReceivable = (executor, name) => createLeaf(executor || pool, {
  controlCode: accounts.RECEIVABLE_CONTROL_CODE,
  name: `ذمم مدينة - ${name}`,
  nameEn: `Receivable - ${name}`,
});

// Create the AP leaf for a supplier and return its new account id.
const ensurePayable = (executor, name) => createLeaf(executor || pool, {
  controlCode: accounts.PAYABLE_CONTROL_CODE,
  name: `ذمم دائنة - ${name}`,
  nameEn: `Payable - ${name}`,
});

module.exports = { ensureReceivable, ensurePayable };
