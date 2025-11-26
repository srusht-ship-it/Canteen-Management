const Order = require('../../models/Order');
const MenuItem = require('../../models/MenuItem');

class ForecastingService {
  // Predict demand for upcoming days
  async predictDemand(daysAhead = 7) {
    try {
      // Get historical data (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const historicalData = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              dayOfWeek: { $dayOfWeek: '$createdAt' }
            },
            orderCount: { $sum: 1 },
            totalRevenue: { $sum: '$total' }
          }
        },
        { $sort: { '_id.date': 1 } }
      ]);

      // Calculate daily averages by day of week
      const dayAverages = {};
      historicalData.forEach(day => {
        const dow = day._id.dayOfWeek;
        if (!dayAverages[dow]) {
          dayAverages[dow] = { totalOrders: 0, totalRevenue: 0, count: 0 };
        }
        dayAverages[dow].totalOrders += day.orderCount;
        dayAverages[dow].totalRevenue += day.totalRevenue;
        dayAverages[dow].count += 1;
      });

      // Generate predictions
      const predictions = [];
      const today = new Date();

      for (let i = 1; i <= daysAhead; i++) {
        const futureDate = new Date(today);
        futureDate.setDate(futureDate.getDate() + i);
        
        // JavaScript: Sunday = 0, MongoDB: Sunday = 1
        const dow = futureDate.getDay() + 1;
        const avg = dayAverages[dow];

        if (avg && avg.count > 0) {
          predictions.push({
            date: futureDate.toISOString().split('T')[0],
            dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][futureDate.getDay()],
            predictedOrders: Math.round(avg.totalOrders / avg.count),
            predictedRevenue: Math.round(avg.totalRevenue / avg.count * 100) / 100,
            confidence: Math.min(0.9, avg.count * 0.1 + 0.3)
          });
        } else {
          // Fallback to overall average
          const overallAvg = historicalData.reduce((sum, d) => sum + d.orderCount, 0) / 
                           Math.max(historicalData.length, 1);
          predictions.push({
            date: futureDate.toISOString().split('T')[0],
            dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][futureDate.getDay()],
            predictedOrders: Math.round(overallAvg) || 50,
            predictedRevenue: 0,
            confidence: 0.5
          });
        }
      }

      return predictions;
    } catch (error) {
      console.error('Demand prediction error:', error);
      return [];
    }
  }

  // Predict item-specific demand
  async predictItemDemand(menuItemId, daysAhead = 7) {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const itemHistory = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo },
            status: 'completed',
            'items.menuItem': require('mongoose').Types.ObjectId.createFromHexString(menuItemId)
          }
        },
        { $unwind: '$items' },
        {
          $match: {
            'items.menuItem': require('mongoose').Types.ObjectId.createFromHexString(menuItemId)
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            quantity: { $sum: '$items.quantity' }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Simple moving average prediction
      const avgQuantity = itemHistory.length > 0
        ? itemHistory.reduce((sum, d) => sum + d.quantity, 0) / itemHistory.length
        : 0;

      const predictions = [];
      const today = new Date();

      for (let i = 1; i <= daysAhead; i++) {
        const futureDate = new Date(today);
        futureDate.setDate(futureDate.getDate() + i);

        predictions.push({
          date: futureDate.toISOString().split('T')[0],
          predictedQuantity: Math.round(avgQuantity * (1 + (Math.random() - 0.5) * 0.2)),
          confidence: Math.min(0.85, itemHistory.length * 0.05 + 0.3)
        });
      }

      return predictions;
    } catch (error) {
      console.error('Item demand prediction error:', error);
      return [];
    }
  }

  // Detect seasonal trends
  async detectSeasonalTrends() {
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      const weeklyTrends = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: ninetyDaysAgo },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: { $week: '$createdAt' },
            orderCount: { $sum: 1 },
            totalRevenue: { $sum: '$total' },
            avgOrderValue: { $avg: '$total' }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Calculate trend direction
      if (weeklyTrends.length >= 4) {
        const recentWeeks = weeklyTrends.slice(-4);
        const olderWeeks = weeklyTrends.slice(-8, -4);

        const recentAvg = recentWeeks.reduce((sum, w) => sum + w.orderCount, 0) / recentWeeks.length;
        const olderAvg = olderWeeks.length > 0
          ? olderWeeks.reduce((sum, w) => sum + w.orderCount, 0) / olderWeeks.length
          : recentAvg;

        const trendPercentage = ((recentAvg - olderAvg) / olderAvg * 100).toFixed(1);

        return {
          weeklyTrends,
          trend: trendPercentage > 5 ? 'increasing' : trendPercentage < -5 ? 'decreasing' : 'stable',
          trendPercentage: parseFloat(trendPercentage),
          analysis: this.generateTrendAnalysis(weeklyTrends)
        };
      }

      return {
        weeklyTrends,
        trend: 'insufficient_data',
        trendPercentage: 0,
        analysis: 'Not enough data for trend analysis'
      };
    } catch (error) {
      console.error('Seasonal trends error:', error);
      return { trend: 'error', analysis: 'Could not analyze trends' };
    }
  }

  generateTrendAnalysis(weeklyTrends) {
    if (weeklyTrends.length < 4) {
      return 'Collecting more data for accurate analysis';
    }

    const avgOrders = weeklyTrends.reduce((sum, w) => sum + w.orderCount, 0) / weeklyTrends.length;
    const peakWeek = weeklyTrends.reduce((max, w) => w.orderCount > max.orderCount ? w : max);
    
    return `Average ${Math.round(avgOrders)} orders per week. Peak activity in week ${peakWeek._id}.`;
  }

  // Get waste reduction insights
  async getWasteReductionInsights() {
    try {
      const menuItems = await MenuItem.find({ isAvailable: true });
      
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const itemOrders = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo },
            status: 'completed'
          }
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.menuItem',
            totalOrdered: { $sum: '$items.quantity' }
          }
        }
      ]);

      const orderMap = {};
      itemOrders.forEach(o => {
        orderMap[o._id.toString()] = o.totalOrdered;
      });

      const insights = {
        lowDemandItems: [],
        recommendations: []
      };

      menuItems.forEach(item => {
        const ordered = orderMap[item._id.toString()] || 0;
        if (ordered < 5) {
          insights.lowDemandItems.push({
            item: item.name,
            category: item.category,
            orderedLast30Days: ordered
          });
        }
      });

      if (insights.lowDemandItems.length > 0) {
        insights.recommendations.push(
          'Consider removing or promoting low-demand items',
          'Reduce preparation quantities for items ordered less than 5 times monthly'
        );
      }

      return insights;
    } catch (error) {
      console.error('Waste reduction error:', error);
      return { lowDemandItems: [], recommendations: [] };
    }
  }
}

module.exports = new ForecastingService();
