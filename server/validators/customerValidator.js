// -----------------------------------------------------------------------------
//  Validation rules for customers (requirement 23 — backend never trusts client).
// -----------------------------------------------------------------------------
const { body, param, query } = require('express-validator');

// shared field chains reused by create + update
const name = body('name').trim().notEmpty().withMessage('Name is required')
  .isLength({ max: 150 }).withMessage('Name is too long');
const email = body('email').optional({ values: 'falsy' }).trim()
  .isEmail().withMessage('A valid email is required').normalizeEmail();
const phone = body('phone').optional({ values: 'falsy' }).trim()
  .isLength({ max: 30 }).withMessage('Phone is too long');
const address = body('address').optional({ values: 'falsy' }).trim()
  .isLength({ max: 255 }).withMessage('Address is too long');
const creditLimit = body('creditLimit').optional({ values: 'falsy' })
  .isFloat({ min: 0 }).withMessage('Credit limit must be a positive number');
const openingBalance = body('openingBalance').optional({ values: 'falsy' })
  .isFloat({ min: 0 }).withMessage('Opening balance must be a positive number');
const accountId = body('accountId').optional({ values: 'falsy' })
  .isInt({ min: 1 }).withMessage('Account ID must be a positive integer')
  .toInt();

const createRules = [
  body('customerCode').optional({ values: 'falsy' }).trim()
    .isLength({ min: 1, max: 20 }).withMessage('Customer code is too long'),
  name, email, phone, address, creditLimit, openingBalance, accountId,
];

// On update everything is optional (partial update), but still validated if sent.
const updateRules = [
  param('id').isInt({ min: 1 }).withMessage('Invalid customer id').toInt(),
  body('customerCode').optional({ values: 'falsy' }).trim()
    .isLength({ min: 1, max: 20 }).withMessage('Customer code is too long'),
  body('name').optional({ values: 'falsy' }).trim()
    .notEmpty().withMessage('Name cannot be empty')
    .isLength({ max: 150 }).withMessage('Name is too long'),
  email, phone, address, creditLimit, openingBalance, accountId,
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean').toBoolean(),
];

const idParam = [param('id').isInt({ min: 1 }).withMessage('Invalid customer id').toInt()];

const listRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1').toInt(),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).withMessage('pageSize must be 1-100').toInt(),
  query('search').optional().trim().isLength({ max: 100 }).withMessage('search is too long'),
  query('isActive').optional().isBoolean().withMessage('isActive must be boolean').toBoolean(),
];

module.exports = { createRules, updateRules, idParam, listRules };
