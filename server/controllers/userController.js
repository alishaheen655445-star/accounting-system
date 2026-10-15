// -----------------------------------------------------------------------------
//  User controller — thin HTTP layer over userService (admin-only management).
// -----------------------------------------------------------------------------
const service = require('../services/userService');
const { sendSuccess, sendCreated } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

const actorOf = (req) => ({ id: req.user?.id, ip: req.ip });

const list = asyncHandler(async (req, res) => {
  const { search = '', page = 1, pageSize = 10 } = req.query;
  const data = await service.list({ search, page: Number(page), pageSize: Number(pageSize) });
  return sendSuccess(res, { message: 'Users retrieved', data: data.items, meta: data.meta });
});

const getById = asyncHandler(async (req, res) => {
  const user = await service.getById(req.params.id);
  return sendSuccess(res, { message: 'User retrieved', data: { user } });
});

const create = asyncHandler(async (req, res) => {
  const user = await service.create(req.body, actorOf(req));
  return sendCreated(res, { message: 'User created', data: { user } });
});

const update = asyncHandler(async (req, res) => {
  const user = await service.update(req.params.id, req.body, actorOf(req));
  return sendSuccess(res, { message: 'User updated', data: { user } });
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id, actorOf(req));
  return sendSuccess(res, { message: 'User deactivated' });
});

module.exports = { list, getById, create, update, remove };
