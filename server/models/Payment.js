const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'שם מלא הינו שדה חובה'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'כתובת אימייל הינה שדה חובה'],
    trim: true,
    lowercase: true
  },
  planId: {
    type: String,
    required: true,
    enum: ['starter', 'pro', 'business', 'enterprise']
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    default: 'completed',
    enum: ['completed', 'pending', 'failed']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Payment', paymentSchema);