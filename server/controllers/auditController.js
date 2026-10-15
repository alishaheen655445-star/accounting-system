// -----------------------------------------------------------------------------
//  Audit controller — read-only HTTP layer over auditService (ADMIN ONLY).
// -----------------------------------------------------------------------------
const service = require('../services/auditService');
const { sendSuccess } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const { search = '', entity = '', page = 1, pageSize = 20 } = req.query;
  const data = await service.list({ search, entity, page: Number(page), pageSize: Number(pageSize) });
  return sendSuccess(res, { message: 'Audit log retrieved', data: data.items, meta: data.meta });
});

const entities = asyncHandler(async (_req, res) => {
  const list = await service.entities();
  return sendSuccess(res, { message: 'Audit entities retrieved', data: { entities: list } });
});

module.exports = { list, entities };
