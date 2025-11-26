const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Order = require('../models/Order');

// Get user profile
router.get('/profile', auth, async (req, res) => {
  res.json({
    success: true,
    data: req.user
  });
});

// Get user's loyalty points
router.get('/loyalty-points', auth, async (req, res) => {
  res.json({
    success: true,
    data: {
      points: req.user.loyaltyPoints,
      value: req.user.loyaltyPoints * 0.01 // $0.01 per point
    }
  });
});

// Get user's order statistics
router.get('/order-stats', auth, async (req, res, next) => {
  try {
    const stats = await Order.aggregate([
      { $match: { user: req.user._id, status: 'completed' } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$total' },
          avgOrderValue: { $avg: '$total' }
        }
      }
    ]);

    res.json({
      success: true,
      data: stats[0] || { totalOrders: 0, totalSpent: 0, avgOrderValue: 0 }
    });
  } catch (error) {
    next(error);
  }
});

// Update dietary preferences
router.put('/dietary-preferences', auth, async (req, res, next) => {
  try {
    const { isVegetarian, isVegan, isGlutenFree, allergies, preferredCuisines } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        dietaryPreferences: {
          isVegetarian: isVegetarian || false,
          isVegan: isVegan || false,
          isGlutenFree: isGlutenFree || false,
          allergies: allergies || [],
          preferredCuisines: preferredCuisines || []
        }
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Dietary preferences updated',
      data: user.dietaryPreferences
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
