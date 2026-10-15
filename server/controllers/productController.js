// -----------------------------------------------------------------------------
//  Product controller — thin HTTP layer (parse req -> call service -> respond).
// -----------------------------------------------------------------------------
const service = require('../services/productService');
const { sendSuccess, sendCreated } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

const actorOf = (req) => ({ id: req.user?.id, ip: req.ip });

const list = asyncHandler(async (req, res) => {
  const { search = '', isActive = null, page = 1, pageSize = 10 } = req.query;
  const data = await service.list({ search, isActive, page: Number(page), pageSize: Number(pageSize) });
  return sendSuccess(res, { message: 'Products retrieved', data: data.items, meta: data.meta });
});

const getById = asyncHandler(async (req, res) => {
  const product = await service.getById(req.params.id);
  return sendSuccess(res, { message: 'Product retrieved', data: { product } });
});

const create = asyncHandler(async (req, res) => {
  const product = await service.create(req.body, actorOf(req));
  return sendCreated(res, { message: 'Product created', data: { product } });
});

const update = asyncHandler(async (req, res) => {
  const product = await service.update(req.params.id, req.body, actorOf(req));
  return sendSuccess(res, { message: 'Product updated', data: { product } });
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id, actorOf(req));
  return sendSuccess(res, { message: 'Product deactivated' });
});

module.exports = { list, getById, create, update, remove };
