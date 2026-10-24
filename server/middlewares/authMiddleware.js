// פונקציות JWT מאמתות את האסימון; httpError יוצר שגיאות בפורמט המערכת.
import __cjsImport0 from '../utils/jwt.js';
import httpError from '../utils/httpError.js';

const { verifyAuthToken } = __cjsImport0;


/**
 * מאמת אסימון Bearer ומצרף את פרטי המשתמש לבקשה.
 * @param {import('express').Request} req בקשת HTTP עם כותרת Authorization.
 * @param {import('express').Response} res תגובת HTTP.
 * @param {import('express').NextFunction} next המשך ל-middleware הבא לאחר אימות תקין.
 * @returns {void} ממשיך או מחזיר שגיאת 401.
 */
export function authenticateToken(req, res, next) {
  // קורא את הכותרת התקנית ומחלץ ממנה את סוג האימות ואת האסימון.
  const authorization = req.get('Authorization') || '';
  const [scheme, token] = authorization.split(' ');

  // ממשיכים רק אם הלקוח שלח אסימון בפורמט Bearer.
  if (scheme !== 'Bearer' || !token) {
    return next(httpError(401, 'נדרשת התחברות כדי לבצע פעולה זו'));
  }

  try {
    // אימות החתימה והתוקף מבטיח שפרטי המשתמש נלקחו מאסימון תקין.
    const payload = verifyAuthToken(token);
    // מצרפים לבקשה רק את השדות שהנתיבים צריכים לצורך הרשאות ובעלות.
    req.user = {
      id: payload.sub,
      username: payload.username,
      role: payload.role
    };
    // לאחר הוספת המשתמש המאומת אפשר להמשיך לטיפול בנתיב.
    return next();
  } catch {
    // אסימון פגום או שפג תוקפו אינו מאפשר גישה למשאב המוגן.
    return next(httpError(401, 'אסימון ההתחברות אינו תקף או שפג תוקפו'));
  }
}

/**
 * מגביל את המשך הטיפול למשתמשים בעלי תפקיד מנהל.
 * @param {import('express').Request} req בקשה עם פרטי המשתמש שאומתו.
 * @param {import('express').Response} res תגובת HTTP.
 * @param {import('express').NextFunction} next המשך לנתיב כאשר המשתמש מנהל.
 * @returns {void} ממשיך או מחזיר שגיאת 403.
 */
export function requireAdmin(req, res, next) {
  // תפקיד שאינו מנהל מקבל שגיאת הרשאה, גם אם המשתמש התחבר בהצלחה.
  if (req.user?.role !== 'admin') {
    return next(httpError(403, 'אין הרשאה לבצע פעולה זו'));
  }
  // משתמש מנהל רשאי לעבור לשלב הבא בשרשרת.
  return next();
}

export default { authenticateToken, requireAdmin };