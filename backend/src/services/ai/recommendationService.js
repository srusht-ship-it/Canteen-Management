const Order = require('../../models/Order');
const MenuItem = require('../../models/MenuItem');
const User = require('../../models/User');

class RecommendationService {
  // Get personalized recommendations for a user
  async getPersonalizedRecommendations(userId, limit = 5) {
    try {
      const user = await User.findById(userId);
      if (!user) return [];

      // Get user's order history
      const userOrders = await Order.find({ 
        user: userId, 
        status: 'completed' 
      }).populate('items.menuItem');

      // Analyze order patterns
      const orderedItemIds = new Set();
      const categoryPreferences = {};
      const timePreferences = {};

      userOrders.forEach(order => {
        const hour = new Date(order.createdAt).getHours();
        const timeSlot = hour < 11 ? 'breakfast' : hour < 15 ? 'lunch' : hour < 19 ? 'dinner' : 'snacks';
        
        order.items.forEach(item => {
          if (item.menuItem) {
            orderedItemIds.add(item.menuItem._id.toString());
            const category = item.menuItem.category;
            categoryPreferences[category] = (categoryPreferences[category] || 0) + item.quantity;
            timePreferences[timeSlot] = (timePreferences[timeSlot] || 0) + 1;
          }
        });
      });

      // Build recommendation query
      const query = { isAvailable: true };

      // Apply dietary preferences
      if (user.dietaryPreferences) {
        if (user.dietaryPreferences.isVegetarian) {
          query['dietaryLabels.isVegetarian'] = true;
        }
        if (user.dietaryPreferences.isVegan) {
          query['dietaryLabels.isVegan'] = true;
        }
        if (user.dietaryPreferences.isGlutenFree) {
          query['dietaryLabels.isGlutenFree'] = true;
        }
        if (user.dietaryPreferences.allergies?.length > 0) {
          query.allergens = { $nin: user.dietaryPreferences.allergies };
        }
      }

      // Get recommendations - mix of new items and highly rated items
      const recommendations = await MenuItem.find(query)
        .sort({ 'rating.average': -1, orderCount: -1 })
        .limit(limit * 2);

      // Prioritize items not yet ordered and highly rated
      const scored = recommendations.map(item => {
        let score = 0;
        
        // Higher score for items not ordered before
        if (!orderedItemIds.has(item._id.toString())) {
          score += 10;
        }
        
        // Score based on rating
        score += item.rating.average * 2;
        
        // Score based on category preference
        if (categoryPreferences[item.category]) {
          score += categoryPreferences[item.category];
        }
        
        // Bonus for daily specials
        if (item.isDailySpecial) {
          score += 5;
        }

        return { item, score };
      });

      // Sort by score and return top items
      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(s => s.item);
    } catch (error) {
      console.error('Recommendation error:', error);
      return [];
    }
  }

  // Get "Customers also ordered" suggestions
  async getAlsoOrdered(menuItemId, limit = 5) {
    try {
      // Find orders containing this item
      const ordersWithItem = await Order.find({
        'items.menuItem': menuItemId,
        status: 'completed'
      });

      // Count co-occurrence of other items
      const coOccurrence = {};
      
      ordersWithItem.forEach(order => {
        order.items.forEach(item => {
          const itemId = item.menuItem.toString();
          if (itemId !== menuItemId) {
            coOccurrence[itemId] = (coOccurrence[itemId] || 0) + 1;
          }
        });
      });

      // Sort by co-occurrence and get top items
      const topItemIds = Object.entries(coOccurrence)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id]) => id);

      if (topItemIds.length === 0) {
        // Fallback to popular items
        return MenuItem.find({ isAvailable: true, _id: { $ne: menuItemId } })
          .sort({ orderCount: -1 })
          .limit(limit);
      }

      return MenuItem.find({ _id: { $in: topItemIds }, isAvailable: true });
    } catch (error) {
      console.error('Also ordered error:', error);
      return [];
    }
  }

  // Get trending items
  async getTrendingItems(limit = 10) {
    try {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const trending = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: weekAgo },
            status: 'completed'
          }
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.menuItem',
            orderCount: { $sum: '$items.quantity' },
            revenue: { $sum: '$items.subtotal' }
          }
        },
        { $sort: { orderCount: -1 } },
        { $limit: limit }
      ]);

      const itemIds = trending.map(t => t._id);
      const items = await MenuItem.find({ _id: { $in: itemIds }, isAvailable: true });

      return items.map(item => {
        const stats = trending.find(t => t._id.toString() === item._id.toString());
        return {
          ...item.toObject(),
          trendingStats: {
            weeklyOrders: stats?.orderCount || 0,
            weeklyRevenue: stats?.revenue || 0
          }
        };
      });
    } catch (error) {
      console.error('Trending items error:', error);
      return [];
    }
  }
}

module.exports = new RecommendationService();
