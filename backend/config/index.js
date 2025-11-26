module.exports = {
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'canteen-management-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRE || '7d'
  },

  // MongoDB Configuration
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/canteen-management'
  },

  // Server Configuration
  server: {
    port: process.env.PORT || 5000,
    env: process.env.NODE_ENV || 'development'
  },

  // CORS Configuration
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  },

  // OpenAI Configuration (for enhanced AI features)
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
  },

  // Pricing Configuration
  pricing: {
    taxRate: 0.1, // 10% tax
    loyaltyPointsPerDollar: 1,
    loyaltyPointValue: 0.01 // $0.01 per point
  },

  // Pagination defaults
  pagination: {
    defaultLimit: 20,
    maxLimit: 100
  }
};
