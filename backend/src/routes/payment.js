const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { auth, authorize } = require('../middleware/auth');
const { validate, mongoIdValidation, paginationValidation } = require('../middleware/validation');

// Customer routes
router.post('/process', auth, paymentController.processPayment);
router.get('/my-payments', auth, paginationValidation, validate, paymentController.getMyPayments);
router.get('/:id', auth, mongoIdValidation, validate, paymentController.getPayment);
router.get('/:id/receipt', auth, mongoIdValidation, validate, paymentController.getReceipt);
router.post('/:id/refund', auth, mongoIdValidation, validate, paymentController.requestRefund);

// Admin routes
router.get('/', auth, authorize('admin'), paginationValidation, validate, paymentController.getAllPayments);

module.exports = router;
