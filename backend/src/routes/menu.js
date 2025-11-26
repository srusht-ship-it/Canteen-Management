const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { auth, authorize } = require('../middleware/auth');
const { validate, menuItemValidation, mongoIdValidation, paginationValidation } = require('../middleware/validation');

// Public routes
router.get('/', paginationValidation, validate, menuController.getMenuItems);
router.get('/categories', menuController.getCategories);
router.get('/specials', menuController.getDailySpecials);
router.get('/popular', menuController.getPopularItems);
router.get('/:id', mongoIdValidation, validate, menuController.getMenuItem);

// Admin routes
router.post('/', auth, authorize('admin'), menuItemValidation, validate, menuController.createMenuItem);
router.put('/:id', auth, authorize('admin'), mongoIdValidation, validate, menuController.updateMenuItem);
router.delete('/:id', auth, authorize('admin'), mongoIdValidation, validate, menuController.deleteMenuItem);
router.patch('/:id/availability', auth, authorize('admin', 'staff'), mongoIdValidation, validate, menuController.toggleAvailability);

module.exports = router;
