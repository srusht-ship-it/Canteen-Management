const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot be more than 5']
  },
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  comment: {
    type: String,
    trim: true,
    maxlength: [500, 'Comment cannot be more than 500 characters']
  },
  isApproved: {
    type: Boolean,
    default: true
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  helpfulVotes: {
    type: Number,
    default: 0
  },
  adminResponse: {
    comment: String,
    respondedAt: Date,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }
}, {
  timestamps: true
});

// Prevent duplicate reviews from same user for same item
reviewSchema.index({ user: 1, menuItem: 1 }, { unique: true });

// Update menu item rating after review is saved
reviewSchema.post('save', async function() {
  const MenuItem = mongoose.model('MenuItem');
  const reviews = await this.constructor.find({ 
    menuItem: this.menuItem, 
    isApproved: true,
    isVisible: true 
  });
  
  if (reviews.length > 0) {
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    await MenuItem.findByIdAndUpdate(this.menuItem, {
      'rating.average': Math.round(avgRating * 10) / 10,
      'rating.count': reviews.length
    });
  }
});

module.exports = mongoose.model('Review', reviewSchema);
