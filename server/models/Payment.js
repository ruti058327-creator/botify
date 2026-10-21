import mongoose from 'mongoose';


const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  fullName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  cardholderName: {
    type: String,
    trim: true
  },
  cardLast4: {
    type: String
  },
  planId: {
    type: String
  },
  amount: {
    type: Number
  },
  mode: {
    type: String,
    default: 'recorded'
  },
  status: {
    type: String,
    default: 'completed',
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Payment', paymentSchema);