const Order = require('../../models/Order');
const MenuItem = require('../../models/MenuItem');
const User = require('../../models/User');

class AnalyticsService {
  // Analyze consumption patterns
  async analyzeConsumptionPatterns() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Orders by hour
      const hourlyPattern = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: { $hour: '$createdAt' },
            orderCount: { $sum: 1 },
            avgOrderValue: { $avg: '$total' }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Category distribution
      const categoryDistribution = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo },
            status: 'completed'
          }
        },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'menuitems',
            localField: 'items.menuItem',
            foreignField: '_id',
            as: 'menuItem'
          }
        },
        { $unwind: '$menuItem' },
        {
          $group: {
            _id: '$menuItem.category',
            quantity: { $sum: '$items.quantity' },
            revenue: { $sum: '$items.subtotal' }
          }
        },
        { $sort: { revenue: -1 } }
      ]);

      // Identify peak hours
      const peakHours = hourlyPattern
        .sort((a, b) => b.orderCount - a.orderCount)
        .slice(0, 3)
        .map(h => ({ hour: h._id, orders: h.orderCount }));

      return {
        hourlyPattern,
        categoryDistribution,
        peakHours,
        insights: this.generateConsumptionInsights(hourlyPattern, categoryDistribution)
      };
    } catch (error) {
      console.error('Consumption analysis error:', error);
      return {};
    }
  }

  // Generate insights from consumption data
  generateConsumptionInsights(hourlyPattern, categoryDistribution) {
    const insights = [];

    // Peak hour insight
    const peakHour = hourlyPattern.reduce((max, h) => h.orderCount > max.orderCount ? h : max, { orderCount: 0 });
    if (peakHour._id !== undefined) {
      insights.push(`Peak ordering time is at ${peakHour._id}:00 with ${peakHour.orderCount} orders`);
    }

    // Category insight
    if (categoryDistribution.length > 0) {
      insights.push(`Most popular category is ${categoryDistribution[0]._id} with $${categoryDistribution[0].revenue.toFixed(2)} in revenue`);
    }

    return insights;
  }

  // Customer segmentation
  async segmentCustomers() {
    try {
      const customers = await User.find({ role: 'customer' });
      
      const segments = {
        frequent: [],    // More than 10 orders/month
        regular: [],     // 4-10 orders/month
        occasional: [],  // 1-3 orders/month
        inactive: []     // No orders in last month
      };

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      for (const customer of customers) {
        const orderCount = await Order.countDocuments({
          user: customer._id,
          createdAt: { $gte: thirtyDaysAgo },
          status: 'completed'
        });

        const customerData = {
          id: customer._id,
          name: customer.name,
          email: customer.email,
          loyaltyPoints: customer.loyaltyPoints,
          orderCount
        };

        if (orderCount > 10) {
          segments.frequent.push(customerData);
        } else if (orderCount >= 4) {
          segments.regular.push(customerData);
        } else if (orderCount >= 1) {
          segments.occasional.push(customerData);
        } else {
          segments.inactive.push(customerData);
        }
      }

      return {
        segments,
        summary: {
          frequent: segments.frequent.length,
          regular: segments.regular.length,
          occasional: segments.occasional.length,
          inactive: segments.inactive.length
        },
        recommendations: this.generateSegmentRecommendations(segments)
      };
    } catch (error) {
      console.error('Customer segmentation error:', error);
      return {};
    }
  }

  // Generate recommendations based on segments
  generateSegmentRecommendations(segments) {
    const recommendations = [];

    if (segments.inactive.length > segments.frequent.length) {
      recommendations.push('Consider re-engagement campaigns for inactive customers');
    }

    if (segments.frequent.length > 0) {
      recommendations.push('Implement VIP rewards for frequent customers');
    }

    if (segments.occasional.length > 0) {
      recommendations.push('Target occasional customers with promotions to increase frequency');
    }

    return recommendations;
  }

  // Predict peak hours
  async predictPeakHours() {
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      const hourlyStats = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: ninetyDaysAgo },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: {
              hour: { $hour: '$createdAt' },
              dayOfWeek: { $dayOfWeek: '$createdAt' }
            },
            orderCount: { $sum: 1 },
            avgWaitTime: { $avg: { $subtract: ['$actualReadyTime', '$createdAt'] } }
          }
        },
        { $sort: { orderCount: -1 } }
      ]);

      // Group by day of week
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const peakByDay = {};

      dayNames.forEach((day, idx) => {
        const dayStats = hourlyStats.filter(s => s._id.dayOfWeek === idx + 1);
        if (dayStats.length > 0) {
          const peak = dayStats[0];
          peakByDay[day] = {
            peakHour: peak._id.hour,
            expectedOrders: peak.orderCount,
            avgWaitTime: peak.avgWaitTime ? Math.round(peak.avgWaitTime / 60000) : null // Convert to minutes
          };
        }
      });

      return {
        peakByDay,
        overallPeakHours: hourlyStats.slice(0, 5).map(s => ({
          hour: s._id.hour,
          day: dayNames[s._id.dayOfWeek - 1],
          orderCount: s.orderCount
        }))
      };
    } catch (error) {
      console.error('Peak hours prediction error:', error);
      return {};
    }
  }

  // Track popular items over time
  async trackPopularItems(period = '30days') {
    try {
      let startDate = new Date();
      switch (period) {
        case '7days':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30days':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90days':
          startDate.setDate(startDate.getDate() - 90);
          break;
        default:
          startDate.setDate(startDate.getDate() - 30);
      }

      const popularItems = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
            status: 'completed'
          }
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.menuItem',
            name: { $first: '$items.name' },
            totalQuantity: { $sum: '$items.quantity' },
            totalRevenue: { $sum: '$items.subtotal' },
            orderCount: { $sum: 1 }
          }
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 20 }
      ]);

      // Calculate trends
      const midPoint = new Date(startDate.getTime() + (Date.now() - startDate.getTime()) / 2);
      
      const itemsWithTrend = await Promise.all(popularItems.map(async (item) => {
        const firstHalf = await Order.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate, $lt: midPoint },
              status: 'completed'
            }
          },
          { $unwind: '$items' },
          { $match: { 'items.menuItem': item._id } },
          { $group: { _id: null, count: { $sum: '$items.quantity' } } }
        ]);

        const secondHalf = await Order.aggregate([
          {
            $match: {
              createdAt: { $gte: midPoint },
              status: 'completed'
            }
          },
          { $unwind: '$items' },
          { $match: { 'items.menuItem': item._id } },
          { $group: { _id: null, count: { $sum: '$items.quantity' } } }
        ]);

        const firstCount = firstHalf[0]?.count || 0;
        const secondCount = secondHalf[0]?.count || 0;
        const trend = firstCount > 0 
          ? ((secondCount - firstCount) / firstCount * 100).toFixed(1)
          : 100;

        return {
          ...item,
          trend: parseFloat(trend),
          trendDirection: parseFloat(trend) > 5 ? 'up' : parseFloat(trend) < -5 ? 'down' : 'stable'
        };
      }));

      return itemsWithTrend;
    } catch (error) {
      console.error('Popular items tracking error:', error);
      return [];
    }
  }
}

module.exports = new AnalyticsService();
