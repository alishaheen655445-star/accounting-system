// -----------------------------------------------------------------------------
//  One-off backfill: give every EXISTING customer/supplier that has NO linked
//  receivable/payable account a dedicated AR/AP leaf sub-account (the same
//  auto-creation the app now does on insert). Fixes legacy rows created through
//  the UI before the auto-link existed (e.g. a customer with account_id = NULL
//  whose invoices failed with "Customer has no receivable account configured").
//
//  Idempotent: only touches rows WHERE account_id IS NULL. Safe to re-run.
//  Run from the PROJECT ROOT so dotenv finds .env:
//      node server/scripts/backfillPartyAccounts.js
// -----------------------------------------------------------------------------
require('dotenv').config();

const { pool } = require('../config/db');
const ledger = require('../services/ledgerAccountFactory');

const backfillTable = async (table, ensureFn) => {
  const [rows] = await pool.query(
    `SELECT id, name FROM \`${table}\` WHERE account_id IS NULL ORDER BY id`,
  );
  let done = 0;
  for (const row of rows) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const accountId = await ensureFn(conn, row.name);
      await conn.query(`UPDATE \`${table}\` SET account_id = ? WHERE id = ?`, [accountId, row.id]);
      await conn.commit();
      done += 1;
      console.log(`  ✔ ${table} #${row.id} (${row.name}) -> account ${accountId}`);
    } catch (err) {
      await conn.rollback();
      console.error(`  ✖ ${table} #${row.id} (${row.name}) failed: ${err.message}`);
    } finally {
      conn.release();
    }
  }
  return { candidates: rows.length, done };
};

(async () => {
  try {
    console.log('Backfilling customer receivable accounts...');
    const cust = await backfillTable('customers', ledger.ensureReceivable);
    console.log(`  → ${cust.done}/${cust.candidates} customers linked.\n`);

    console.log('Backfilling supplier payable accounts...');
    const supp = await backfillTable('suppliers', ledger.ensurePayable);
    console.log(`  → ${supp.done}/${supp.candidates} suppliers linked.\n`);

    console.log('Done.');
  } catch (err) {
    console.error('Backfill aborted:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
