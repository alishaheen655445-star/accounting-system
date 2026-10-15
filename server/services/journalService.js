// -----------------------------------------------------------------------------
//  Journal service — the double-entry core (requirement 24 / 28).
//
//  A journal entry is only valid when:
//    * it has at least 2 lines
//    * each line has EITHER a debit OR a credit (never both, never neither)
//    * SUM(debit) === SUM(credit)  (the ledger stays balanced)
//    * every line targets an existing LEAF account (is_group = 0)
//
//  The whole write happens inside a DB TRANSACTION so that a failure anywhere
//  (e.g. one bad line) rolls back the header AND all lines — never partial data.
// -----------------------------------------------------------------------------
const { pool } = require('../config/db');
const model = require('../models/journalModel');
const audit = require('./auditService');
const money = require('../utils/money');
const ApiError = require('../utils/ApiError');

/**
 * Create and post a balanced journal entry.
 * @param {object} payload
 * @param {Array}  lines  [{ accountId, debit, credit, memo }]
 * @param {object} actor  { id, ip }
 * @returns created full entry
 */
const createEntry = async ({ entryDate, description, descriptionEn, referenceType = 'manual', referenceId = null, lines }, actor, connOverride = null, lang = null) => {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new ApiError(400, 'A journal entry requires at least two lines');
  }

  // 1) Normalise amounts to integer cents + validate each line shape.
  const normalized = [];
  let totalDebit = 0;
  let totalCredit = 0;
  for (const l of lines) {
    const accountId = Number(l.accountId);
    const debitCents = money.toCents(l.debit || 0);
    const creditCents = money.toCents(l.credit || 0);

    if (!Number.isInteger(accountId) || accountId <= 0) {
      throw new ApiError(400, 'Each line requires a valid accountId');
    }
    if (debitCents < 0 || creditCents < 0) {
      throw new ApiError(400, 'Amounts cannot be negative');
    }
    if (debitCents > 0 && creditCents > 0) {
      throw new ApiError(400, `Line for account ${accountId} cannot have both debit and credit`);
    }
    if (debitCents === 0 && creditCents === 0) {
      throw new ApiError(400, `Line for account ${accountId} must have a debit or a credit`);
    }
    totalDebit += debitCents;
    totalCredit += creditCents;
    normalized.push({ accountId, debitCents, creditCents, memo: l.memo, memoEn: l.memoEn });
  }

  // 2) The golden rule: debits must equal credits.
  if (totalDebit === 0 || totalDebit !== totalCredit) {
    throw new ApiError(
      400,
      `Entry is not balanced — total debit ${money.fromCents(totalDebit)} ≠ total credit ${money.fromCents(totalCredit)}`
    );
  }

  // 3) Write inside a transaction (reuse caller's connection if provided,
  //    so invoice + its journal entry can share ONE atomic transaction).
  const ownConn = connOverride ? null : await pool.getConnection();
  const conn = connOverride || ownConn;
  const shouldCommit = !connOverride;

  try {
    if (shouldCommit) await conn.beginTransaction();

    // Validate accounts exist and are postable leaf accounts.
    const ids = [...new Set(normalized.map((l) => l.accountId))];
    const accounts = await model.getAccountsByIds(conn, ids);
    if (accounts.length !== ids.length) {
      throw new ApiError(400, 'One or more accounts do not exist');
    }
    const group = accounts.find((a) => a.is_group === 1);
    if (group) {
      throw new ApiError(400, `Cannot post to group account '${group.name}' (${group.code}); choose a leaf account`);
    }

    const entryNumber = await model.generateNextNumber(conn);
    const entryId = await model.insertHeader(conn, {
      entryNumber, entryDate, description, descriptionEn, referenceType, referenceId, createdBy: actor?.id,
    });

    for (const l of normalized) {
      await model.insertLine(conn, {
        entryId,
        accountId: l.accountId,
        debit: money.fromCents(l.debitCents),
        credit: money.fromCents(l.creditCents),
        memo: l.memo,
        memoEn: l.memoEn,
      });
    }

    if (shouldCommit) await conn.commit();

    if (shouldCommit) {
      await audit.log({
        userId: actor?.id,
        action: 'journal_entry.create',
        entity: 'journal_entries',
        entityId: entryId,
        description: `Posted journal entry ${entryNumber} (total ${money.fromCents(totalDebit)})`,
        ip: actor?.ip,
      });
      // Own transaction is committed -> safe to read the full entry back.
      return await model.getEntryFull(entryId, lang);
    }

    // Shared transaction (e.g. called from invoiceService): the outer commit has
    // NOT happened yet, so we must NOT read via the pool here. Return ids only;
    // the caller reads the full data after it commits.
    return { entryId, entryNumber, total: money.fromCents(totalDebit) };
  } catch (err) {
    if (shouldCommit) await conn.rollback();
    throw err; // let the central error handler format it
  } finally {
    if (ownConn) ownConn.release();
  }
};

const list = async ({ page = 1, pageSize = 20, lang = null }) => {
  const offset = (page - 1) * pageSize;
  const { rows, total } = await model.list({ limit: pageSize, offset, lang });
  return {
    items: rows,
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
};

const getById = async (id, lang = null) => {
  const entry = await model.getEntryFull(id, lang);
  if (!entry) throw new ApiError(404, 'Journal entry not found');
  return entry;
};

/** Postable leaf accounts for UI pickers (manual journal entry, filters). */
const listAccounts = async (lang = null) => model.listPostableAccounts(lang);

module.exports = { createEntry, list, getById, listAccounts };
