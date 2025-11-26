const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { auth, optionalAuth, authorize } = require('../middleware/auth');
const { validate, mongoIdValidation } = require('../middleware/validation');

// Public/Optional auth routes
router.get('/recommendations', optionalAuth, aiController.getRecommendations);
router.get('/trending', aiController.getTrendingItems);
router.get('/also-ordered/:menuItemId', mongoIdValidation, validate, aiController.getAlsoOrdered);
router.get('/happy-hour', aiController.getHappyHour);

// Chat (works with or without auth)
router.post('/chat', optionalAuth, aiController.chat);

// Dynamic pricing (optional auth for personalized pricing)
router.get('/pricing/:menuItemId', optionalAuth, mongoIdValidation, validate, aiController.getDynamicPrice);

// Admin AI features
router.get('/forecast/demand', auth, authorize('admin', 'staff'), aiController.getDemandForecast);
router.get('/forecast/item/:menuItemId', auth, authorize('admin', 'staff'), mongoIdValidation, validate, aiController.getItemDemandForecast);
router.get('/trends/seasonal', auth, authorize('admin', 'staff'), aiController.getSeasonalTrends);
router.get('/insights/waste', auth, authorize('admin'), aiController.getWasteInsights);
router.get('/insights/consumption', auth, authorize('admin'), aiController.getConsumptionPatterns);
router.get('/insights/segments', auth, authorize('admin'), aiController.getCustomerSegments);
router.get('/insights/peak-hours', auth, authorize('admin'), aiController.getPeakHours);
router.get('/insights/popular-tracking', auth, authorize('admin'), aiController.getPopularItemsTracking);
router.get('/pricing/suggestions', auth, authorize('admin'), aiController.getPricingSuggestions);

module.exports = router;
