// -----------------------------------------------------------------------------
//  Product service — business logic for the products catalog.
//  Mirrors customer/supplier services: duplicate sku rules, auto sku generation,
//  camelCase -> snake_case mapping, and audit-log entries (req. 25).
// -----------------------------------------------------------------------------
const model = require('../models/productModel');
const audit = require('./auditService');
const ApiError = require('../utils/ApiError');

const list = async ({ search, isActive, page, pageSize }) => {
  const limit = pageSize;
  const offset = (page - 1) * pageSize;
  const { rows, total } = await model.findAll({ search, isActive, limit, offset });
  return {
    items: rows,
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
};

const getById = async (id) => {
  const row = await model.findById(id);
  if (!row) throw new ApiError(404, 'Product not found');
  return row;
};

const create = async (data, actor) => {
  let sku = data.sku?.trim();
  if (sku) {
    if (await model.skuExists(sku)) {
      throw new ApiError(409, 'Product sku already exists');
    }
  } else {
    do { sku = await model.generateNextSku(); }
    while (await model.skuExists(sku));
  }

  const id = await model.create({ ...data, sku });
  const created = await model.findById(id);

  await audit.log({
    userId: actor?.id,
    action: 'product.create',
    entity: 'products',
    entityId: id,
    description: `Created product ${created.name} (${sku})`,
    ip: actor?.ip,
  });
  return created;
};

const update = async (id, data, actor) => {
  const existing = await model.findById(id);
  if (!existing) throw new ApiError(404, 'Product not found');

  if (data.sku && data.sku !== existing.sku) {
    if (await model.skuExists(data.sku, id)) {
      throw new ApiError(409, 'Product sku already exists');
    }
  }

  const fields = {};
  if (data.sku !== undefined) fields.sku = data.sku;
  if (data.name !== undefined) fields.name = data.name;
  if (data.description !== undefined) fields.description = data.description;
  if (data.unit !== undefined) fields.unit = data.unit;
  if (data.sellingPrice !== undefined) fields.selling_price = data.sellingPrice;
  if (data.costPrice !== undefined) fields.cost_price = data.costPrice;
  if (data.revenueAccountId !== undefined) fields.revenue_account_id = data.revenueAccountId;
  if (data.inventoryAccountId !== undefined) fields.inventory_account_id = data.inventoryAccountId;
  if (data.isActive !== undefined) fields.is_active = data.isActive ? 1 : 0;

  await model.update(id, fields);
  const updated = await model.findById(id);

  await audit.log({
    userId: actor?.id,
    action: 'product.update',
    entity: 'products',
    entityId: id,
    description: `Updated product ${updated.name} (fields: ${Object.keys(fields).join(', ')})`,
    ip: actor?.ip,
  });
  return updated;
};

const remove = async (id, actor) => {
  const existing = await model.findById(id);
  if (!existing) throw new ApiError(404, 'Product not found');

  await model.deactivate(id); // soft delete

  await audit.log({
    userId: actor?.id,
    action: 'product.delete',
    entity: 'products',
    entityId: id,
    description: `Deactivated product ${existing.name}`,
    ip: actor?.ip,
  });
};

module.exports = { list, getById, create, update, remove };
