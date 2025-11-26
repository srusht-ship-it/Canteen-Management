const Payment = require('../models/Payment');
const Order = require('../models/Order');
const User = require('../models/User');

// Process payment
exports.processPayment = async (req, res, next) => {
  try {
    const { orderId, method, cardDetails } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Order is already paid'
      });
    }

    // Simulate payment processing
    const paymentSuccess = Math.random() > 0.1; // 90% success rate for simulation

    const payment = new Payment({
      order: orderId,
      user: req.user._id,
      amount: order.total,
      method,
      status: paymentSuccess ? 'completed' : 'failed',
      cardDetails: method === 'card' ? {
        last4: cardDetails?.last4 || '4242',
        brand: cardDetails?.brand || 'visa',
        expiryMonth: cardDetails?.expiryMonth || 12,
        expiryYear: cardDetails?.expiryYear || 2025
      } : undefined
    });

    await payment.save();

    if (paymentSuccess) {
      order.paymentStatus = 'paid';
      order.paymentMethod = method;
      order.status = 'confirmed';
      await order.save();

      // Add loyalty points (1 point per dollar spent)
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { loyaltyPoints: Math.floor(order.total) }
      });
    }

    res.json({
      success: paymentSuccess,
      message: paymentSuccess ? 'Payment successful' : 'Payment failed',
      data: {
        payment,
        order: paymentSuccess ? order : undefined
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get payment by ID
exports.getPayment = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('order')
      .populate('user', 'name email');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check authorization
    if (payment.user._id.toString() !== req.user._id.toString() && 
        req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this payment'
      });
    }

    res.json({
      success: true,
      data: payment
    });
  } catch (error) {
    next(error);
  }
};

// Get user payment history
exports.getMyPayments = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [payments, total] = await Promise.all([
      Payment.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('order', 'orderNumber total'),
      Payment.countDocuments({ user: req.user._id })
    ]);

    res.json({
      success: true,
      data: {
        payments,
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

// Request refund
exports.requestRefund = async (req, res, next) => {
  try {
    const { reason } = req.body;

    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (payment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to request refund for this payment'
      });
    }

    if (payment.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Can only refund completed payments'
      });
    }

    if (payment.status === 'refunded') {
      return res.status(400).json({
        success: false,
        message: 'Payment is already refunded'
      });
    }

    // Process refund (simulation)
    payment.status = 'refunded';
    payment.refundAmount = payment.amount;
    payment.refundReason = reason;
    await payment.save();

    // Update order
    await Order.findByIdAndUpdate(payment.order, {
      paymentStatus: 'refunded',
      status: 'cancelled'
    });

    // Deduct loyalty points
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { loyaltyPoints: -Math.floor(payment.amount) }
    });

    res.json({
      success: true,
      message: 'Refund processed successfully',
      data: payment
    });
  } catch (error) {
    next(error);
  }
};

// Generate receipt
exports.getReceipt = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate({
        path: 'order',
        populate: {
          path: 'items.menuItem',
          select: 'name'
        }
      })
      .populate('user', 'name email phone');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check authorization
    if (payment.user._id.toString() !== req.user._id.toString() && 
        req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this receipt'
      });
    }

    const receipt = {
      receiptNumber: payment.transactionId,
      date: payment.createdAt,
      customer: {
        name: payment.user.name,
        email: payment.user.email,
        phone: payment.user.phone
      },
      order: {
        orderNumber: payment.order.orderNumber,
        items: payment.order.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal
        })),
        subtotal: payment.order.subtotal,
        tax: payment.order.tax,
        discount: payment.order.discount,
        total: payment.order.total
      },
      payment: {
        method: payment.method,
        amount: payment.amount,
        status: payment.status,
        cardLast4: payment.cardDetails?.last4
      }
    };

    res.json({
      success: true,
      data: receipt
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Get all payments
exports.getAllPayments = async (req, res, next) => {
  try {
    const { status, method, startDate, endDate, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (method) query.method = method;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('user', 'name email')
        .populate('order', 'orderNumber'),
      Payment.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        payments,
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
