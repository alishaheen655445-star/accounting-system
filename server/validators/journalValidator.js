// -----------------------------------------------------------------------------
//  Validation rules for journal entries (requirement 23).
//  Structural checks live here; the BALANCE rule is enforced in the service.
// -----------------------------------------------------------------------------
const { body, param, query } = require('express-validator');

const createRules = [
  body('entryDate').isISO8601().withMessage('entryDate must be a valid date (YYYY-MM-DD)'),
  body('description').trim().notEmpty().withMessage('description is required')
    .isLength({ max: 255 }).withMessage('description is too long'),
  body('referenceType').optional().isIn(['manual', 'invoice', 'payment', 'opening'])
    .withMessage('Invalid referenceType'),
  body('lines').isArray({ min: 2 }).withMessage('At least two lines are required'),
  body('lines.*.accountId').isInt({ min: 1 }).withMessage('Each line needs a valid accountId').toInt(),
  body('lines.*.debit').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('debit must be >= 0'),
  body('lines.*.credit').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('credit must be >= 0'),
];

const listRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
];

const idParam = [param('id').isInt({ min: 1 }).withMessage('Invalid entry id').toInt()];

module.exports = { createRules, listRules, idParam };
