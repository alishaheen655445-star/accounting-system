// -----------------------------------------------------------------------------
//  Invoice service — creates invoices and, when issued, auto-posts the matching
//  double-entry journal entry. Everything runs in ONE DB transaction so an
//  invoice is never saved without its ledger entry (and vice-versa).
//
//  Money is computed server-side from integer cents (requirement 24):
//    line_total = quantity * unit_price
//    subtotal   = SUM(line_total)
//    tax_amount = round(subtotal * tax_rate / 100)
//    total      = subtotal + tax_amount
//
//  Journal posted for an issued sales invoice:
//    Dr  Customer AR account   total
//    Cr  Sales Revenue         subtotal
//    Cr  Sales Tax Payable     tax_amount   (only when > 0)
// -----------------------------------------------------------------------------
const { pool } = require('../config/db');
const model = require('../models/invoiceModel');
const journalService = require('./journalService');
const audit = require('./auditService');
const money = require('../utils/money');
const accounts = require('../config/accounting');
const ApiError = require('../utils/ApiError');

const create = async (payload, actor, lang = null) => {
  const { customerId, invoiceDate, dueDate, taxRate = 0, notes } = payload;
  const status = payload.status === 'issued' ? 'issued' : 'draft';
  const items = payload.items;

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'An invoice must contain at least one line item');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const customer = await model.getCustomer(conn, Number(customerId));
    if (!customer) throw new ApiError(400, 'Customer not found or inactive');
    if (!customer.account_id) throw new ApiError(400, 'Customer has no receivable account configured');

    // Build item rows + accumulate subtotal using integer cents.
    const prepared = [];
    let subtotalCents = 0;
    let order = 0;
    for (const raw of items) {
      order += 1;
      const qtyCentsInput = Number(raw.quantity);
      if (!Number.isFinite(qtyCentsInput) || qtyCentsInput <= 0) {
        throw new ApiError(400, `Item #${order}: quantity must be a positive number`);
      }

      let unitPrice;
      let description = (raw.description || '').trim();
      let productId = raw.productId ? Number(raw.productId) : null;

      if (productId) {
        // Backend is the source of truth for price: use the product's price.
        const product = await model.getProduct(conn, productId);
        if (!product) throw new ApiError(400, `Item #${order}: product not found or inactive`);
        unitPrice = product.selling_price;
        if (!description) description = product.name;
      } else {
        if (raw.unitPrice === undefined || raw.unitPrice === null || raw.unitPrice === '') {
          throw new ApiError(400, `Item #${order}: provide a productId or a unitPrice`);
        }
        unitPrice = raw.unitPrice;
        if (!description) throw new ApiError(400, `Item #${order}: description is required for a non-product line`);
      }

      const unitCents = money.toCents(unitPrice);
      const lineCents = Math.round(qtyCentsInput * unitCents); // qty may have decimals
      subtotalCents += lineCents;

      prepared.push({
        productId,
        description,
        quantity: money.fromCents(Math.round(qtyCentsInput * 100)), // store qty with 2dp
        unitPrice: money.fromCents(unitCents),
        lineTotal: money.fromCents(lineCents),
        sortOrder: order,
      });
    }

    // Tax + total.
    const rate = Number(taxRate) || 0;
    if (rate < 0 || rate > 100) throw new ApiError(400, 'tax_rate must be between 0 and 100');
    const taxCents = Math.round((subtotalCents * rate) / 100);
    const totalCents = subtotalCents + taxCents;

    const year = new Date(invoiceDate).getFullYear();
    const invoiceNumber = await model.generateNextNumber(conn, year);

    const invoiceId = await model.createHeader(conn, {
      invoiceNumber,
      customerId: Number(customerId),
      invoiceDate,
      dueDate: dueDate || null,
      subtotal: money.fromCents(subtotalCents),
      taxRate: rate.toFixed(2),
      taxAmount: money.fromCents(taxCents),
      totalAmount: money.fromCents(totalCents),
      status,
      notes: notes || null,
      createdBy: actor?.id,
    });

    for (const item of prepared) {
      await model.insertItem(conn, { invoiceId, ...item });
    }

    // Post the ledger entry only when the invoice is issued.
    if (status === 'issued') {
      const lines = [
        { accountId: customer.account_id, debit: money.fromCents(totalCents), credit: '0.00', memo: `فاتورة ${invoiceNumber}`, memoEn: `Invoice ${invoiceNumber}` },
        { accountId: accounts.SALES_REVENUE_ACCOUNT_ID, debit: '0.00', credit: money.fromCents(subtotalCents), memo: `مبيعات ${invoiceNumber}`, memoEn: `Sales ${invoiceNumber}` },
      ];
      if (taxCents > 0) {
        lines.push({ accountId: accounts.SALES_TAX_PAYABLE_ACCOUNT_ID, debit: '0.00', credit: money.fromCents(taxCents), memo: `ضريبة ${invoiceNumber}`, memoEn: `Tax ${invoiceNumber}` });
      }
      await journalService.createEntry(
        {
          entryDate: invoiceDate,
          description: `بيع آجل - ${invoiceNumber}`,
          descriptionEn: `Credit sale - ${invoiceNumber}`,
          referenceType: 'invoice',
          referenceId: invoiceId,
          lines,
        },
        actor,
        conn // share the transaction
      );
    }

    await conn.commit();

    await audit.log({
      userId: actor?.id,
      action: 'invoice.create',
      entity: 'invoices',
      entityId: invoiceId,
      description: `Created invoice ${invoiceNumber} for ${customer.name} (total ${money.fromCents(totalCents)}, status ${status})`,
      ip: actor?.ip,
    });

    return await model.getInvoiceFull(invoiceId, lang);
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

const getById = async (id, lang = null) => {
  const invoice = await model.getInvoiceFull(id, lang);
  if (!invoice) throw new ApiError(404, 'Invoice not found');
  return invoice;
};

module.exports = { create, list, getById };
