// -----------------------------------------------------------------------------
//  Purchase routes — /api/purchases/*   (all require authentication)
//    GET  : any authenticated user
//    POST : accountant or admin only (viewer is read-only)
// -----------------------------------------------------------------------------
const express = require('express');
const controller = require('../controllers/purchaseController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createRules, listRules, idParam } = require('../validators/purchaseValidator');

const router = express.Router();

router.use(authenticate);
const WRITE_ROLES = authorize('admin', 'accountant');

router.get('/', listRules, validate, controller.list);
router.get('/:id', idParam, validate, controller.getById);
router.post('/', WRITE_ROLES, createRules, validate, controller.create);

module.exports = router;
