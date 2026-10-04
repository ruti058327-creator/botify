const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
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
  cardholderName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  cardLast4: {
    type: String,
    required: true,
    match: /^\d{4}$/
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
  mode: {
    type: String,
    enum: ['recorded', 'live'],
    default: 'recorded'
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