// Mongoose מגדיר את שדות ההודעות ואת ברירות המחדל שלהן.
import mongoose from 'mongoose';


// כל רשומה מייצגת הודעת תמיכה יחידה המקושרת לחשבון ולשיחה.
const contactSchema = new mongoose.Schema({
    // שם המשתמש מאפשר להציג הודעות של אותו לקוח ולשלוח לו תשובה.
    username: { type: String },
    // נושא ריק הוא ברירת המחדל לתגובה או לרשומה ללא נושא.
    subject: { type: String, default: '' },
    // תוכן ההודעה כפי שנשלח על ידי הלקוח או מנהל.
    message: { type: String },
    reply: { type: String, default: '' }, 
    // מזהה השיחה מקבץ הודעות קשורות; ברירת המחדל תומכת בהיסטוריה ישנה.
    chatId: { type: String, default: 'chat_default' }, // <--- הוספת chatId כדי שהמידע יישמר
    // מסמן אם ההודעה נכתבה על ידי מנהל או על ידי לקוח.
    isAdmin: { type: Boolean, default: false }, 
    // זמן היצירה מאפשר להציג את רצף ההודעות בסדר כרונולוגי.
    createdAt: { type: Date, default: Date.now }
});

// מאפשר לבקרים לבצע שאילתות ושמירות של הודעות תמיכה.
export default mongoose.model('Contact', contactSchema);