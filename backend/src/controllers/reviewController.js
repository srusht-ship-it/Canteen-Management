const Review = require('../models/Review');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');

// Get reviews for a menu item
exports.getItemReviews = async (req, res, next) => {
  try {
    const { menuItemId } = req.params;
    const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc' } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = order === 'desc' ? -1 : 1;

    const [reviews, total] = await Promise.all([
      Review.find({ menuItem: menuItemId, isVisible: true, isApproved: true })
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('user', 'name avatar'),
      Review.countDocuments({ menuItem: menuItemId, isVisible: true, isApproved: true })
    ]);

    // Get rating distribution
    const ratingDistribution = await Review.aggregate([
      { $match: { menuItem: require('mongoose').Types.ObjectId.createFromHexString(menuItemId), isVisible: true, isApproved: true } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        reviews,
        ratingDistribution,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Create review
exports.createReview = async (req, res, next) => {
  try {
    const { menuItem, rating, title, comment, order } = req.body;

    // Check if menu item exists
    const menuItemDoc = await MenuItem.findById(menuItem);
    if (!menuItemDoc) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    // Check if user has ordered this item (optional validation)
    if (order) {
      const orderDoc = await Order.findOne({
        _id: order,
        user: req.user._id,
        'items.menuItem': menuItem,
        status: 'completed'
      });

      if (!orderDoc) {
        return res.status(400).json({
          success: false,
          message: 'You can only review items from completed orders'
        });
      }
    }

    // Check for existing review
    const existingReview = await Review.findOne({
      user: req.user._id,
      menuItem
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this item'
      });
    }

    const review = new Review({
      user: req.user._id,
      menuItem,
      order,
      rating,
      title,
      comment
    });

    await review.save();
    await review.populate('user', 'name avatar');

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: review
    });
  } catch (error) {
    next(error);
  }
};

// Update review
exports.updateReview = async (req, res, next) => {
  try {
    const { rating, title, comment } = req.body;

    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check ownership
    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this review'
      });
    }

    review.rating = rating || review.rating;
    review.title = title || review.title;
    review.comment = comment || review.comment;

    await review.save();
    await review.populate('user', 'name avatar');

    res.json({
      success: true,
      message: 'Review updated successfully',
      data: review
    });
  } catch (error) {
    next(error);
  }
};

// Delete review
exports.deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check ownership or admin
    if (review.user.toString() !== req.user._id.toString() && 
        req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this review'
      });
    }

    await review.deleteOne();

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get user's reviews
exports.getMyReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, total] = await Promise.all([
      Review.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('menuItem', 'name image'),
      Review.countDocuments({ user: req.user._id })
    ]);

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Get all reviews (for moderation)
exports.getAllReviews = async (req, res, next) => {
  try {
    const { isApproved, page = 1, limit = 20 } = req.query;

    const query = {};
    if (isApproved !== undefined) query.isApproved = isApproved === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, total] = await Promise.all([
      Review.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('user', 'name email')
        .populate('menuItem', 'name'),
      Review.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Moderate review
exports.moderateReview = async (req, res, next) => {
  try {
    const { isApproved, isVisible, adminResponse } = req.body;

    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    if (isApproved !== undefined) review.isApproved = isApproved;
    if (isVisible !== undefined) review.isVisible = isVisible;
    if (adminResponse) {
      review.adminResponse = {
        comment: adminResponse,
        respondedAt: new Date(),
        respondedBy: req.user._id
      };
    }

    await review.save();

    res.json({
      success: true,
      message: 'Review moderated successfully',
      data: review
    });
  } catch (error) {
    next(error);
  }
};

// Vote review as helpful
exports.voteHelpful = async (req, res, next) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { $inc: { helpfulVotes: 1 } },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.json({
      success: true,
      message: 'Vote recorded',
      data: { helpfulVotes: review.helpfulVotes }
    });
  } catch (error) {
    next(error);
  }
};
