// -----------------------------------------------------------------------------
//  Journal model — DB access for journal_entries + journal_lines.
//  WRITE functions receive a `conn` (a pooled connection inside a transaction)
//  so header + all lines commit/rollback together (Atomicity). READ functions use
//  the shared pool. All queries are parameterized.
// -----------------------------------------------------------------------------
const { pool } = require('../config/db');
const { pick } = require('../utils/i18n');

/** Next sequential entry number, e.g. 'JE-0004'. Runs on the transaction connection. */
const generateNextNumber = async (conn) => {
  const [rows] = await conn.query(
    'SELECT COALESCE(MAX(id), 0) + 1 AS next FROM journal_entries'
  );
  return `JE-${String(rows[0].next).padStart(4, '0')}`;
};

/** Fetch the referenced accounts (to validate existence + leaf) on the transaction conn. */
const getAccountsByIds = async (conn, ids) => {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await conn.query(
    `SELECT id, code, name, account_type, is_group
     FROM chart_of_accounts WHERE id IN (${placeholders})`, ids
  );
  return rows;
};

const insertHeader = async (conn, { entryNumber, entryDate, description, descriptionEn, referenceType, referenceId, createdBy }) => {
  const [result] = await conn.query(
    `INSERT INTO journal_entries
       (entry_number, entry_date, description, description_en, reference_type, reference_id, created_by, is_posted)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [entryNumber, entryDate, description, descriptionEn || null, referenceType, referenceId || null, createdBy || null]
  );
  return result.insertId;
};

const insertLine = async (conn, { entryId, accountId, debit, credit, memo, memoEn }) => {
  const [result] = await conn.query(
    `INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo, memo_en)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [entryId, accountId, debit, credit, memo || null, memoEn || null]
  );
  return result.insertId;
};

/** Full entry (header + lines with account names) for responses, localized to `lang`. */
const getEntryFull = async (id, lang) => {
  const [headers] = await pool.query(
    `SELECT id, entry_number, entry_date, description, description_en, reference_type, reference_id,
            created_by, is_posted, created_at
     FROM journal_entries WHERE id = ? LIMIT 1`, [id]
  );
  if (!headers[0]) return null;
  const [lines] = await pool.query(
    `SELECT jl.id, jl.account_id, ca.code AS account_code, ca.name AS account_name, ca.name_en AS account_name_en,
            jl.debit, jl.credit, jl.memo, jl.memo_en
     FROM journal_lines jl
     JOIN chart_of_accounts ca ON ca.id = jl.account_id
     WHERE jl.entry_id = ? ORDER BY jl.id ASC`, [id]
  );
  const header = headers[0];
  const cleanLines = lines.map((l) => ({
    id: l.id, account_id: l.account_id, account_code: l.account_code,
    account_name: pick(l, 'account_name', lang), debit: l.debit, credit: l.credit,
    memo: pick(l, 'memo', lang),
  }));
  return { ...header, description: pick(header, 'description', lang), lines: cleanLines };
};

/**
 * List postable LEAF accounts (is_group = 0) for pickers in the UI.
 * Group/heading accounts cannot receive postings, so they are excluded.
 */
const listPostableAccounts = async (lang) => {
  const [rows] = await pool.query(
    `SELECT id, code, name, name_en, account_type
     FROM chart_of_accounts
     WHERE is_group = 0
     ORDER BY code ASC`
  );
  return rows.map((r) => ({ id: r.id, code: r.code, name: pick(r, 'name', lang), account_type: r.account_type }));
};

/** Paginated list with per-entry debit/credit totals. */
const list = async ({ limit = 20, offset = 0, lang } = {}) => {
  const [rows] = await pool.query(
    `SELECT je.id, je.entry_number, je.entry_date, je.description, je.description_en, je.reference_type, je.created_at,
            (SELECT COALESCE(SUM(debit), 0)  FROM journal_lines WHERE entry_id = je.id) AS total_debit,
            (SELECT COALESCE(SUM(credit), 0) FROM journal_lines WHERE entry_id = je.id) AS total_credit
     FROM journal_entries je
     ORDER BY je.id DESC LIMIT ? OFFSET ?`, [limit, offset]
  );
  const [countRows] = await pool.query('SELECT COUNT(*) AS total FROM journal_entries');
  const items = rows.map((r) => {
    const { description_en, ...rest } = r; // don't leak the raw English column
    rest.description = pick(r, 'description', lang);
    return rest;
  });
  return { rows: items, total: countRows[0].total };
};

module.exports = {
  generateNextNumber, getAccountsByIds, insertHeader, insertLine, getEntryFull, list, listPostableAccounts,
};
