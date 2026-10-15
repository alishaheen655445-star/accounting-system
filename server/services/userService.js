// -----------------------------------------------------------------------------
//  User service — business logic for admin user management.
//  Passwords are bcrypt-hashed here (never in the model/controller); the hash is
//  never returned to the client (the model selects SAFE_COLUMNS only). Every
//  mutation is written to the audit trail (requirement 25), and an admin cannot
//  lock themselves out by deactivating their own account.
// -----------------------------------------------------------------------------
const bcrypt = require('bcrypt');
const model = require('../models/userModel');
const audit = require('./auditService');
const ApiError = require('../utils/ApiError');

const BCRYPT_ROUNDS = 12;

const list = async ({ search = '', page = 1, pageSize = 10 }) => {
  const offset = (page - 1) * pageSize;
  const { rows, total } = await model.findAll({ search, limit: pageSize, offset });
  return {
    items: rows,
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
};

const getById = async (id) => {
  const user = await model.findById(id);
  if (!user) throw new ApiError(404, 'User not found');
  return user;
};

const create = async (data, actor) => {
  if (await model.usernameOrEmailTaken({ username: data.username, email: data.email })) {
    throw new ApiError(409, 'Username or email already in use');
  }
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const id = await model.create({
    username: data.username,
    email: data.email,
    passwordHash,
    fullName: data.fullName,
    role: data.role || 'viewer',
  });
  const created = await model.findById(id);
  await audit.log({
    userId: actor?.id, action: 'user.create', entity: 'users', entityId: id,
    description: `Created user ${created.username} (role ${created.role})`, ip: actor?.ip,
  });
  return created;
};

const update = async (id, data, actor) => {
  const existing = await model.findById(id);
  if (!existing) throw new ApiError(404, 'User not found');

  if (data.username || data.email) {
    if (await model.usernameOrEmailTaken({
      username: data.username || existing.username,
      email: data.email || existing.email,
      excludeId: id,
    })) {
      throw new ApiError(409, 'Username or email already in use');
    }
  }

  const fields = {};
  if (data.username !== undefined) fields.username = data.username;
  if (data.email !== undefined) fields.email = data.email;
  if (data.fullName !== undefined) fields.full_name = data.fullName;
  if (data.role !== undefined) fields.role = data.role;
  if (data.isActive !== undefined) fields.is_active = data.isActive ? 1 : 0;
  if (data.password) fields.password_hash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  // Guard: never let an admin disable their own account (self lock-out).
  if (fields.is_active === 0 && Number(id) === Number(actor?.id)) {
    throw new ApiError(400, 'You cannot deactivate your own account');
  }

  await model.update(id, fields);
  const updated = await model.findById(id);
  await audit.log({
    userId: actor?.id, action: 'user.update', entity: 'users', entityId: id,
    description: `Updated user ${updated.username} (fields: ${Object.keys(fields).join(', ')})`, ip: actor?.ip,
  });
  return updated;
};

const remove = async (id, actor) => {
  const existing = await model.findById(id);
  if (!existing) throw new ApiError(404, 'User not found');
  if (Number(id) === Number(actor?.id)) {
    throw new ApiError(400, 'You cannot deactivate your own account');
  }
  await model.deactivate(id); // soft disable
  await audit.log({
    userId: actor?.id, action: 'user.delete', entity: 'users', entityId: id,
    description: `Deactivated user ${existing.username}`, ip: actor?.ip,
  });
};

module.exports = { list, getById, create, update, remove };
