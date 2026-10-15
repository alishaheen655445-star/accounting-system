// -----------------------------------------------------------------------------
//  Product routes — /api/products/*   (all require authentication)
//  Role rules (requirement 20 — role-based authorization):
//    GET    : any authenticated user (viewer, accountant, admin)
//    POST/PUT/DELETE : accountant or admin only  (viewer is read-only)
// -----------------------------------------------------------------------------
const express = require('express');
const controller = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createRules, updateRules, idParam, listRules } = require('../validators/productValidator');

const router = express.Router();

router.use(authenticate);

const WRITE_ROLES = authorize('admin', 'accountant');

router.get('/', listRules, validate, controller.list);
router.get('/:id', idParam, validate, controller.getById);
router.post('/', WRITE_ROLES, createRules, validate, controller.create);
router.put('/:id', WRITE_ROLES, updateRules, validate, controller.update);
router.delete('/:id', WRITE_ROLES, idParam, validate, controller.remove);

module.exports = router;
