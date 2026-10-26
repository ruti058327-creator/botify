// Mongoose מגדיר את מבנה המשתמש, ו-bcrypt מגן על סיסמאות באמצעות גיבוב.
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

// השדות מתארים זהות ופרטי קשר, חשבון, הרשאות ותוכנית שימוש.
const userSchema = new mongoose.Schema({
  // שם לתצוגה; המערכת יכולה להסתמך על שם המשתמש אם הוא חסר.
  fullName: {
    type: String
  },
  // מספר זהות נשמר כמחרוזת כדי לא לאבד אפסים בתחילתו.
  idNumber: {
    type: String
  },
  // כתובת הדוא"ל ייחודית, מנוקה מרווחים ומנורמלת לאותיות קטנות.
  email: {
    type: String,
    unique: true,
    trim: true,
    lowercase: true
  },
  // מספר טלפון נשמר כמחרוזת כדי לשמר קידומות וסימנים.
  phone: {
    type: String
  },
  // שם העסק מוצג בפרופיל ובממשקים הקשורים לחשבון.
  businessName: {
    type: String
  },
  // שם המשתמש הוא מזהה ייחודי המשמש להתחברות ולחיפוש החשבון.
  username: {
    type: String,
    unique: true
  },
  // הסיסמה נשמרת כגיבוב לפני כתיבת המסמך, לא כטקסט גלוי.
  password: {
    type: String
  },
  // כתובת תמונת פרופיל ריקה כברירת מחדל עד להעלאת תמונה.
  profileImage: {
    type: String,
    default: ''
  },
  // משתמש רגיל הוא תפקיד ברירת המחדל, אלא אם תצורת השרת מגדירה אחרת.
  role: {
    type: String,
    default: 'user'
  },
  // כל משתמש מתחיל במסלול הבסיסי עד שהמסלול מתעדכן.
  plan: {
    type: String,
    default: 'בסיסי'
  },
  // תאריך יצירה מפורש נשמר לצד חותמות העדכון האוטומטיות של Mongoose.
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

/**
 * מצפין סיסמה ששונתה לפני שמירת מסמך המשתמש.
 * @this {import('mongoose').HydratedDocument<object>} מסמך המשתמש הנשמר.
 * @returns {Promise<void>} משלים את ההצפנה לפני המשך השמירה.
 */
userSchema.pre('save', async function () {
  // אם הסיסמה לא השתנתה, אין צורך לבצע גיבוב נוסף.
  if (!this.isModified('password')) return;
  // גיבוב עם salt בעלות 10 מקשה על שחזור הסיסמה המקורית.
  this.password = await bcrypt.hash(this.password, 10);
});

/**
 * משווה סיסמה גלויה לגיבוב bcrypt השמור.
 * @param {string} candidatePassword הסיסמה שסיפק המשתמש.
 * @param {string} passwordHash גיבוב הסיסמה השמור.
 * @returns {Promise<boolean>} האם הסיסמה תואמת לגיבוב.
 */
userSchema.statics.comparePassword = function (candidatePassword, passwordHash) {
  // bcrypt משווה את הטקסט שהוזן לגיבוב בלי לפענח או לחשוף את הסיסמה השמורה.
  return bcrypt.compare(candidatePassword, passwordHash);
};

// מגדיר כיצד מסמך משתמש יומר ל-JSON לפני שליחה או החזרה ללקוח.
userSchema.set('toJSON', {
  /**
   * מסיר שדות פנימיים ורגישים מייצוג JSON של המשתמש.
   * @param {import('mongoose').Document} document מסמך המשתמש המקורי.
   * @param {Record<string, *>} returnedObject אובייקט JSON שהוכן להחזרה.
   * @returns {Record<string, *>} האובייקט לאחר הסרת סיסמה וגרסת מסמך.
   */
  transform(document, returnedObject) {
    // מונע חשיפת גיבוב הסיסמה ומזהה הגרסה הפנימי של Mongoose.
    delete returnedObject.password;
    delete returnedObject.__v;
    return returnedObject;
  }
});

// יוצר את מודל המשתמש שבו הבקרים משתמשים לקריאה ולשמירה במסד.
export default mongoose.model('User', userSchema);