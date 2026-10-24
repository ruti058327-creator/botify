// קובץ זה משתמש ב-CommonJS, בהתאם למודול הישן של בוט המזכירה.
const mongoose = require('mongoose');

// סכמת תור בודד שומרת את פרטי הלקוח, מועד התור ומצבו.
const appointmentSchema = new mongoose.Schema({
  clientName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  date: { type: String, required: true }, // התאריך נשמר כמחרוזת בפורמט YYYY-MM-DD
  time: { type: String, required: true }, // השעה נשמרת כמחרוזת בפורמט HH:MM
  status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
  createdAt: { type: Date, default: Date.now }
});

// סכמת חופשה מתעדת הודעה שנשלחה ואסימוני אישור הקריאה של לקוחות שהושפעו.
const emergencyVacationSchema = new mongoose.Schema({
  date: { type: String, required: true },
  messageSent: { type: Boolean, default: false },
  clientConfirmations: [{
    clientEmail: String,
    confirmedRead: { type: Boolean, default: false },
    confirmationToken: String
  }]
});

// הגדרות הבוט כוללות שעות פעילות, תמחור ותתי-מסמכים של תורים וחופשות.
const secretaryBotSchema = new mongoose.Schema({
  // מזהה בעל העסק מאפשר לוודא הרשאה לשינוי הגדרות הבוט.
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  botUrlKey: { type: String, required: true, unique: true }, // הקישור הייחודי לבוט
  
  // הגדרות בסיסיות שהעסק מזין בעת הגדרת הבוט.
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

// רושם את מודל המזכירה לייבוא בקבצי CommonJS התואמים.
module.exports = mongoose.model('SecretaryBot', secretaryBotSchema);