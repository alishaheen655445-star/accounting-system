// -----------------------------------------------------------------------------
//  Validation rules for invoices (requirement 23).
// -----------------------------------------------------------------------------
const { body, param, query } = require('express-validator');

const createRules = [
  body('customerId').isInt({ min: 1 }).withMessage('Valid customerId is required').toInt(),
  body('invoiceDate').isISO8601().withMessage('invoiceDate must be a valid date'),
  body('dueDate').optional({ values: 'falsy' }).isISO8601().withMessage('dueDate must be a valid date'),
  body('taxRate').optional({ values: 'falsy' }).isFloat({ min: 0, max: 100 }).withMessage('taxRate must be 0-100'),
  body('status').optional().isIn(['draft', 'issued']).withMessage('status must be draft or issued'),
  body('notes').optional({ values: 'falsy' }).trim().isLength({ max: 255 }).withMessage('notes too long'),
  body('items').isArray({ min: 1 }).withMessage('At least one line item is required'),
  body('items.*.quantity').isFloat({ gt: 0 }).withMessage('Each item quantity must be > 0'),
  body('items.*.productId').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
  body('items.*.unitPrice').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('unitPrice must be >= 0'),
  body('items.*.description').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
];

const listRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
];

const idParam = [param('id').isInt({ min: 1 }).withMessage('Invalid invoice id').toInt()];

module.exports = { createRules, listRules, idParam };
