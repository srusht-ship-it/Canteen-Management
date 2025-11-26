const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { auth, optionalAuth, authorize } = require('../middleware/auth');
const { validate, reviewValidation, mongoIdValidation, paginationValidation } = require('../middleware/validation');

// Public routes
router.get('/item/:menuItemId', paginationValidation, validate, reviewController.getItemReviews);

// Customer routes
router.post('/', auth, reviewValidation, validate, reviewController.createReview);
router.get('/my-reviews', auth, paginationValidation, validate, reviewController.getMyReviews);
router.put('/:id', auth, mongoIdValidation, validate, reviewController.updateReview);
router.delete('/:id', auth, mongoIdValidation, validate, reviewController.deleteReview);
router.post('/:id/helpful', optionalAuth, mongoIdValidation, validate, reviewController.voteHelpful);

// Admin routes
router.get('/', auth, authorize('admin'), paginationValidation, validate, reviewController.getAllReviews);
router.patch('/:id/moderate', auth, authorize('admin'), mongoIdValidation, validate, reviewController.moderateReview);

module.exports = router;
