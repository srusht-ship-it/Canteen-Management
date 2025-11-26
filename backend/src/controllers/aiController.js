const recommendationService = require('../services/ai/recommendationService');
const forecastingService = require('../services/ai/forecastingService');
const chatbotService = require('../services/ai/chatbotService');
const analyticsService = require('../services/ai/analyticsService');
const dynamicPricingService = require('../services/ai/dynamicPricingService');

// Get personalized recommendations
exports.getRecommendations = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const limit = parseInt(req.query.limit) || 5;

    const recommendations = await recommendationService.getPersonalizedRecommendations(userId, limit);

    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    next(error);
  }
};

// Get "also ordered" suggestions
exports.getAlsoOrdered = async (req, res, next) => {
  try {
    const { menuItemId } = req.params;
    const limit = parseInt(req.query.limit) || 5;

    const suggestions = await recommendationService.getAlsoOrdered(menuItemId, limit);

    res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    next(error);
  }
};

// Get trending items
exports.getTrendingItems = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const trending = await recommendationService.getTrendingItems(limit);

    res.json({
      success: true,
      data: trending
    });
  } catch (error) {
    next(error);
  }
};

// Get demand forecast
exports.getDemandForecast = async (req, res, next) => {
  try {
    const daysAhead = parseInt(req.query.days) || 7;

    const forecast = await forecastingService.predictDemand(daysAhead);

    res.json({
      success: true,
      data: forecast
    });
  } catch (error) {
    next(error);
  }
};

// Get item-specific demand forecast
exports.getItemDemandForecast = async (req, res, next) => {
  try {
    const { menuItemId } = req.params;
    const daysAhead = parseInt(req.query.days) || 7;

    const forecast = await forecastingService.predictItemDemand(menuItemId, daysAhead);

    res.json({
      success: true,
      data: forecast
    });
  } catch (error) {
    next(error);
  }
};

// Get seasonal trends
exports.getSeasonalTrends = async (req, res, next) => {
  try {
    const trends = await forecastingService.detectSeasonalTrends();

    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    next(error);
  }
};

// Get waste reduction insights
exports.getWasteInsights = async (req, res, next) => {
  try {
    const insights = await forecastingService.getWasteReductionInsights();

    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    next(error);
  }
};

// Chat with AI
exports.chat = async (req, res, next) => {
  try {
    const { message } = req.body;
    const userId = req.user?._id;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    const response = await chatbotService.processMessage(message, userId);

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    next(error);
  }
};

// Get consumption patterns analysis
exports.getConsumptionPatterns = async (req, res, next) => {
  try {
    const patterns = await analyticsService.analyzeConsumptionPatterns();

    res.json({
      success: true,
      data: patterns
    });
  } catch (error) {
    next(error);
  }
};

// Get customer segments
exports.getCustomerSegments = async (req, res, next) => {
  try {
    const segments = await analyticsService.segmentCustomers();

    res.json({
      success: true,
      data: segments
    });
  } catch (error) {
    next(error);
  }
};

// Get peak hours prediction
exports.getPeakHours = async (req, res, next) => {
  try {
    const peakHours = await analyticsService.predictPeakHours();

    res.json({
      success: true,
      data: peakHours
    });
  } catch (error) {
    next(error);
  }
};

// Get popular items tracking
exports.getPopularItemsTracking = async (req, res, next) => {
  try {
    const period = req.query.period || '30days';
    const tracking = await analyticsService.trackPopularItems(period);

    res.json({
      success: true,
      data: tracking
    });
  } catch (error) {
    next(error);
  }
};

// Calculate dynamic price
exports.getDynamicPrice = async (req, res, next) => {
  try {
    const { menuItemId } = req.params;
    const quantity = parseInt(req.query.quantity) || 1;
    const userId = req.user?._id;

    const pricing = await dynamicPricingService.calculateDynamicPrice(menuItemId, quantity, userId);

    if (!pricing) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    res.json({
      success: true,
      data: pricing
    });
  } catch (error) {
    next(error);
  }
};

// Get pricing suggestions (admin)
exports.getPricingSuggestions = async (req, res, next) => {
  try {
    const suggestions = await dynamicPricingService.getPricingSuggestions();

    res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    next(error);
  }
};

// Get happy hour info
exports.getHappyHour = async (req, res, next) => {
  try {
    const happyHour = dynamicPricingService.getHappyHourPricing();

    res.json({
      success: true,
      data: happyHour
    });
  } catch (error) {
    next(error);
  }
};
