// מייבאים כלים לחישוב נתיבים וליצירת שמות קבצים אקראיים וייחודיים.
import { dirname as __dirnameOf } from 'node:path';
import { fileURLToPath as __fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';

// ממירים את כתובת המודול לתיקייה המקומית שבה נמצא קובץ ה-middleware.
const __dirname = __dirnameOf(__fileURLToPath(import.meta.url));

// כל התמונות נשמרות בתיקייה ציבורית קבועה, שנוצרת גם אם עדיין אינה קיימת.
const uploadDirectory = path.resolve(__dirname, '../../public/uploads/profile-images');
fs.mkdirSync(uploadDirectory, { recursive: true });

// רק סוגי MIME אלה מקבלים סיומת מוכרת בשלב שמירת הקובץ.
const allowedTypes = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

const storage = multer.diskStorage({
  // מורה ל-Multer היכן לשמור את תוכן ההעלאה.
  destination: uploadDirectory,
  /**
   * מייצר שם קובץ ייחודי ושומר על סיומת התמונה המותרת.
   * @param {import('express').Request} req בקשת ההעלאה.
   * @param {import('multer').File} file פרטי הקובץ שהועלה.
   * @param {import('multer').DiskStorageOptions['filename']} callback מחזיר שם קובץ ל-Multer.
   * @returns {void} מוסר ל-Multer את שם הקובץ.
   */
  filename(req, file, callback) {
    // מזהה UUID מונע התנגשות שמות; הסיומת נגזרת מהסוג שאושר.
    callback(null, `${crypto.randomUUID()}${allowedTypes[file.mimetype] || ''}`);
  }
});

export default multer({
  storage,
  // מגביל גודל ומספר קבצים כדי למנוע העלאות גדולות או מרובות לבקשה אחת.
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  /**
   * דוחה סוגי MIME שאינם JPEG, PNG או WebP.
   * @param {import('express').Request} req בקשת ההעלאה.
   * @param {import('multer').File} file פרטי הקובץ שהועלה.
   * @param {import('multer').FileFilterCallback} callback מקבל או דוחה את הקובץ.
   * @returns {void} מעביר ל-Multer החלטת קבלה או שגיאת ולידציה.
   */
  fileFilter(req, file, callback) {
    // דוחה סוג לא מוכר לפני שמירתו, ומקבל רק את שלושת הפורמטים הנתמכים.
    if (!allowedTypes[file.mimetype]) {
      const error = new Error('אפשר להעלות תמונת JPG, PNG או WebP בלבד');
      error.statusCode = 400;
      return callback(error);
    }
    return callback(null, true);
  }
});