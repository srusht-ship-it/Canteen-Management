const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { auth, authorize } = require('../middleware/auth');
const { validate, mongoIdValidation, paginationValidation } = require('../middleware/validation');

// All admin routes require admin access
router.use(auth, authorize('admin'));

// Dashboard
router.get('/dashboard', adminController.getDashboardStats);

// Analytics
router.get('/analytics/revenue', adminController.getRevenueAnalytics);
router.get('/analytics/popular-items', adminController.getPopularItems);
router.get('/analytics/peak-hours', adminController.getPeakHours);
router.get('/analytics/categories', adminController.getCategoryPerformance);

// User management
router.get('/users', paginationValidation, validate, adminController.getUsers);
router.patch('/users/:id/role', mongoIdValidation, validate, adminController.updateUserRole);
router.patch('/users/:id/status', mongoIdValidation, validate, adminController.toggleUserStatus);

module.exports = router;
