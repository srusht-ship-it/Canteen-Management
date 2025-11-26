const Order = require('../../models/Order');
const MenuItem = require('../../models/MenuItem');

class DynamicPricingService {
  constructor() {
    this.basePricingRules = {
      peakHourMultiplier: 1.1,      // 10% increase during peak hours
      lowDemandMultiplier: 0.9,     // 10% discount during low demand
      bulkDiscountThreshold: 5,     // Quantity threshold for bulk discount
      bulkDiscountPercent: 0.15,    // 15% off for bulk orders
      loyaltyPointsValue: 0.01     // Each point = $0.01
    };
  }

  // Calculate dynamic price based on various factors
  async calculateDynamicPrice(menuItemId, quantity = 1, userId = null) {
    try {
      const menuItem = await MenuItem.findById(menuItemId);
      if (!menuItem) return null;

      let basePrice = menuItem.price;
      let finalPrice = basePrice;
      const adjustments = [];

      // 1. Time-based pricing
      const currentHour = new Date().getHours();
      const isPeakHour = this.isPeakHour(currentHour);
      const isLowDemand = this.isLowDemandHour(currentHour);

      if (isPeakHour) {
        const adjustment = basePrice * (this.basePricingRules.peakHourMultiplier - 1);
        adjustments.push({ type: 'peak_hour', amount: adjustment, description: 'Peak hour pricing' });
        finalPrice += adjustment;
      } else if (isLowDemand) {
        const discount = basePrice * (1 - this.basePricingRules.lowDemandMultiplier);
        adjustments.push({ type: 'happy_hour', amount: -discount, description: 'Happy hour discount' });
        finalPrice -= discount;
      }

      // 2. Bulk order discount
      if (quantity >= this.basePricingRules.bulkDiscountThreshold) {
        const discount = finalPrice * this.basePricingRules.bulkDiscountPercent;
        adjustments.push({ 
          type: 'bulk_discount', 
          amount: -discount * quantity, 
          description: `Bulk order discount (${this.basePricingRules.bulkDiscountPercent * 100}% off)` 
        });
        finalPrice = finalPrice * (1 - this.basePricingRules.bulkDiscountPercent);
      }

      // 3. Demand-based adjustment
      const demandFactor = await this.getDemandFactor(menuItemId);
      if (demandFactor > 1.5) {
        const adjustment = basePrice * 0.05; // 5% increase for high demand
        adjustments.push({ type: 'high_demand', amount: adjustment, description: 'High demand item' });
        finalPrice += adjustment;
      } else if (demandFactor < 0.5) {
        const discount = basePrice * 0.1; // 10% off for low demand
        adjustments.push({ type: 'low_demand', amount: -discount, description: 'Special offer' });
        finalPrice -= discount;
      }

      // 4. Loyalty rewards (if user provided)
      let loyaltyDiscount = 0;
      if (userId) {
        loyaltyDiscount = await this.calculateLoyaltyDiscount(userId, finalPrice * quantity);
        if (loyaltyDiscount > 0) {
          adjustments.push({ 
            type: 'loyalty_reward', 
            amount: -loyaltyDiscount, 
            description: 'Loyalty points reward' 
          });
        }
      }

      const totalPrice = (finalPrice * quantity) - loyaltyDiscount;

      return {
        basePrice,
        finalPrice: Math.max(finalPrice, basePrice * 0.5), // Never go below 50% of base price
        quantity,
        totalPrice: Math.max(totalPrice, basePrice * quantity * 0.5),
        adjustments,
        savings: (basePrice * quantity) - totalPrice
      };
    } catch (error) {
      console.error('Dynamic pricing error:', error);
      return null;
    }
  }

  // Check if current hour is peak hour
  isPeakHour(hour) {
    // Typical peak hours: 12-14 (lunch) and 18-20 (dinner)
    return (hour >= 12 && hour <= 14) || (hour >= 18 && hour <= 20);
  }

  // Check if current hour is low demand
  isLowDemandHour(hour) {
    // Low demand: 14-17 (afternoon) and after 20
    return (hour >= 14 && hour <= 17) || hour >= 21 || hour < 8;
  }

  // Calculate demand factor for an item
  async getDemandFactor(menuItemId) {
    try {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const itemOrders = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: weekAgo },
            status: 'completed'
          }
        },
        { $unwind: '$items' },
        { $match: { 'items.menuItem': require('mongoose').Types.ObjectId.createFromHexString(menuItemId) } },
        { $group: { _id: null, count: { $sum: '$items.quantity' } } }
      ]);

      const allItemOrders = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: weekAgo },
            status: 'completed'
          }
        },
        { $unwind: '$items' },
        { $group: { _id: null, count: { $sum: '$items.quantity' } } }
      ]);

      const totalItems = await MenuItem.countDocuments({ isAvailable: true });
      const avgOrdersPerItem = (allItemOrders[0]?.count || 0) / Math.max(totalItems, 1);
      const itemOrderCount = itemOrders[0]?.count || 0;

      return avgOrdersPerItem > 0 ? itemOrderCount / avgOrdersPerItem : 1;
    } catch (error) {
      console.error('Demand factor error:', error);
      return 1;
    }
  }

  // Calculate loyalty discount
  async calculateLoyaltyDiscount(userId, orderTotal) {
    try {
      const User = require('../../models/User');
      const user = await User.findById(userId);
      
      if (!user || user.loyaltyPoints <= 0) return 0;

      // Use up to 20% of order total in loyalty points
      const maxPointsToUse = Math.floor(orderTotal * 0.2 / this.basePricingRules.loyaltyPointsValue);
      const pointsToUse = Math.min(user.loyaltyPoints, maxPointsToUse);
      
      return pointsToUse * this.basePricingRules.loyaltyPointsValue;
    } catch (error) {
      console.error('Loyalty discount error:', error);
      return 0;
    }
  }

  // Get pricing suggestions for admin
  async getPricingSuggestions() {
    try {
      const menuItems = await MenuItem.find({ isAvailable: true });
      const suggestions = [];

      for (const item of menuItems) {
        const demandFactor = await this.getDemandFactor(item._id.toString());
        
        if (demandFactor > 2) {
          suggestions.push({
            item: item.name,
            currentPrice: item.price,
            suggestedPrice: Math.round(item.price * 1.1 * 100) / 100,
            reason: 'High demand - consider price increase',
            demandFactor
          });
        } else if (demandFactor < 0.3) {
          suggestions.push({
            item: item.name,
            currentPrice: item.price,
            suggestedPrice: Math.round(item.price * 0.85 * 100) / 100,
            reason: 'Low demand - consider promotional pricing',
            demandFactor
          });
        }
      }

      return suggestions;
    } catch (error) {
      console.error('Pricing suggestions error:', error);
      return [];
    }
  }

  // Calculate happy hour pricing
  getHappyHourPricing() {
    const currentHour = new Date().getHours();
    const isHappyHour = this.isLowDemandHour(currentHour);

    return {
      isActive: isHappyHour,
      discount: isHappyHour ? (1 - this.basePricingRules.lowDemandMultiplier) * 100 : 0,
      message: isHappyHour 
        ? `Happy Hour! ${(1 - this.basePricingRules.lowDemandMultiplier) * 100}% off all items!`
        : 'Happy Hour: 2 PM - 5 PM and after 9 PM'
    };
  }
}

module.exports = new DynamicPricingService();
