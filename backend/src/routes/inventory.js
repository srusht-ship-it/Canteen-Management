const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { auth, authorize } = require('../middleware/auth');
const { validate, inventoryValidation, mongoIdValidation, paginationValidation } = require('../middleware/validation');

// All inventory routes require admin or staff access
router.use(auth, authorize('admin', 'staff'));

router.get('/', paginationValidation, validate, inventoryController.getInventory);
router.get('/alerts', inventoryController.getLowStockAlerts);
router.get('/stats', inventoryController.getInventoryStats);
router.get('/:id', mongoIdValidation, validate, inventoryController.getInventoryItem);

// Admin only
router.post('/', authorize('admin'), inventoryValidation, validate, inventoryController.createInventoryItem);
router.put('/:id', authorize('admin'), mongoIdValidation, validate, inventoryController.updateInventoryItem);
router.delete('/:id', authorize('admin'), mongoIdValidation, validate, inventoryController.deleteInventoryItem);
router.post('/:id/restock', authorize('admin'), mongoIdValidation, validate, inventoryController.restockInventory);

module.exports = router;
