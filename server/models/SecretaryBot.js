const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  clientName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  date: { type: String, required: true }, // פורמט YYYY-MM-DD
  time: { type: String, required: true }, // פורמט HH:MM
  status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
  createdAt: { type: Date, default: Date.now }
});

const emergencyVacationSchema = new mongoose.Schema({
  date: { type: String, required: true },
  messageSent: { type: Boolean, default: false },
  clientConfirmations: [{
    clientEmail: String,
    confirmedRead: { type: Boolean, default: false },
    confirmationToken: String
  }]
});

const secretaryBotSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  botUrlKey: { type: String, required: true, unique: true }, // הקישור הייחודי לבוט
  
  // הגדרות בסיסיות מהמסמך
  dayOff: { type: String, required: true }, // למשל: 'שישי', 'שבת' וכו'
  openTime: { type: String, required: true, default: '08:00' }, // שעת פתיחה
  closeTime: { type: String, required: true, default: '16:00' }, // שעת סיום
  defaultPrice: { type: Number, required: true, default: 150 }, // מחיר ברירת מחדל לפגישה

  // הגדרות עריכה מתקדמות
  appointmentDurationMinutes: { type: Number, required: true, default: 30 }, // אורך כל תור בדקות
  breakDurationMinutes: { type: Number, default: 10 }, // אורך הפסקה בין תורים בדקות
  // רשימות נתונים
  appointments: [appointmentSchema],
  emergencyVacations: [emergencyVacationSchema]

}, { timestamps: true });

module.exports = mongoose.model('SecretaryBot', secretaryBotSchema);