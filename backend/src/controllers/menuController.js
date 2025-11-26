const MenuItem = require('../models/MenuItem');

// Get all menu items with filters
exports.getMenuItems = async (req, res, next) => {
  try {
    const {
      category,
      isAvailable,
      isVegetarian,
      isVegan,
      isGlutenFree,
      minPrice,
      maxPrice,
      search,
      sortBy = 'name',
      order = 'asc',
      page = 1,
      limit = 20
    } = req.query;

    const query = {};

    // Filters
    if (category) query.category = category.toLowerCase();
    if (isAvailable !== undefined) query.isAvailable = isAvailable === 'true';
    if (isVegetarian === 'true') query['dietaryLabels.isVegetarian'] = true;
    if (isVegan === 'true') query['dietaryLabels.isVegan'] = true;
    if (isGlutenFree === 'true') query['dietaryLabels.isGlutenFree'] = true;
    
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = order === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [items, total] = await Promise.all([
      MenuItem.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      MenuItem.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        items,
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

// Get single menu item
exports.getMenuItem = async (req, res, next) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    next(error);
  }
};

// Create menu item (Admin only)
exports.createMenuItem = async (req, res, next) => {
  try {
    const item = new MenuItem(req.body);
    await item.save();

    res.status(201).json({
      success: true,
      message: 'Menu item created successfully',
      data: item
    });
  } catch (error) {
    next(error);
  }
};

// Update menu item (Admin only)
exports.updateMenuItem = async (req, res, next) => {
  try {
    const item = await MenuItem.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    res.json({
      success: true,
      message: 'Menu item updated successfully',
      data: item
    });
  } catch (error) {
    next(error);
  }
};

// Delete menu item (Admin only)
exports.deleteMenuItem = async (req, res, next) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    res.json({
      success: true,
      message: 'Menu item deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get categories
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await MenuItem.distinct('category');
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

// Get daily specials
exports.getDailySpecials = async (req, res, next) => {
  try {
    const specials = await MenuItem.find({ 
      isDailySpecial: true, 
      isAvailable: true 
    });

    res.json({
      success: true,
      data: specials
    });
  } catch (error) {
    next(error);
  }
};

// Toggle availability
exports.toggleAvailability = async (req, res, next) => {
  try {
    const item = await MenuItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    item.isAvailable = !item.isAvailable;
    await item.save();

    res.json({
      success: true,
      message: `Item ${item.isAvailable ? 'available' : 'unavailable'} now`,
      data: item
    });
  } catch (error) {
    next(error);
  }
};

// Get popular items
exports.getPopularItems = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const items = await MenuItem.find({ isAvailable: true })
      .sort({ orderCount: -1, 'rating.average': -1 })
      .limit(limit);

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    next(error);
  }
};
