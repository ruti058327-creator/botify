// Mongoose משמש להגדרת רשומות השיחה ולשמירתן ב-MongoDB.
import mongoose from 'mongoose';


// הודעה מקושרת למשתמש, לשיחה מסוימת, לשולח ולתוכן שנכתב.
const messageSchema = new mongoose.Schema({
  // מזהה החשבון שאליו שייכת השיחה.
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // שם הלקוח נשמר כדי שמנהל יוכל לחפש הודעות לפי שם.
  clientName: { type: String }, // שם הלקוח לצורך חיפוש קל למנהל
  // מזהה משותף מאפשר לקבץ הודעות של אותה שיחה.
  chatId: { type: String },     // מזהה ייחודי לכל שיחה נפרדת
  // מציין אם ההודעה נשלחה על ידי המשתמש או הבוט.
  sender: { type: String },
  // הטקסט שהוצג בשיחה.
  text: { type: String },
}, { timestamps: true });

// timestamps מוסיף אוטומטית createdAt ו-updatedAt לרשומת ההודעה.
export default mongoose.model('Message', messageSchema);