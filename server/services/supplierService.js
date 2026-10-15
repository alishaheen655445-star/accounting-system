// -----------------------------------------------------------------------------
//  Supplier service — business logic (independent of HTTP).
//  Mirrors customerService.js: duplicate rules, auto code generation, camelCase
//  -> snake_case mapping, and audit-log entries (req. 25).
// -----------------------------------------------------------------------------
const model = require('../models/supplierModel');
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
  if (!row) throw new ApiError(404, 'Supplier not found');
  return row;
};

const create = async (data, actor) => {
  let supplierCode = data.supplierCode?.trim();
  if (supplierCode) {
    if (await model.codeExists(supplierCode)) {
      throw new ApiError(409, 'Supplier code already exists');
    }
  } else {
    do { supplierCode = await model.generateNextCode(); }
    while (await model.codeExists(supplierCode));
  }

  const id = await model.create({ ...data, supplierCode });
  const created = await model.findById(id);

  await audit.log({
    userId: actor?.id,
    action: 'supplier.create',
    entity: 'suppliers',
    entityId: id,
    description: `Created supplier ${created.name} (${supplierCode})`,
    ip: actor?.ip,
  });
  return created;
};

const update = async (id, data, actor) => {
  const existing = await model.findById(id);
  if (!existing) throw new ApiError(404, 'Supplier not found');

  if (data.supplierCode && data.supplierCode !== existing.supplier_code) {
    if (await model.codeExists(data.supplierCode, id)) {
      throw new ApiError(409, 'Supplier code already exists');
    }
  }

  const fields = {};
  if (data.supplierCode !== undefined) fields.supplier_code = data.supplierCode;
  if (data.name !== undefined) fields.name = data.name;
  if (data.email !== undefined) fields.email = data.email;
  if (data.phone !== undefined) fields.phone = data.phone;
  if (data.address !== undefined) fields.address = data.address;
  if (data.openingBalance !== undefined) fields.opening_balance = data.openingBalance;
  if (data.accountId !== undefined) fields.account_id = data.accountId;
  if (data.isActive !== undefined) fields.is_active = data.isActive ? 1 : 0;

  await model.update(id, fields);
  const updated = await model.findById(id);

  await audit.log({
    userId: actor?.id,
    action: 'supplier.update',
    entity: 'suppliers',
    entityId: id,
    description: `Updated supplier ${updated.name} (fields: ${Object.keys(fields).join(', ')})`,
    ip: actor?.ip,
  });
  return updated;
};

const remove = async (id, actor) => {
  const existing = await model.findById(id);
  if (!existing) throw new ApiError(404, 'Supplier not found');

  await model.deactivate(id); // soft delete

  await audit.log({
    userId: actor?.id,
    action: 'supplier.delete',
    entity: 'suppliers',
    entityId: id,
    description: `Deactivated supplier ${existing.name}`,
    ip: actor?.ip,
  });
};

module.exports = { list, getById, create, update, remove };
