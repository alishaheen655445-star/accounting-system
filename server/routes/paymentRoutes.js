// -----------------------------------------------------------------------------
//  Payment routes — /api/payments
//    POST   /            admin, accountant   (record a payment)
//    GET    /            any authenticated
//    GET    /:id         any authenticated
// -----------------------------------------------------------------------------
const express = require('express');
const { param } = require('express-validator');
const controller = require('../controllers/paymentController');
const { createRules } = require('../validators/paymentValidator');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(authenticate);

router.post('/', authorize('admin', 'accountant'), createRules, validate, controller.create);
router.get('/', controller.list);
router.get('/:id', param('id').isInt({ min: 1 }).withMessage('Invalid id').toInt(), validate, controller.getById);

module.exports = router;
