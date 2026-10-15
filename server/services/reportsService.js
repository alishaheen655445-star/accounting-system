// -----------------------------------------------------------------------------
//  Reports service — turns raw aggregate rows into accounting figures.
//  All netting/balance math uses integer cents (money.js) for exactness.
// -----------------------------------------------------------------------------
const model = require('../models/reportsModel');
const money = require('../utils/money');
const { pick } = require('../utils/i18n');
const ApiError = require('../utils/ApiError');

/** Trial Balance: each account shows its NET balance on the debit OR credit side. */
const trialBalance = async (lang) => {
  const rows = await model.trialBalanceRows();
  let totalDebit = 0;
  let totalCredit = 0;

  const accounts = rows.map((r) => {
    const net = money.toCents(r.total_debit) - money.toCents(r.total_credit);
    const debitBal = net > 0 ? net : 0;
    const creditBal = net < 0 ? -net : 0;
    totalDebit += debitBal;
    totalCredit += creditBal;
    return {
      id: r.id, code: r.code, name: pick(r, 'name', lang), account_type: r.account_type,
      debit_balance: money.fromCents(debitBal),
      credit_balance: money.fromCents(creditBal),
    };
  });

  return {
    accounts,
    totals: {
      debit: money.fromCents(totalDebit),
      credit: money.fromCents(totalCredit),
      balanced: totalDebit === totalCredit,
    },
  };
};

/**
 * Chart of Accounts: build the parent→child hierarchy, roll up each group's
 * balance from its descendants (integer cents), and emit a flat pre-order list
 * with a `level` so the UI can indent it. Balances are DEBIT-POSITIVE (a credit
 * balance shows negative), matching the general-ledger convention.
 */
const chartOfAccounts = async (lang) => {
  const rows = await model.chartOfAccountsRows();

  const byId = new Map();
  rows.forEach((r) => byId.set(r.id, {
    id: r.id, code: r.code, name: pick(r, 'name', lang), account_type: r.account_type,
    is_group: r.is_group, parent_id: r.parent_id, description: pick(r, 'description', lang),
    ownNet: money.toCents(r.total_debit) - money.toCents(r.total_credit), // direct postings
    children: [], net: 0,
  }));

  const roots = [];
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) byId.get(node.parent_id).children.push(node);
    else roots.push(node);
  });
  const sortRec = (list) => {
    list.sort((a, b) => String(a.code).localeCompare(String(b.code)));
    list.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);

  // Post-order: a node's balance = its own postings + the sum of its children.
  const computeNet = (node) => {
    let net = node.ownNet;
    node.children.forEach((c) => { net += computeNet(c); });
    node.net = net;
    return net;
  };
  roots.forEach(computeNet);

  // Pre-order: flatten into an indented, ordered view.
  const accounts = [];
  const emit = (node, level) => {
    accounts.push({
      id: node.id, code: node.code, name: node.name,
      account_type: node.account_type, is_group: !!node.is_group, level,
      balance: money.fromCents(node.net),
    });
    node.children.forEach((c) => emit(c, level + 1));
  };
  roots.forEach((r) => emit(r, 0));

  return { accounts };
};

/** General Ledger for one account with a running balance. */
const generalLedger = async (accountId, lang) => {
  const acc = await model.getAccount(accountId);
  if (!acc) throw new ApiError(404, 'Account not found');
  if (acc.is_group) throw new ApiError(400, 'Cannot show a ledger for a group account');

  const rows = await model.ledgerRows(accountId);
  let running = 0;
  const lines = rows.map((r) => {
    const d = money.toCents(r.debit);
    const c = money.toCents(r.credit);
    running += d - c; // debit-positive view
    return {
      entry_number: r.entry_number, entry_date: r.entry_date, description: pick(r, 'description', lang),
      debit: money.fromCents(d), credit: money.fromCents(c), balance: money.fromCents(running),
    };
  });

  return {
    account: { id: acc.id, code: acc.code, name: pick(acc, 'name', lang), account_type: acc.account_type },
    lines,
    closing_balance: money.fromCents(running),
  };
};

/** Income Statement: Revenue - Expense = Net Income. */
const incomeStatement = async (lang) => {
  const [revRows, expRows] = await Promise.all([
    model.profitLossRows('revenue'),
    model.profitLossRows('expense'),
  ]);

  const revenue = revRows.map((r) => ({
    code: r.code, name: pick(r, 'name', lang),
    amount: money.fromCents(money.toCents(r.total_credit) - money.toCents(r.total_debit)),
  }));
  const expense = expRows.map((r) => ({
    code: r.code, name: pick(r, 'name', lang),
    amount: money.fromCents(money.toCents(r.total_debit) - money.toCents(r.total_credit)),
  }));

  const revTotal = money.sumCents(revRows.map((r) => money.toCents(r.total_credit) - money.toCents(r.total_debit)));
  const expTotal = money.sumCents(expRows.map((r) => money.toCents(r.total_debit) - money.toCents(r.total_credit)));

  return {
    revenue,
    expense,
    totals: {
      revenue: money.fromCents(revTotal),
      expense: money.fromCents(expTotal),
      net_income: money.fromCents(revTotal - expTotal),
    },
  };
};

/** Customer statement: invoices + payments + outstanding balance. */
const customerStatement = async (customerId) => {
  const cust = await model.getCustomer(customerId);
  if (!cust) throw new ApiError(404, 'Customer not found');

  const invoices = await model.customerInvoices(customerId);
  const payments = await model.customerPayments(customerId);

  let invoiced = 0;
  let collected = 0;
  const invRows = invoices.map((r) => {
    invoiced += money.toCents(r.total_amount);
    collected += money.toCents(r.amount_paid);
    return r;
  });
  let paidTotal = 0;
  const payRows = payments.map((r) => { paidTotal += money.toCents(r.amount); return r; });

  return {
    customer: { id: cust.id, customer_code: cust.customer_code, name: cust.name },
    invoices: invRows,
    payments: payRows,
    summary: {
      total_invoiced: money.fromCents(invoiced),
      total_marked_paid: money.fromCents(collected),
      total_payments_recorded: money.fromCents(paidTotal),
      outstanding: money.fromCents(invoiced - collected),
    },
  };
};

module.exports = { trialBalance, chartOfAccounts, generalLedger, incomeStatement, customerStatement };
