// -----------------------------------------------------------------------------
//  User routes — /api/users/*   (ADMIN ONLY — user management is privileged).
//  Every route requires a valid token AND the 'admin' role (requirement 20).
// -----------------------------------------------------------------------------
const express = require('express');
const controller = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createRules, updateRules, idParam, listRules } = require('../validators/userValidator');

const router = express.Router();

router.use(authenticate);
const ADMIN_ONLY = authorize('admin');

router.get('/', ADMIN_ONLY, listRules, validate, controller.list);
router.get('/:id', ADMIN_ONLY, idParam, validate, controller.getById);
router.post('/', ADMIN_ONLY, createRules, validate, controller.create);
router.put('/:id', ADMIN_ONLY, updateRules, validate, controller.update);
router.delete('/:id', ADMIN_ONLY, idParam, validate, controller.remove);

module.exports = router;
