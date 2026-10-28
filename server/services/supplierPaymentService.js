// -----------------------------------------------------------------------------
//  Supplier-payment service — records a payment OUT to a supplier, settling its
//  Accounts-Payable. In ONE transaction it:
//    1) posts the ledger entry  Dr Supplier AP  /  Cr Cash (or Bank)
//    2) (optional) applies the payment to a specific purchase, bumping its
//       amount_paid — the unpaid remainder stays in the supplier's AP balance
//    3) stores the payment row linked to its journal entry
//  A failure at any step rolls the whole thing back (no half-applied payment).
//  Money is computed from integer cents; over-payment is blocked server-side.
// -----------------------------------------------------------------------------
const { pool } = require('../config/db');
const model = require('../models/supplierPaymentModel');
const journalService = require('./journalService');
const audit = require('./auditService');
const money = require('../utils/money');
const accounts = require('../config/accounting');
const ApiError = require('../utils/ApiError');

// 'cash' settles from Cash on Hand; anything else (card) from Bank.
const cashAccountFor = (method) =>
  method === 'cash' ? accounts.CASH_ACCOUNT_ID : accounts.BANK_ACCOUNT_ID;

const METHOD_AR = { cash: 'نقدًا', bank: 'بنك', cheque: 'شيك', card: 'بطاقة' };
const METHOD_EN = { cash: 'Cash', bank: 'Bank', cheque: 'Cheque', card: 'Card' };

const create = async (payload, actor) => {
  const { supplierId, purchaseId, paymentDate, method = 'cash', reference } = payload;
  const amountCents = money.toCents(payload.amount);
  if (amountCents <= 0) throw new ApiError(400, 'Payment amount must be greater than zero');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const supplier = await model.getSupplier(conn, Number(supplierId));
    if (!supplier) throw new ApiError(404, 'Supplier not found or inactive');
    if (!supplier.account_id) throw new ApiError(400, 'Supplier has no payable account configured');

    // Optional: settle a specific purchase (row-locked to block over-payment).
    let purchase = null;
    if (purchaseId) {
      purchase = await model.getPurchaseForUpdate(conn, Number(purchaseId));
      if (!purchase) throw new ApiError(404, 'Purchase not found');
      if (Number(purchase.supplier_id) !== Number(supplier.id)) {
        throw new ApiError(400, 'The purchase does not belong to this supplier');
      }
      const remaining = money.toCents(purchase.total_amount) - money.toCents(purchase.amount_paid);
      if (remaining <= 0) throw new ApiError(400, 'Purchase is already fully paid');
      if (amountCents > remaining) {
        throw new ApiError(400, `Payment exceeds outstanding balance (${money.fromCents(remaining)})`);
      }
    }

    // 1) Ledger entry: Dr supplier AP, Cr Cash/Bank.
    const cashAccountId = cashAccountFor(method);
    const journal = await journalService.createEntry(
      {
        entryDate: paymentDate,
        description: `دفعة مدفوعة للمورد ${supplier.name}${purchase ? ` - ${purchase.purchase_number}` : ''}`,
        descriptionEn: `Payment to supplier ${supplier.name}${purchase ? ` - ${purchase.purchase_number}` : ''}`,
        referenceType: 'supplier_payment',
        referenceId: null, // payment row links back to the journal entry
        lines: [
          { accountId: supplier.account_id, debit: money.fromCents(amountCents), credit: '0.00', memo: `سداد ذمم - ${supplier.name}`, memoEn: `Settle payable - ${supplier.name}` },
          { accountId: cashAccountId, debit: '0.00', credit: money.fromCents(amountCents), memo: METHOD_AR[method] || method, memoEn: METHOD_EN[method] || method },
        ],
      },
      actor,
      conn // share the transaction
    );

    // 2) Apply to the purchase's amount_paid when settling one.
    if (purchase) {
      const newPaidCents = money.toCents(purchase.amount_paid) + amountCents;
      await model.updatePurchasePaid(conn, purchase.id, money.fromCents(newPaidCents));
    }

    // 3) Store the payment row.
    const year = new Date(paymentDate).getFullYear();
    const paymentNumber = await model.generateNextNumber(conn, year);
    const paymentId = await model.create(conn, {
      paymentNumber,
      supplierId: supplier.id,
      purchaseId: purchase ? purchase.id : null,
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
      action: 'supplier_payment.create',
      entity: 'supplier_payments',
      entityId: paymentId,
      description: `Recorded supplier payment ${paymentNumber} of ${money.fromCents(amountCents)} to ${supplier.name}${purchase ? ` on ${purchase.purchase_number}` : ''}`,
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
  if (!payment) throw new ApiError(404, 'Supplier payment not found');
  return payment;
};

module.exports = { create, list, getById };
