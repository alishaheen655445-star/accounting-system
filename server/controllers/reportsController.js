// -----------------------------------------------------------------------------
//  Reports controller — thin HTTP layer over reportsService.
// -----------------------------------------------------------------------------
const service = require('../services/reportsService');
const { sendSuccess } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const { langOf } = require('../utils/i18n');

const trialBalance = asyncHandler(async (req, res) => {
  const report = await service.trialBalance(langOf(req));
  return sendSuccess(res, { message: 'Trial balance', data: report });
});

const chartOfAccounts = asyncHandler(async (req, res) => {
  const report = await service.chartOfAccounts(langOf(req));
  return sendSuccess(res, { message: 'Chart of accounts', data: report });
});

const generalLedger = asyncHandler(async (req, res) => {
  const report = await service.generalLedger(req.params.accountId, langOf(req));
  return sendSuccess(res, { message: 'General ledger', data: report });
});

const incomeStatement = asyncHandler(async (req, res) => {
  const report = await service.incomeStatement(langOf(req));
  return sendSuccess(res, { message: 'Income statement', data: report });
});

const customerStatement = asyncHandler(async (req, res) => {
  const report = await service.customerStatement(req.params.id);
  return sendSuccess(res, { message: 'Customer statement', data: report });
});

module.exports = { trialBalance, chartOfAccounts, generalLedger, incomeStatement, customerStatement };
