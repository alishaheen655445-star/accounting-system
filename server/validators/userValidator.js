// -----------------------------------------------------------------------------
//  Validation rules for user management (requirement 23 — backend never trusts
//  the client). Password is required on create but OPTIONAL on update (blank =
//  keep the existing hash, handled in the service).
// -----------------------------------------------------------------------------
const { body, param, query } = require('express-validator');

const username = body('username').trim()
  .notEmpty().withMessage('Username is required')
  .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
  .matches(/^[a-zA-Z0-9_.-]+$/).withMessage('Username has invalid characters');
const email = body('email').trim()
  .notEmpty().withMessage('Email is required')
  .isEmail().withMessage('A valid email is required').normalizeEmail();
const fullName = body('fullName').trim()
  .notEmpty().withMessage('Full name is required')
  .isLength({ max: 120 }).withMessage('Full name is too long');
const role = body('role').optional({ values: 'falsy' })
  .isIn(['admin', 'accountant', 'viewer']).withMessage('Invalid role');

const createRules = [
  username, email, fullName, role,
  body('password').notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

// On update everything is optional; password blank/omitted means "unchanged".
const updateRules = [
  param('id').isInt({ min: 1 }).withMessage('Invalid user id').toInt(),
  body('username').optional({ values: 'falsy' }).trim()
    .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
    .matches(/^[a-zA-Z0-9_.-]+$/).withMessage('Username has invalid characters'),
  body('email').optional({ values: 'falsy' }).trim()
    .isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('fullName').optional({ values: 'falsy' }).trim()
    .notEmpty().withMessage('Full name cannot be empty')
    .isLength({ max: 120 }).withMessage('Full name is too long'),
  role,
  body('password').optional({ values: 'falsy' })
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean').toBoolean(),
];

const idParam = [param('id').isInt({ min: 1 }).withMessage('Invalid user id').toInt()];

const listRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1').toInt(),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).withMessage('pageSize must be 1-100').toInt(),
  query('search').optional().trim().isLength({ max: 100 }).withMessage('search is too long'),
];

module.exports = { createRules, updateRules, idParam, listRules };
