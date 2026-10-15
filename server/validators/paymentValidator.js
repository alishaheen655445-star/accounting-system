// -----------------------------------------------------------------------------
//  Payment validators — enforce request shape before it reaches the service.
// -----------------------------------------------------------------------------
const { body } = require('express-validator');

const MONEY = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

const createRules = [
  body('amount').exists().withMessage('amount is required')
    .matches(MONEY).withMessage('amount must be a positive number with up to 2 decimals'),
  body('paymentDate').exists().withMessage('paymentDate is required')
    .isISO8601().withMessage('paymentDate must be a valid ISO date (YYYY-MM-DD)'),
  body('method').optional().isIn(['cash', 'bank', 'cheque', 'card']).withMessage('method must be one of cash, bank, cheque, card'),
  body('invoiceId').optional().custom((v) => {
    if (v === null || v === undefined || v === '') return true;
    if (!Number.isInteger(Number(v)) || Number(v) <= 0) throw new Error('invoiceId must be a positive integer');
    return true;
  }),
  body('customerId').optional().custom((v) => {
    if (v === null || v === undefined || v === '') return true;
    if (!Number.isInteger(Number(v)) || Number(v) <= 0) throw new Error('customerId must be a positive integer');
    return true;
  }),
  body('reference').optional({ values: 'null' }).isLength({ max: 100 }).withMessage('reference must be at most 100 characters'),
];

const idParam = [body('id').optional().isInt({ min: 1 })];

module.exports = { createRules, idParam };
