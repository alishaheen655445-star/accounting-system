// -----------------------------------------------------------------------------
//  Customer service — business logic (independent of HTTP).
//  Responsibilities: enforce duplicate rules, auto-generate codes, map camelCase
//  input -> snake_case columns, and write audit-log entries (req. 25).
// -----------------------------------------------------------------------------
const model = require('../models/customerModel');
const audit = require('./auditService');
const ApiError = require('../utils/ApiError');

const list = async ({ search, isActive, page, pageSize }) => {
  const limit = pageSize;
  const offset = (page - 1) * pageSize;
  const { rows, total } = await model.findAll({ search, isActive, limit, offset });
  return {
    items: rows,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
};

const getById = async (id) => {
  const row = await model.findById(id);
  if (!row) throw new ApiError(404, 'Customer not found');
  return row;
};

const create = async (data, actor) => {
  let customerCode = data.customerCode?.trim();
  if (customerCode) {
    if (await model.codeExists(customerCode)) {
      throw new ApiError(409, 'Customer code already exists');
    }
  } else {
    // generate and ensure uniqueness
    do { customerCode = await model.generateNextCode(); }
    while (await model.codeExists(customerCode));
  }

  const id = await model.create({ ...data, customerCode });
  const created = await model.findById(id);

  await audit.log({
    userId: actor?.id,
    action: 'customer.create',
    entity: 'customers',
    entityId: id,
    description: `Created customer ${created.name} (${customerCode})`,
    ip: actor?.ip,
  });
  return created;
};

const update = async (id, data, actor) => {
  const existing = await model.findById(id);
  if (!existing) throw new ApiError(404, 'Customer not found');

  if (data.customerCode && data.customerCode !== existing.customer_code) {
    if (await model.codeExists(data.customerCode, id)) {
      throw new ApiError(409, 'Customer code already exists');
    }
  }

  // Map only allowed, provided fields to columns (whitelist prevents injection).
  const fields = {};
  if (data.customerCode !== undefined) fields.customer_code = data.customerCode;
  if (data.name !== undefined) fields.name = data.name;
  if (data.email !== undefined) fields.email = data.email;
  if (data.phone !== undefined) fields.phone = data.phone;
  if (data.address !== undefined) fields.address = data.address;
  if (data.creditLimit !== undefined) fields.credit_limit = data.creditLimit;
  if (data.openingBalance !== undefined) fields.opening_balance = data.openingBalance;
  if (data.accountId !== undefined) fields.account_id = data.accountId;
  if (data.isActive !== undefined) fields.is_active = data.isActive ? 1 : 0;

  await model.update(id, fields);
  const updated = await model.findById(id);

  await audit.log({
    userId: actor?.id,
    action: 'customer.update',
    entity: 'customers',
    entityId: id,
    description: `Updated customer ${updated.name} (fields: ${Object.keys(fields).join(', ')})`,
    ip: actor?.ip,
  });
  return updated;
};

const remove = async (id, actor) => {
  const existing = await model.findById(id);
  if (!existing) throw new ApiError(404, 'Customer not found');

  await model.deactivate(id); // soft delete

  await audit.log({
    userId: actor?.id,
    action: 'customer.delete',
    entity: 'customers',
    entityId: id,
    description: `Deactivated customer ${existing.name}`,
    ip: actor?.ip,
  });
};

module.exports = { list, getById, create, update, remove };
