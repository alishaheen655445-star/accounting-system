// -----------------------------------------------------------------------------
//  Customer controller — thin HTTP layer (parse req -> call service -> respond).
// -----------------------------------------------------------------------------
const service = require('../services/customerService');
const { sendSuccess, sendCreated } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

// The acting user (from auth middleware) + request ip, passed to the service
// so it can record them in the audit log.
const actorOf = (req) => ({ id: req.user?.id, ip: req.ip });

const list = asyncHandler(async (req, res) => {
  const { search = '', isActive = null, page = 1, pageSize = 10 } = req.query;
  const data = await service.list({ search, isActive, page: Number(page), pageSize: Number(pageSize) });
  return sendSuccess(res, { message: 'Customers retrieved', data: data.items, meta: data.meta });
});

const getById = asyncHandler(async (req, res) => {
  const customer = await service.getById(req.params.id);
  return sendSuccess(res, { message: 'Customer retrieved', data: { customer } });
});

const create = asyncHandler(async (req, res) => {
  const customer = await service.create(req.body, actorOf(req));
  return sendCreated(res, { message: 'Customer created', data: { customer } });
});

const update = asyncHandler(async (req, res) => {
  const customer = await service.update(req.params.id, req.body, actorOf(req));
  return sendSuccess(res, { message: 'Customer updated', data: { customer } });
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id, actorOf(req));
  return sendSuccess(res, { message: 'Customer deactivated' });
});

module.exports = { list, getById, create, update, remove };
