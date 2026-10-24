// Mongoose בונה את מודל התשלומים ששומר את פרטי העסקה שנרשמה.
import mongoose from 'mongoose';


// הסכמה מתעדת מי שילם, עבור איזה מסלול, את פרטי הסכום ואת מצב העסקה.
const paymentSchema = new mongoose.Schema({
  // קישור לחשבון שביצע את התשלום.
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // השם וכתובת הדוא"ל נשמרים עם הרשומה לצורכי תיעוד וחשבונאות.
  fullName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  // פרטי בעל הכרטיס וארבע הספרות האחרונות בלבד; אין שומרים מספר כרטיס מלא.
  cardholderName: {
    type: String,
    trim: true
  },
  cardLast4: {
    type: String
  },
  // מזהה המסלול קובע את ההטבות והמכסה שנרכשו.
  planId: {
    type: String
  },
  // הסכום הסופי שנרשם עבור העסקה.
  amount: {
    type: Number
  },
  // מציין באיזה אופן נרשם התשלום; ברירת המחדל היא רישום פנימי.
  mode: {
    type: String,
    default: 'recorded'
  },
  // מצב העסקה מאפשר להבחין בין תשלום שהושלם למצבים אחרים.
  status: {
    type: String,
    default: 'completed',
  },
  // תאריך הרישום משמש למיון העסקאות לפי סדר עדכני.
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// רושם את המודל לשימוש בקרי התשלום ומכסת הבוטים.
export default mongoose.model('Payment', paymentSchema);