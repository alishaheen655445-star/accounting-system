// -----------------------------------------------------------------------------
//  Purchase controller — thin HTTP layer over purchaseService.
// -----------------------------------------------------------------------------
const service = require('../services/purchaseService');
const { sendSuccess, sendCreated } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

const actorOf = (req) => ({ id: req.user?.id, ip: req.ip });

const create = asyncHandler(async (req, res) => {
  const purchase = await service.create(req.body, actorOf(req));
  return sendCreated(res, { message: 'Purchase recorded', data: { purchase } });
});

const list = asyncHandler(async (req, res) => {
  const { page = 1, pageSize = 20 } = req.query;
  const data = await service.list({ page: Number(page), pageSize: Number(pageSize) });
  return sendSuccess(res, { message: 'Purchases retrieved', data: data.items, meta: data.meta });
});

const getById = asyncHandler(async (req, res) => {
  const purchase = await service.getById(req.params.id);
  return sendSuccess(res, { message: 'Purchase retrieved', data: { purchase } });
});

module.exports = { create, list, getById };
