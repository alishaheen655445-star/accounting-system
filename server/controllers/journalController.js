// -----------------------------------------------------------------------------
//  Journal controller — thin HTTP layer over journalService.
// -----------------------------------------------------------------------------
const service = require('../services/journalService');
const { sendSuccess, sendCreated } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const { langOf } = require('../utils/i18n');

const actorOf = (req) => ({ id: req.user?.id, ip: req.ip });

const create = asyncHandler(async (req, res) => {
  const entry = await service.createEntry(req.body, actorOf(req), null, langOf(req));
  return sendCreated(res, { message: 'Journal entry posted', data: { entry } });
});

const list = asyncHandler(async (req, res) => {
  const { page = 1, pageSize = 20 } = req.query;
  const data = await service.list({ page: Number(page), pageSize: Number(pageSize), lang: langOf(req) });
  return sendSuccess(res, { message: 'Journal entries retrieved', data: data.items, meta: data.meta });
});

const getById = asyncHandler(async (req, res) => {
  const entry = await service.getById(req.params.id, langOf(req));
  return sendSuccess(res, { message: 'Journal entry retrieved', data: { entry } });
});

const listAccounts = asyncHandler(async (req, res) => {
  const accounts = await service.listAccounts(langOf(req));
  return sendSuccess(res, { message: 'Accounts retrieved', data: { accounts } });
});

module.exports = { create, list, getById, listAccounts };
