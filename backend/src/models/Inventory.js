const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Ingredient name is required'],
    trim: true,
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['vegetables', 'fruits', 'dairy', 'meat', 'grains', 'spices', 'beverages', 'other'],
    default: 'other'
  },
  quantity: {
    type: Number,
    required: true,
    min: [0, 'Quantity cannot be negative']
  },
  unit: {
    type: String,
    required: true,
    enum: ['kg', 'g', 'l', 'ml', 'pieces', 'dozen']
  },
  minStockLevel: {
    type: Number,
    required: true,
    default: 10
  },
  maxStockLevel: {
    type: Number,
    default: 100
  },
  costPerUnit: {
    type: Number,
    required: true,
    min: [0, 'Cost cannot be negative']
  },
  supplier: {
    name: String,
    contact: String,
    email: String,
    address: String
  },
  expiryDate: Date,
  lastRestocked: {
    type: Date,
    default: Date.now
  },
  isLowStock: {
    type: Boolean,
    default: false
  },
  restockHistory: [{
    quantity: Number,
    date: { type: Date, default: Date.now },
    costPerUnit: Number,
    supplier: String
  }]
}, {
  timestamps: true
});

// Check low stock before saving
inventorySchema.pre('save', function(next) {
  this.isLowStock = this.quantity <= this.minStockLevel;
  next();
});

module.exports = mongoose.model('Inventory', inventorySchema);
