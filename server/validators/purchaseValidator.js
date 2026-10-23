// -----------------------------------------------------------------------------
//  Validation rules for purchases (requirement 23 — backend never trusts client).
// -----------------------------------------------------------------------------
const { body, param, query } = require('express-validator');

const createRules = [
  body('supplierId').isInt({ min: 1 }).withMessage('Valid supplierId is required').toInt(),
  body('purchaseDate').isISO8601().withMessage('purchaseDate must be a valid date'),
  body('notes').optional({ values: 'falsy' }).trim().isLength({ max: 255 }).withMessage('notes too long'),
  body('items').isArray({ min: 1 }).withMessage('At least one line item is required'),
  body('items.*.productId').isInt({ min: 1 }).withMessage('Each purchase line must reference a product').toInt(),
  body('items.*.quantity').isFloat({ gt: 0 }).withMessage('Each item quantity must be > 0'),
  body('items.*.unitCost').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('unitCost must be >= 0'),
  body('items.*.description').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
];

const listRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
];

const idParam = [param('id').isInt({ min: 1 }).withMessage('Invalid purchase id').toInt()];

module.exports = { createRules, listRules, idParam };
