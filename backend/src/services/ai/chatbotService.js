const Order = require('../../models/Order');
const MenuItem = require('../../models/MenuItem');

class ChatbotService {
  constructor() {
    this.intents = {
      greeting: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'],
      menu: ['menu', 'what do you have', 'what can i order', 'show menu', 'food options'],
      recommend: ['recommend', 'suggestion', 'what should i', 'popular', 'best'],
      order_status: ['order status', 'my order', 'where is my order', 'track order'],
      price: ['price', 'cost', 'how much'],
      hours: ['hours', 'open', 'close', 'timing'],
      dietary: ['vegetarian', 'vegan', 'gluten', 'allergy', 'allergen'],
      help: ['help', 'support', 'assist'],
      bye: ['bye', 'goodbye', 'thank you', 'thanks']
    };

    this.responses = {
      greeting: "Hello! Welcome to our canteen. How can I help you today? You can ask about our menu, get recommendations, or check your order status.",
      hours: "We're open from 7:00 AM to 9:00 PM, Monday through Saturday. Sunday hours are 8:00 AM to 6:00 PM.",
      help: "I can help you with:\n• Viewing our menu\n• Getting food recommendations\n• Checking order status\n• Dietary information\n• Placing orders\n\nJust ask away!",
      bye: "Thank you for visiting! Enjoy your meal and have a great day!",
      unknown: "I'm not sure I understand. Could you rephrase that? You can ask about our menu, get recommendations, check order status, or ask about dietary options."
    };
  }

  // Detect intent from user message
  detectIntent(message) {
    const lowercaseMessage = message.toLowerCase();
    
    for (const [intent, keywords] of Object.entries(this.intents)) {
      if (keywords.some(keyword => lowercaseMessage.includes(keyword))) {
        return intent;
      }
    }
    
    return 'unknown';
  }

  // Process user message and generate response
  async processMessage(message, userId = null) {
    try {
      const intent = this.detectIntent(message);
      
      switch (intent) {
        case 'greeting':
          return { response: this.responses.greeting, intent };
          
        case 'menu':
          return await this.handleMenuQuery(message);
          
        case 'recommend':
          return await this.handleRecommendation(userId);
          
        case 'order_status':
          return await this.handleOrderStatus(userId);
          
        case 'price':
          return await this.handlePriceQuery(message);
          
        case 'hours':
          return { response: this.responses.hours, intent };
          
        case 'dietary':
          return await this.handleDietaryQuery(message);
          
        case 'help':
          return { response: this.responses.help, intent };
          
        case 'bye':
          return { response: this.responses.bye, intent };
          
        default:
          return { response: this.responses.unknown, intent: 'unknown' };
      }
    } catch (error) {
      console.error('Chatbot error:', error);
      return { 
        response: "I'm having trouble processing your request. Please try again or contact our staff for assistance.",
        intent: 'error'
      };
    }
  }

  // Handle menu queries
  async handleMenuQuery(message) {
    const lowercaseMessage = message.toLowerCase();
    let query = { isAvailable: true };

    // Detect category from message
    const categories = ['breakfast', 'lunch', 'dinner', 'snacks', 'beverages'];
    const matchedCategory = categories.find(cat => lowercaseMessage.includes(cat));
    
    if (matchedCategory) {
      query.category = matchedCategory;
    }

    const items = await MenuItem.find(query)
      .sort({ orderCount: -1 })
      .limit(10)
      .select('name price category description');

    if (items.length === 0) {
      return {
        response: "I couldn't find any items matching your request. Would you like to see our full menu?",
        intent: 'menu',
        data: []
      };
    }

    const itemList = items.map(item => 
      `• ${item.name} - $${item.price.toFixed(2)} (${item.category})`
    ).join('\n');

    return {
      response: `Here are some ${matchedCategory ? matchedCategory : 'menu'} items:\n\n${itemList}\n\nWould you like more details about any item?`,
      intent: 'menu',
      data: items
    };
  }

  // Handle recommendation requests
  async handleRecommendation(userId) {
    let items;
    
    if (userId) {
      // Get personalized recommendations
      const RecommendationService = require('./recommendationService');
      items = await RecommendationService.getPersonalizedRecommendations(userId, 5);
    } else {
      // Get popular items
      items = await MenuItem.find({ isAvailable: true })
        .sort({ 'rating.average': -1, orderCount: -1 })
        .limit(5)
        .select('name price category rating');
    }

    if (items.length === 0) {
      return {
        response: "I don't have enough data to make recommendations yet. Would you like to see our popular items?",
        intent: 'recommend',
        data: []
      };
    }

    const itemList = items.map(item => 
      `• ${item.name} - $${item.price.toFixed(2)} ⭐ ${item.rating?.average?.toFixed(1) || 'N/A'}`
    ).join('\n');

    return {
      response: `Based on ${userId ? 'your preferences' : 'what\'s popular'}, I recommend:\n\n${itemList}\n\nWould you like to order any of these?`,
      intent: 'recommend',
      data: items
    };
  }

  // Handle order status queries
  async handleOrderStatus(userId) {
    if (!userId) {
      return {
        response: "To check your order status, please log in to your account first.",
        intent: 'order_status',
        requiresAuth: true
      };
    }

    const recentOrder = await Order.findOne({ user: userId })
      .sort({ createdAt: -1 })
      .select('orderNumber status estimatedReadyTime items');

    if (!recentOrder) {
      return {
        response: "You don't have any orders yet. Would you like to place an order?",
        intent: 'order_status'
      };
    }

    const statusMessages = {
      pending: 'Your order is awaiting confirmation.',
      confirmed: 'Your order has been confirmed and will be prepared soon.',
      preparing: 'Your order is being prepared right now!',
      ready: 'Your order is ready for pickup!',
      completed: 'Your order has been completed.',
      cancelled: 'This order was cancelled.'
    };

    let response = `Order #${recentOrder.orderNumber}\nStatus: ${statusMessages[recentOrder.status] || recentOrder.status}`;
    
    if (recentOrder.estimatedReadyTime && ['confirmed', 'preparing'].includes(recentOrder.status)) {
      const readyTime = new Date(recentOrder.estimatedReadyTime).toLocaleTimeString();
      response += `\nEstimated ready time: ${readyTime}`;
    }

    return {
      response,
      intent: 'order_status',
      data: recentOrder
    };
  }

  // Handle price queries
  async handlePriceQuery(message) {
    // Extract item name from message
    const words = message.toLowerCase().replace(/[?.,!]/g, '').split(' ');
    const priceIndex = words.indexOf('price');
    const ofIndex = words.indexOf('of');
    
    let searchTerm = '';
    if (priceIndex !== -1 && ofIndex !== -1 && ofIndex > priceIndex) {
      searchTerm = words.slice(ofIndex + 1).join(' ');
    } else {
      // Try to find any food-related words
      searchTerm = words.filter(w => !['price', 'cost', 'how', 'much', 'is', 'the', 'of', 'for', 'a'].includes(w)).join(' ');
    }

    if (!searchTerm) {
      return {
        response: "Please specify which item you'd like to know the price for. For example, 'What's the price of chicken sandwich?'",
        intent: 'price'
      };
    }

    const items = await MenuItem.find({
      $text: { $search: searchTerm },
      isAvailable: true
    }).limit(3);

    if (items.length === 0) {
      // Fallback to regex search
      const regexItems = await MenuItem.find({
        name: { $regex: searchTerm, $options: 'i' },
        isAvailable: true
      }).limit(3);

      if (regexItems.length === 0) {
        return {
          response: `I couldn't find any items matching "${searchTerm}". Would you like to see our menu?`,
          intent: 'price'
        };
      }
      
      const priceList = regexItems.map(item => 
        `• ${item.name}: $${item.price.toFixed(2)}`
      ).join('\n');

      return {
        response: `Here are the prices:\n\n${priceList}`,
        intent: 'price',
        data: regexItems
      };
    }

    const priceList = items.map(item => 
      `• ${item.name}: $${item.price.toFixed(2)}`
    ).join('\n');

    return {
      response: `Here are the prices:\n\n${priceList}`,
      intent: 'price',
      data: items
    };
  }

  // Handle dietary queries
  async handleDietaryQuery(message) {
    const lowercaseMessage = message.toLowerCase();
    let query = { isAvailable: true };
    let dietaryType = '';

    if (lowercaseMessage.includes('vegetarian')) {
      query['dietaryLabels.isVegetarian'] = true;
      dietaryType = 'vegetarian';
    } else if (lowercaseMessage.includes('vegan')) {
      query['dietaryLabels.isVegan'] = true;
      dietaryType = 'vegan';
    } else if (lowercaseMessage.includes('gluten')) {
      query['dietaryLabels.isGlutenFree'] = true;
      dietaryType = 'gluten-free';
    }

    // Check for allergen queries
    const allergens = ['milk', 'eggs', 'fish', 'shellfish', 'tree_nuts', 'peanuts', 'wheat', 'soybeans', 'sesame'];
    const mentionedAllergen = allergens.find(a => lowercaseMessage.includes(a.replace('_', ' ')));
    
    if (mentionedAllergen) {
      query.allergens = { $ne: mentionedAllergen };
      dietaryType = `${mentionedAllergen.replace('_', ' ')}-free`;
    }

    const items = await MenuItem.find(query)
      .limit(10)
      .select('name price category dietaryLabels allergens');

    if (items.length === 0) {
      return {
        response: `I couldn't find any ${dietaryType || 'matching'} options right now. Please check with our staff for alternatives.`,
        intent: 'dietary'
      };
    }

    const itemList = items.map(item => `• ${item.name} - $${item.price.toFixed(2)}`).join('\n');

    return {
      response: `Here are our ${dietaryType || 'dietary-friendly'} options:\n\n${itemList}\n\nWould you like more details about any item?`,
      intent: 'dietary',
      data: items
    };
  }
}

module.exports = new ChatbotService();
