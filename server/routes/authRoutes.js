// -----------------------------------------------------------------------------
//  Auth routes — /api/auth/*
// -----------------------------------------------------------------------------
const express = require('express');
const authController = require('../controllers/authController');
const { loginRules } = require('../validators/authValidator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Public
router.post('/login', loginRules, validate, authController.login);

// Protected — requires a valid Bearer token
router.get('/me', authenticate, authController.me);

module.exports = router;
