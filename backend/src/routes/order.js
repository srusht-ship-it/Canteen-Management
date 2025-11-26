const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { auth, authorize } = require('../middleware/auth');
const { validate, orderValidation, mongoIdValidation, paginationValidation } = require('../middleware/validation');

// Customer routes
router.post('/', auth, orderValidation, validate, orderController.createOrder);
router.get('/my-orders', auth, paginationValidation, validate, orderController.getMyOrders);
router.get('/:id', auth, mongoIdValidation, validate, orderController.getOrder);
router.patch('/:id/cancel', auth, mongoIdValidation, validate, orderController.cancelOrder);

// Staff/Admin routes
router.get('/', auth, authorize('admin', 'staff'), paginationValidation, validate, orderController.getAllOrders);
router.patch('/:id/status', auth, authorize('admin', 'staff'), mongoIdValidation, validate, orderController.updateOrderStatus);
router.get('/stats/summary', auth, authorize('admin', 'staff'), orderController.getOrderStats);

module.exports = router;
