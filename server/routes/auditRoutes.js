// -----------------------------------------------------------------------------
//  Audit routes — /api/audit/*   (ADMIN ONLY, READ-ONLY).
//  The audit trail is immutable, so there are no create/update/delete routes.
// -----------------------------------------------------------------------------
const express = require('express');
const controller = require('../controllers/auditController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
const ADMIN_ONLY = authorize('admin');

router.get('/', ADMIN_ONLY, controller.list);
router.get('/entities', ADMIN_ONLY, controller.entities);

module.exports = router;
