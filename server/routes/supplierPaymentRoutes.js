// -----------------------------------------------------------------------------
//  Supplier-payment routes — /api/supplier-payments  (Accounts Payable)
//    POST   /            admin, accountant   (record a payment to a supplier)
//    GET    /            any authenticated
//    GET    /:id         any authenticated
// -----------------------------------------------------------------------------
const express = require('express');
const { param } = require('express-validator');
const controller = require('../controllers/supplierPaymentController');
const { createRules } = require('../validators/supplierPaymentValidator');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(authenticate);

router.post('/', authorize('admin', 'accountant'), createRules, validate, controller.create);
router.get('/', controller.list);
router.get('/:id', param('id').isInt({ min: 1 }).withMessage('Invalid id').toInt(), validate, controller.getById);

module.exports = router;
