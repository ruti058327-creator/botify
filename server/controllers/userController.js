// כלי קבצים משמשים לבדיקה ולהסרת העלאות; path בונה נתיב בטוח לקובץ קודם.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import User from '../models/User.js';
import httpError from '../utils/httpError.js';


// מחשב את התיקייה שבה middleware ההעלאה שומר תמונות פרופיל.
const uploadDirectory = fileURLToPath(new URL('../../public/uploads/profile-images', import.meta.url));

/**
 * Returns the number of registered users.
 * @param {import('express').Request} req Authenticated administrator request.
 * @param {import('express').Response} res HTTP response.
 * @returns {Promise<import('express').Response>} JSON user count.
 */
async function countUsers(req, res) {
  // סופר מסמכים במקום לטעון את כל המשתמשים לזיכרון.
  const count = await User.countDocuments();
  // מוסר למנהל את מספר החשבונות הכולל כערך מספרי.
  return res.json({ success: true, count });
}

/**
 * Returns users without password hashes.
 * @param {import('express').Request} req Authenticated administrator request.
 * @param {import('express').Response} res HTTP response.
 * @returns {Promise<import('express').Response>} JSON user list.
 */
async function listUsers(req, res) {
  // מחזיר רשימת משתמשים ללא שדה הסיסמה, וממיין מהחדש לישן.
  const users = await User.find({}, '-password').sort({ createdAt: -1 });
  // מחזיר את הרשימה לאחר שהשאילתה החריגה את סיסמאות המשתמשים.
  return res.json({ success: true, users });
}

/**
 * Verifies that file bytes match a supported image type.
 * @param {string} filePath Uploaded file path.
 * @param {string} mimeType MIME type reported by Multer.
 * @returns {Promise<boolean>} Whether the file has a valid JPEG, PNG, or WebP signature.
 */
async function hasValidImageSignature(filePath, mimeType) {
  // קורא את הבתים עצמם: שם וסוג MIME לבדם אינם מוכיחים את פורמט התמונה.
  const contents = await fs.readFile(filePath);
  // JPEG מזוהה לפי שלושת בתי הפתיחה הקבועים שלו.
  if (mimeType === 'image/jpeg') {
    return contents[0] === 0xff && contents[1] === 0xd8 && contents[2] === 0xff;
  }
  // PNG חייב להתחיל ברצף החתימה בן שמונת הבתים.
  if (mimeType === 'image/png') {
    return contents.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  // WebP הוא קובץ RIFF עם סימון WEBP במיקומים הקבועים בכותרת.
  if (mimeType === 'image/webp') {
    return contents.toString('ascii', 0, 4) === 'RIFF' && contents.toString('ascii', 8, 12) === 'WEBP';
  }
  // כל סוג שלא נתמך במפורש אינו עובר את בדיקת התוכן.
  return false;
}

async function removeFile(filePath) {
  try {
    // מוחק את הקובץ לאחר שימוש או במקרה של כשל בשמירה.
    await fs.unlink(filePath);
  } catch (error) {
    // קובץ שכבר נמחק נחשב למצב תקין; שגיאות אחרות עדיין מועברות למעלה.
    if (error.code !== 'ENOENT') throw error;
  }
}

/**
 * Validates and saves a profile image for the signed-in user.
 * @param {import('express').Request} req Multipart upload and authenticated user.
 * @param {import('express').Response} res HTTP response.
 * @returns {Promise<import('express').Response>} Saved image URL.
 */
async function uploadProfileImage(req, res) {
  // Middleware של Multer אמור לספק קובץ; בלעדיו אין מה לאמת או לשמור.
  if (!req.file) throw httpError(400, 'יש לבחור קובץ תמונה');
  // מסמן אם תמונת הפרופיל נשמרה, כדי לנקות העלאה יתומה בעת כשל.
  let imageSaved = false;

  try {
    // מאמתים את חתימת הקובץ; קובץ שאינו תמונה נמחק לפני החזרת שגיאה.
    if (!(await hasValidImageSignature(req.file.path, req.file.mimetype))) {
      await removeFile(req.file.path);
      throw httpError(400, 'תוכן הקובץ אינו תמונה תקינה');
    }

    // טוענים את חשבון המשתמש שאליו משויכת התמונה החדשה.
    const user = await User.findById(req.user.id);
    if (!user) {
      await removeFile(req.file.path);
      throw httpError(404, 'המשתמש לא נמצא');
    }

    // מחליפים את כתובת התמונה במסמך ושומרים את השינוי במסד הנתונים.
    const previousImage = user.profileImage;
    user.profileImage = `/uploads/profile-images/${req.file.filename}`;
    await user.save();
    imageSaved = true;

    // מוחקים רק תמונה קודמת שנמצאת בנתיב העלאות צפוי, כדי לא לגעת בקבצים זרים.
    if (typeof previousImage === 'string' && /^\/uploads\/profile-images\/[^/]+$/.test(previousImage)) {
      await removeFile(path.join(uploadDirectory, path.basename(previousImage)));
    }

    // מחזירים את כתובת התמונה הציבורית ששויכה לחשבון.
    return res.json({ success: true, profileImage: user.profileImage });
  } catch (error) {
    // אם השמירה לא הושלמה, מנקים את הקובץ הזמני כדי למנוע קבצים יתומים.
    if (!imageSaved) await removeFile(req.file.path);
    throw error;
  }
}

export default { countUsers, listUsers, uploadProfileImage };
