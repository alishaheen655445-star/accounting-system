// -----------------------------------------------------------------------------
//  Supplier-payment controller — thin HTTP layer over supplierPaymentService.
// -----------------------------------------------------------------------------
const service = require('../services/supplierPaymentService');
const { sendSuccess, sendCreated } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const create = asyncHandler(async (req, res) => {
  const payment = await service.create(req.body, { ...req.user, ip: req.ip });
  return sendCreated(res, { message: 'Supplier payment recorded', data: payment });
});

const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
  const { items, meta } = await service.list({ page, pageSize });
  return sendSuccess(res, { message: 'Supplier payments list', data: items, meta });
});

const getById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid supplier payment id');
  const payment = await service.getById(id);
  return sendSuccess(res, { message: 'Supplier payment detail', data: payment });
});

module.exports = { create, list, getById };
