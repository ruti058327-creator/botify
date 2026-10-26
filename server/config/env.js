// dotenv קורא משתני הגדרה מקובץ .env ומוסיף אותם ל-process.env של התהליך.
import dotenv from 'dotenv';
// dirname ו-resolve בונים נתיב מוחלט לקובץ הסביבה, ללא תלות בתיקיית הפקודה.
import { dirname, resolve } from 'node:path';
// fileURLToPath ממיר את כתובת המודול לנתיב קובץ רגיל של מערכת ההפעלה.
import { fileURLToPath } from 'node:url';
// הסכמה מרכזת את סוגי הערכים הנדרשים ואת בדיקות התקינות שלהם.
import environmentSchema from '../validation/environmentSchema.js';

// מחשב את מיקום התיקייה שבה נמצא קובץ התצורה, בלי להסתמך על תיקיית ההרצה.
const currentDirectory = dirname(fileURLToPath(import.meta.url));
// טוען את קובץ .env שבתיקיית server, יחסית לקובץ זה.
dotenv.config({ path: resolve(currentDirectory, '../.env') });

// בודקים את כל ההגדרות יחד, ממירים ערכים לטיפוסים מתאימים ולא עוצרים בשגיאה הראשונה.
const { error, value } = environmentSchema.validate(process.env, {
  abortEarly: false,
  convert: true
});

if (error) {
  // מאחדים את כל הודעות הבדיקה כדי שמפעיל השרת יוכל לתקן כמה הגדרות בבת אחת.
  const details = error.details.map(detail => detail.message).join('; ');
  // תצורה לא תקינה מונעת הפעלה כדי שהשרת לא ימשיך עם ערכים חסרים או שגויים.
  throw new Error(`Invalid environment configuration: ${details}`);
}

// שומרים מחרוזת עבור PORT, כפי שמקובל במשתני סביבה, אחרי בדיקת הערך כמספר.
process.env.PORT = String(value.PORT);
// כתובת האתר היא אופציונלית; במקרה שלא סופקה משתמשים בשרת הפיתוח המקומי.
process.env.APP_URL = value.APP_URL || 'http://localhost:3000';
