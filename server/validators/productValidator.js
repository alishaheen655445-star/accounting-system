// -----------------------------------------------------------------------------
//  Validation rules for products (requirement 23 — backend never trusts client).
// -----------------------------------------------------------------------------
const { body, param, query } = require('express-validator');

const name = body('name').trim().notEmpty().withMessage('Name is required')
  .isLength({ max: 150 }).withMessage('Name is too long');
const description = body('description').optional({ values: 'falsy' }).trim()
  .isLength({ max: 255 }).withMessage('Description is too long');
const unit = body('unit').optional({ values: 'falsy' }).trim()
  .isLength({ max: 20 }).withMessage('Unit is too long');
const sellingPrice = body('sellingPrice').optional({ values: 'falsy' })
  .isFloat({ min: 0 }).withMessage('Selling price must be a positive number');
const costPrice = body('costPrice').optional({ values: 'falsy' })
  .isFloat({ min: 0 }).withMessage('Cost price must be a positive number');
const revenueAccountId = body('revenueAccountId').optional({ values: 'falsy' })
  .isInt({ min: 1 }).withMessage('Revenue account ID must be a positive integer').toInt();
const inventoryAccountId = body('inventoryAccountId').optional({ values: 'falsy' })
  .isInt({ min: 1 }).withMessage('Inventory account ID must be a positive integer').toInt();
const type = body('type').optional({ values: 'falsy' }).toLowerCase()
  .isIn(['goods', 'service']).withMessage('Type must be goods or service');

const createRules = [
  body('sku').optional({ values: 'falsy' }).trim()
    .isLength({ min: 1, max: 30 }).withMessage('Sku is too long'),
  name, description, unit, sellingPrice, costPrice, revenueAccountId, inventoryAccountId, type,
];

const updateRules = [
  param('id').isInt({ min: 1 }).withMessage('Invalid product id').toInt(),
  body('sku').optional({ values: 'falsy' }).trim()
    .isLength({ min: 1, max: 30 }).withMessage('Sku is too long'),
  body('name').optional({ values: 'falsy' }).trim()
    .notEmpty().withMessage('Name cannot be empty')
    .isLength({ max: 150 }).withMessage('Name is too long'),
  description, unit, sellingPrice, costPrice, revenueAccountId, inventoryAccountId, type,
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean').toBoolean(),
];

const idParam = [param('id').isInt({ min: 1 }).withMessage('Invalid product id').toInt()];

const listRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1').toInt(),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).withMessage('pageSize must be 1-100').toInt(),
  query('search').optional().trim().isLength({ max: 100 }).withMessage('search is too long'),
  query('isActive').optional().isBoolean().withMessage('isActive must be boolean').toBoolean(),
];

module.exports = { createRules, updateRules, idParam, listRules };
