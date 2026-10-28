// -----------------------------------------------------------------------------
//  Supplier-payment validators — enforce request shape before it reaches the
//  service. Payment method is restricted to cash / card (project convention).
// -----------------------------------------------------------------------------
const { body } = require('express-validator');

const MONEY = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

const createRules = [
  body('supplierId').isInt({ min: 1 }).withMessage('Valid supplierId is required').toInt(),
  body('purchaseId').optional().custom((v) => {
    if (v === null || v === undefined || v === '') return true;
    if (!Number.isInteger(Number(v)) || Number(v) <= 0) throw new Error('purchaseId must be a positive integer');
    return true;
  }),
  body('amount').exists().withMessage('amount is required')
    .matches(MONEY).withMessage('amount must be a positive number with up to 2 decimals'),
  body('paymentDate').exists().withMessage('paymentDate is required')
    .isISO8601().withMessage('paymentDate must be a valid ISO date (YYYY-MM-DD)'),
  body('method').optional().isIn(['cash', 'card']).withMessage('method must be cash or card'),
  body('reference').optional({ values: 'null' }).isLength({ max: 100 }).withMessage('reference must be at most 100 characters'),
];

module.exports = { createRules };
