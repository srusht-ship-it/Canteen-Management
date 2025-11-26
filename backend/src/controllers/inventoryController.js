const Inventory = require('../models/Inventory');

// Get all inventory items
exports.getInventory = async (req, res, next) => {
  try {
    const { category, lowStock, search, page = 1, limit = 50 } = req.query;

    const query = {};
    if (category) query.category = category;
    if (lowStock === 'true') query.isLowStock = true;
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [items, total] = await Promise.all([
      Inventory.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Inventory.countDocuments(query)
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

// Get single inventory item
exports.getInventoryItem = async (req, res, next) => {
  try {
    const item = await Inventory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
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

// Create inventory item
exports.createInventoryItem = async (req, res, next) => {
  try {
    const item = new Inventory(req.body);
    await item.save();

    res.status(201).json({
      success: true,
      message: 'Inventory item created successfully',
      data: item
    });
  } catch (error) {
    next(error);
  }
};

// Update inventory item
exports.updateInventoryItem = async (req, res, next) => {
  try {
    const item = await Inventory.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    res.json({
      success: true,
      message: 'Inventory item updated successfully',
      data: item
    });
  } catch (error) {
    next(error);
  }
};

// Delete inventory item
exports.deleteInventoryItem = async (req, res, next) => {
  try {
    const item = await Inventory.findByIdAndDelete(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    res.json({
      success: true,
      message: 'Inventory item deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Restock inventory
exports.restockInventory = async (req, res, next) => {
  try {
    const { quantity, costPerUnit, supplier } = req.body;

    const item = await Inventory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    item.quantity += quantity;
    item.lastRestocked = new Date();
    item.restockHistory.push({
      quantity,
      costPerUnit: costPerUnit || item.costPerUnit,
      supplier: supplier || item.supplier?.name
    });

    if (costPerUnit) {
      item.costPerUnit = costPerUnit;
    }

    await item.save();

    res.json({
      success: true,
      message: 'Inventory restocked successfully',
      data: item
    });
  } catch (error) {
    next(error);
  }
};

// Get low stock alerts
exports.getLowStockAlerts = async (req, res, next) => {
  try {
    const lowStockItems = await Inventory.find({ isLowStock: true })
      .sort({ quantity: 1 });

    res.json({
      success: true,
      data: lowStockItems
    });
  } catch (error) {
    next(error);
  }
};

// Get inventory statistics
exports.getInventoryStats = async (req, res, next) => {
  try {
    const [
      totalItems,
      lowStockCount,
      totalValue,
      categoryBreakdown
    ] = await Promise.all([
      Inventory.countDocuments(),
      Inventory.countDocuments({ isLowStock: true }),
      Inventory.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: { $multiply: ['$quantity', '$costPerUnit'] } }
          }
        }
      ]),
      Inventory.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalQuantity: { $sum: '$quantity' }
          }
        }
      ])
    ]);

    res.json({
      success: true,
      data: {
        totalItems,
        lowStockCount,
        totalValue: totalValue[0]?.total || 0,
        categoryBreakdown
      }
    });
  } catch (error) {
    next(error);
  }
};
