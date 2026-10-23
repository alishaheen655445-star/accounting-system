// -----------------------------------------------------------------------------
//  Purchase service — records a supplier purchase (stock-in) and, in ONE
//  transaction, increases each product's on-hand quantity and posts the
//  double-entry ledger movement:
//
//    Dr  Inventory account (per product)   subtotal
//    Cr  Supplier Payable (AP) account      total
//
//  Money is computed server-side from integer cents (requirement 24):
//    line_total = quantity * unit_cost ; subtotal = total = SUM(line_total)
//  Each purchased product's cost_price is refreshed to the paid unit_cost
//  (last-cost basis) so later COGS postings align with the stock valuation.
// -----------------------------------------------------------------------------
const { pool } = require('../config/db');
const model = require('../models/purchaseModel');
const productModel = require('../models/productModel');
const journalService = require('./journalService');
const audit = require('./auditService');
const money = require('../utils/money');
const ApiError = require('../utils/ApiError');

const create = async (payload, actor) => {
  const { supplierId, purchaseDate, notes } = payload;
  const items = payload.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'A purchase must contain at least one line item');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const supplier = await model.getSupplier(conn, Number(supplierId));
    if (!supplier) throw new ApiError(400, 'Supplier not found or inactive');
    if (!supplier.account_id) throw new ApiError(400, 'Supplier has no payable account configured');

    // Build item rows + accumulate subtotal (cents) + per-product demand.
    const prepared = [];
    const demand = {};        // productId -> qty
    const latestCost = {};    // productId -> cost string
    const byInventory = {};   // inventory account id -> cents
    let subtotalCents = 0;
    let order = 0;

    for (const raw of items) {
      order += 1;
      const productId = Number(raw.productId);
      if (!Number.isInteger(productId) || productId <= 0) {
        throw new ApiError(400, `Item #${order}: a valid productId is required`);
      }
      const quantity = Number(raw.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new ApiError(400, `Item #${order}: quantity must be a positive number`);
      }

      // Lock the product; cost falls back to the catalog cost when omitted.
      const product = await productModel.getForUpdate(conn, productId);
      if (!product) throw new ApiError(400, `Item #${order}: product not found or inactive`);
      // Only inventory-tracked goods (with an inventory account) can be stocked.
      if (!product.inventory_account_id) {
        throw new ApiError(400, `Item #${order}: '${product.name}' is not an inventory item (no inventory account) and cannot be purchased into stock`);
      }

      const rawCost = (raw.unitCost === undefined || raw.unitCost === null || raw.unitCost === '')
        ? product.cost_price : raw.unitCost;
      const unitCents = money.toCents(rawCost);
      const lineCents = Math.round(quantity * unitCents);
      subtotalCents += lineCents;

      const invAcct = product.inventory_account_id;
      byInventory[invAcct] = (byInventory[invAcct] || 0) + lineCents;
      demand[productId] = (demand[productId] || 0) + quantity;
      latestCost[productId] = money.fromCents(unitCents);

      const description = (raw.description || '').trim() || product.name;
      prepared.push({
        productId,
        description,
        quantity: money.fromCents(Math.round(quantity * 100)),
        unitCost: money.fromCents(unitCents),
        lineTotal: money.fromCents(lineCents),
        sortOrder: order,
      });
    }

    if (subtotalCents <= 0) throw new ApiError(400, 'Purchase total must be greater than zero');

    const year = new Date(purchaseDate).getFullYear();
    const purchaseNumber = await model.generateNextNumber(conn, year);
    const purchaseId = await model.createHeader(conn, {
      purchaseNumber,
      supplierId: Number(supplierId),
      purchaseDate,
      subtotal: money.fromCents(subtotalCents),
      totalAmount: money.fromCents(subtotalCents),
      notes: notes || null,
      createdBy: actor?.id,
    });

    for (const item of prepared) {
      await model.insertItem(conn, { purchaseId, ...item });
    }

    // Increase stock and refresh each product's last cost.
    for (const pidStr of Object.keys(demand)) {
      const pid = Number(pidStr);
      await productModel.adjustStock(conn, pid, demand[pid]);
      await productModel.setCostPrice(conn, pid, latestCost[pid]);
    }

    // Post Dr Inventory / Cr Supplier AP.
    const lines = [];
    for (const [acctId, cents] of Object.entries(byInventory)) {
      if (cents > 0) {
        lines.push({ accountId: Number(acctId), debit: money.fromCents(cents), credit: '0.00', memo: `مشتريات ${purchaseNumber}`, memoEn: `Purchase ${purchaseNumber}` });
      }
    }
    lines.push({ accountId: supplier.account_id, debit: '0.00', credit: money.fromCents(subtotalCents), memo: `ذمم مدينة - ${supplier.name}`, memoEn: `Payable - ${supplier.name}` });

    await journalService.createEntry(
      {
        entryDate: purchaseDate,
        description: `مشتريات من ${supplier.name} - ${purchaseNumber}`,
        descriptionEn: `Purchase from ${supplier.name} - ${purchaseNumber}`,
        referenceType: 'purchase',
        referenceId: purchaseId,
        lines,
      },
      actor,
      conn
    );

    await conn.commit();

    await audit.log({
      userId: actor?.id,
      action: 'purchase.create',
      entity: 'purchases',
      entityId: purchaseId,
      description: `Recorded purchase ${purchaseNumber} from ${supplier.name} (total ${money.fromCents(subtotalCents)})`,
      ip: actor?.ip,
    });

    return await model.getPurchaseFull(purchaseId);
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
  const purchase = await model.getPurchaseFull(Number(id));
  if (!purchase) throw new ApiError(404, 'Purchase not found');
  return purchase;
};

module.exports = { create, list, getById };
