// -----------------------------------------------------------------------------
//  Invoice controller — thin HTTP layer over invoiceService.
// -----------------------------------------------------------------------------
const service = require('../services/invoiceService');
const { sendSuccess, sendCreated } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const { langOf } = require('../utils/i18n');

const actorOf = (req) => ({ id: req.user?.id, ip: req.ip });

const create = asyncHandler(async (req, res) => {
  const invoice = await service.create(req.body, actorOf(req), langOf(req));
  return sendCreated(res, { message: 'Invoice created', data: { invoice } });
});

const list = asyncHandler(async (req, res) => {
  const { page = 1, pageSize = 20 } = req.query;
  const data = await service.list({ page: Number(page), pageSize: Number(pageSize) });
  return sendSuccess(res, { message: 'Invoices retrieved', data: data.items, meta: data.meta });
});

const getById = asyncHandler(async (req, res) => {
  const invoice = await service.getById(req.params.id, langOf(req));
  return sendSuccess(res, { message: 'Invoice retrieved', data: { invoice } });
});

module.exports = { create, list, getById };
