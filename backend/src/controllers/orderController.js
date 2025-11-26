const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Inventory = require('../models/Inventory');

// Create new order
exports.createOrder = async (req, res, next) => {
  try {
    const { items, paymentMethod, specialInstructions, isDelivery, deliveryAddress } = req.body;

    // Validate and get menu items
    const menuItemIds = items.map(item => item.menuItem);
    const menuItems = await MenuItem.find({ _id: { $in: menuItemIds }, isAvailable: true });

    if (menuItems.length !== items.length) {
      return res.status(400).json({
        success: false,
        message: 'Some items are not available'
      });
    }

    // Calculate order totals
    let subtotal = 0;
    const orderItems = items.map(item => {
      const menuItem = menuItems.find(mi => mi._id.toString() === item.menuItem);
      const itemSubtotal = menuItem.price * item.quantity;
      subtotal += itemSubtotal;

      return {
        menuItem: menuItem._id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: item.quantity,
        specialInstructions: item.specialInstructions,
        subtotal: itemSubtotal
      };
    });

    const tax = subtotal * 0.1; // 10% tax
    const total = subtotal + tax;

    // Calculate estimated ready time
    const maxPrepTime = Math.max(...menuItems.map(mi => mi.preparationTime || 15));
    const estimatedReadyTime = new Date(Date.now() + maxPrepTime * 60000);

    // Create order
    const order = new Order({
      user: req.user._id,
      items: orderItems,
      subtotal,
      tax,
      total,
      paymentMethod: paymentMethod || 'cash',
      specialInstructions,
      isDelivery,
      deliveryAddress,
      estimatedReadyTime,
      statusHistory: [{ status: 'pending', timestamp: new Date() }]
    });

    await order.save();

    // Update menu item order counts
    for (const item of items) {
      await MenuItem.findByIdAndUpdate(item.menuItem, {
        $inc: { orderCount: item.quantity }
      });
    }

    // Update inventory (reduce stock)
    for (const menuItem of menuItems) {
      if (menuItem.ingredients && menuItem.ingredients.length > 0) {
        for (const ing of menuItem.ingredients) {
          const orderItem = items.find(i => i.menuItem === menuItem._id.toString());
          await Inventory.findByIdAndUpdate(ing.ingredient, {
            $inc: { quantity: -(ing.quantity * orderItem.quantity) }
          });
        }
      }
    }

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('newOrder', order);
    }

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// Get user orders
exports.getMyOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = { user: req.user._id };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('items.menuItem', 'name image'),
      Order.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        orders,
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

// Get single order
exports.getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.menuItem', 'name image price')
      .populate('user', 'name email phone');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns the order or is admin/staff
    if (order.user._id.toString() !== req.user._id.toString() && 
        !['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this order'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// Update order status (Staff/Admin only)
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body;
    
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Validate status transition
    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready: ['completed'],
      completed: [],
      cancelled: []
    };

    if (!validTransitions[order.status].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from ${order.status} to ${status}`
      });
    }

    order.status = status;
    if (note) {
      order.statusHistory[order.statusHistory.length - 1].note = note;
    }

    if (status === 'ready') {
      order.actualReadyTime = new Date();
    }

    await order.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`order-${order._id}`).emit('orderStatusUpdate', {
        orderId: order._id,
        status: order.status
      });
    }

    res.json({
      success: true,
      message: 'Order status updated',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// Cancel order
exports.cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check ownership
    if (order.user.toString() !== req.user._id.toString() && 
        !['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this order'
      });
    }

    // Can only cancel pending or confirmed orders
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage'
      });
    }

    order.status = 'cancelled';
    await order.save();

    // Restore inventory
    for (const item of order.items) {
      const menuItem = await MenuItem.findById(item.menuItem);
      if (menuItem && menuItem.ingredients) {
        for (const ing of menuItem.ingredients) {
          await Inventory.findByIdAndUpdate(ing.ingredient, {
            $inc: { quantity: ing.quantity * item.quantity }
          });
        }
      }
    }

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// Get all orders (Admin/Staff)
exports.getAllOrders = async (req, res, next) => {
  try {
    const { status, date, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('user', 'name email phone')
        .populate('items.menuItem', 'name'),
      Order.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        orders,
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

// Get order statistics
exports.getOrderStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      todayOrders,
      pendingOrders,
      completedToday,
      todayRevenue
    ] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: today } }),
      Order.countDocuments({ status: { $in: ['pending', 'confirmed', 'preparing'] } }),
      Order.countDocuments({ status: 'completed', createdAt: { $gte: today } }),
      Order.aggregate([
        { 
          $match: { 
            status: 'completed',
            createdAt: { $gte: today }
          }
        },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        todayOrders,
        pendingOrders,
        completedToday,
        todayRevenue: todayRevenue[0]?.total || 0
      }
    });
  } catch (error) {
    next(error);
  }
};
