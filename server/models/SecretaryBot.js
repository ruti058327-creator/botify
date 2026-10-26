// Mongoose מספק סכמות המתארות איזה מידע נשמר לכל בוט מזכירה.
import mongoose from 'mongoose';

// סכמת תור בודד שומרת את פרטי הלקוח, מועד התור ומצבו.
const appointmentSchema = new mongoose.Schema({
  // השם והטלפון מאפשרים לזהות את הלקוח וליצור איתו קשר.
  clientName: { type: String, required: true },
  // מספר זהות אינו חובה; מחרוזת ריקה מציינת שלא נמסר.
  idNumber: { type: String, default: '' },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  date: { type: String, required: true }, // התאריך נשמר כמחרוזת בפורמט YYYY-MM-DD
  time: { type: String, required: true }, // השעה נשמרת כמחרוזת בפורמט HH:MM
  // מצב התור מוגבל לאישור או ביטול, וברירת המחדל היא תור מאושר.
  status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
  // שעת יצירת הרשומה נרשמת אוטומטית לצורכי מיון ומעקב.
  createdAt: { type: Date, default: Date.now }
});

// סכמת חופשה מתעדת הודעה שנשלחה ואסימוני אישור הקריאה של לקוחות שהושפעו.
const emergencyVacationSchema = new mongoose.Schema({
  // התאריך שבו העסק סגור, כמחרוזת בפורמט התאריכים הנהוג במערכת.
  date: { type: String, required: true },
  // הודעה אישית אופציונלית שמצורפת לעדכון ללקוחות.
  customMessage: { type: String, default: '' },
  // מציין אם כל הודעות הדוא"ל המתוכננות נשלחו בהצלחה.
  messageSent: { type: Boolean, default: false },
  // רשומה לכל לקוח שקיבל הודעה, כולל מצב קריאה ואסימון האישור הייחודי.
  clientConfirmations: [{
    // הכתובת משמשת לזיהוי הנמען שקיבל את הודעת החופשה.
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

// יוצר מודל לשאילתות ולשמירת בוטי מזכירה באוסף המתאים ב-MongoDB.
export default mongoose.model('SecretaryBot', secretaryBotSchema);
