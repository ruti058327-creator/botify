// Joi מאפשר לתאר את המבנה התקין של משתני הסביבה ולדווח על תצורה חסרה.
import Joi from 'joi';

// כללי התצורה קובעים ערכים נדרשים, ברירות מחדל ובדיקות פורמט.
const environmentSchema = Joi.object({
  // מחרוזת חיבור למסד הנתונים חייבת להכיל ערך שאינו רווח בלבד.
  MONGO_URI: Joi.string().trim().min(1).required(),
  // מפתח החתימה חייב להיות ארוך דיו כדי להקשות על ניחושו.
  JWT_SECRET: Joi.string().trim().min(32).required(),
  // הפורט הוא מספר שלם בטווח הפורטים התקין; אם חסר נבחר 3000.
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  // הכתובת הציבורית חייבת להיות HTTP או HTTPS, אך מותר להשאיר אותה ריקה.
  APP_URL: Joi.string().uri({ scheme: ['http', 'https'] }).allow('').default('http://localhost:3000'),
  // פרטי הדוא"ל אופציונליים, אך כאשר כתובת נמסרת היא חייבת להיות תקינה.
  EMAIL_USER: Joi.string().email().allow(''),
  // סיסמת ספק הדוא"ל נשמרת כמחרוזת ואינה נדרשת אם שירות הדוא"ל לא מופעל.
  EMAIL_PASS: Joi.string().allow(''),
  // מפתח Gemini אופציונלי כדי לאפשר שימוש בתשובות מקומיות גם בלעדיו.
  GEMINI_API_KEY: Joi.string().allow('')
}).custom((value, helpers) => {
  // מונעים מצב שבו הוגדר רק חלק מצמד פרטי הכניסה לדוא"ל.
  if (Boolean(value.EMAIL_USER) !== Boolean(value.EMAIL_PASS)) {
    return helpers.error('environment.emailCredentials');
  }
  // משאירים את האובייקט ללא שינוי אם שני הפרטים הוגדרו יחד או שניהם חסרים.
  return value;
}).messages({
  // מסבירים איזו תלות בין פרטי הדוא"ל נכשלה בבדיקת התצורה.
  'environment.emailCredentials': 'EMAIL_USER and EMAIL_PASS must either both be set or both be empty'
// מאפשרים הגדרות נוספות במערכת בלי לדחות אותן, אף שהסכמה בודקת את המוכרות.
}).unknown(true);

export default environmentSchema;
