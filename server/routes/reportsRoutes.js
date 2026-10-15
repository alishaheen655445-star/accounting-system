// -----------------------------------------------------------------------------
//  Reports routes — /api/reports/*   (read-only; any authenticated user)
// -----------------------------------------------------------------------------
const express = require('express');
const { param } = require('express-validator');
const controller = require('../controllers/reportsController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const accountIdParam = [param('accountId').isInt({ min: 1 }).withMessage('Invalid account id').toInt()];
const customerIdParam = [param('id').isInt({ min: 1 }).withMessage('Invalid customer id').toInt()];

router.use(authenticate);

router.get('/trial-balance', controller.trialBalance);
router.get('/chart-of-accounts', controller.chartOfAccounts);
router.get('/income-statement', controller.incomeStatement);
router.get('/general-ledger/:accountId', accountIdParam, validate, controller.generalLedger);
router.get('/customer-statement/:id', customerIdParam, validate, controller.customerStatement);

module.exports = router;
