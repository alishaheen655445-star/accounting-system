// -----------------------------------------------------------------------------
//  Payment service — records a customer payment and, in ONE transaction:
//    1) posts the ledger entry  Dr Cash/Bank  /  Cr Customer AR
//    2) updates the invoice's amount_paid + status (partial / paid)
//    3) stores the payment row linked to its journal entry
//  A failure at any step rolls the whole thing back (no half-applied payment).
// -----------------------------------------------------------------------------
const { pool } = require('../config/db');
const model = require('../models/paymentModel');
const journalService = require('./journalService');
const audit = require('./auditService');
const money = require('../utils/money');
const accounts = require('../config/accounting');
const ApiError = require('../utils/ApiError');

const cashAccountFor = (method) =>
  method === 'cash' ? accounts.CASH_ACCOUNT_ID : accounts.BANK_ACCOUNT_ID;

// Labels for the payment-method memo shown in the ledger (fall back to the raw
// method if an unexpected value appears). Arabic + English twins.
const METHOD_AR = { cash: 'نقدًا', bank: 'بنك', cheque: 'شيك', card: 'بطاقة' };
const METHOD_EN = { cash: 'Cash', bank: 'Bank', cheque: 'Cheque', card: 'Card' };

const create = async (payload, actor) => {
  const { invoiceId, customerId, paymentDate, method = 'cash', reference } = payload;
  const amountCents = money.toCents(payload.amount);
  if (amountCents <= 0) throw new ApiError(400, 'Payment amount must be greater than zero');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Resolve the customer + (optionally) the invoice being settled.
    let customer;
    let invoice = null;
    if (invoiceId) {
      invoice = await model.getInvoiceForUpdate(conn, Number(invoiceId)); // row lock
      if (!invoice) throw new ApiError(404, 'Invoice not found');
      customer = await model.getCustomer(conn, invoice.customer_id);
    } else if (customerId) {
      customer = await model.getCustomer(conn, Number(customerId));
      if (!customer) throw new ApiError(404, 'Customer not found');
    } else {
      throw new ApiError(400, 'Provide either an invoiceId or a customerId');
    }
    if (!customer.account_id) throw new ApiError(400, 'Customer has no receivable account configured');

    // Over-payment guard (only when settling a specific invoice).
    if (invoice) {
      const remaining = money.toCents(invoice.total_amount) - money.toCents(invoice.amount_paid);
      if (remaining <= 0) throw new ApiError(400, 'Invoice is already fully paid');
      if (amountCents > remaining) {
        throw new ApiError(400, `Payment exceeds outstanding balance (${money.fromCents(remaining)})`);
      }
    }

    // 1) Ledger entry: Dr Cash/Bank, Cr customer AR.
    const cashAccountId = cashAccountFor(method);
    const journal = await journalService.createEntry(
      {
        entryDate: paymentDate,
        description: `دفعة مستلمة${invoice ? ` - ${invoice.invoice_number}` : ''}`,
        descriptionEn: `Payment received${invoice ? ` - ${invoice.invoice_number}` : ''}`,
        referenceType: 'payment',
        referenceId: null, // set to payment id after insert (below we link the other way)
        lines: [
          { accountId: cashAccountId, debit: money.fromCents(amountCents), credit: '0.00', memo: METHOD_AR[method] || method, memoEn: METHOD_EN[method] || method },
          { accountId: customer.account_id, debit: '0.00', credit: money.fromCents(amountCents), memo: `ذمم مدينة ${customer.name}`, memoEn: `Accounts receivable ${customer.name}` },
        ],
      },
      actor,
      conn // share the transaction
    );

    // 2) Update the invoice if this payment settles one.
    if (invoice) {
      const newPaidCents = money.toCents(invoice.amount_paid) + amountCents;
      const totalCents = money.toCents(invoice.total_amount);
      const newStatus = newPaidCents >= totalCents ? 'paid' : 'partial';
      await model.updateInvoicePaid(conn, invoice.id, money.fromCents(newPaidCents), newStatus);
    }

    // 3) Store the payment row.
    const year = new Date(paymentDate).getFullYear();
    const paymentNumber = await model.generateNextNumber(conn, year);
    const paymentId = await model.create(conn, {
      paymentNumber,
      customerId: customer.id,
      invoiceId: invoice ? invoice.id : null,
      amount: money.fromCents(amountCents),
      paymentDate,
      method,
      reference,
      journalEntryId: journal.entryId,
      createdBy: actor?.id,
    });

    await conn.commit();

    await audit.log({
      userId: actor?.id,
      action: 'payment.create',
      entity: 'payments',
      entityId: paymentId,
      description: `Recorded payment ${paymentNumber} of ${money.fromCents(amountCents)} for ${customer.name}${invoice ? ` on ${invoice.invoice_number}` : ''}`,
      ip: actor?.ip,
    });

    return await model.getById(paymentId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const list = async ({ page = 1, pageSize = 20 }) => {
  const offset = (page - 1) * pageSize;
  const { rows, total } = await model.list({ limit: pageSize, offset });
  return { items: rows, meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
};

const getById = async (id) => {
  const payment = await model.getById(id);
  if (!payment) throw new ApiError(404, 'Payment not found');
  return payment;
};

module.exports = { create, list, getById };
