// -----------------------------------------------------------------------------
//  Validation rules for auth endpoints (requirement 23 — backend validation).
//  These are express-validator chains, applied on the route before the handler.
// -----------------------------------------------------------------------------
const { body } = require('express-validator');

const loginRules = [
  body('identifier')
    .trim()
    .notEmpty().withMessage('Username or email is required')
    .isLength({ min: 3 }).withMessage('Identifier is too short'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const registerRules = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
    .matches(/^[a-zA-Z0-9_.-]+$/).withMessage('Username has invalid characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('A valid email is required')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('fullName')
    .trim()
    .notEmpty().withMessage('Full name is required')
    .isLength({ max: 120 }).withMessage('Full name is too long'),
  body('role')
    .optional()
    .isIn(['admin', 'accountant', 'viewer']).withMessage('Invalid role'),
];

module.exports = { loginRules, registerRules };
