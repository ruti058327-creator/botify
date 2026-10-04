const { verifyAuthToken } = require('../utils/jwt');

/**
 * מאמת אסימון Bearer ומצרף את פרטי המשתמש לבקשה.
 * @param {import('express').Request} req בקשת HTTP עם כותרת Authorization.
 * @param {import('express').Response} res תגובת HTTP.
 * @param {import('express').NextFunction} next המשך ל-middleware הבא לאחר אימות תקין.
 * @returns {void} ממשיך או מחזיר שגיאת 401.
 */
function authenticateToken(req, res, next) {
  const authorization = req.get('Authorization') || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, message: 'נדרשת התחברות כדי לבצע פעולה זו' });
  }

  try {
    const payload = verifyAuthToken(token);
    req.user = {
      id: payload.sub,
      username: payload.username,
      role: payload.role
    };
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'אסימון ההתחברות אינו תקף או שפג תוקפו' });
  }
}

/**
 * מגביל את המשך הטיפול למשתמשים בעלי תפקיד מנהל.
 * @param {import('express').Request} req בקשה עם פרטי המשתמש שאומתו.
 * @param {import('express').Response} res תגובת HTTP.
 * @param {import('express').NextFunction} next המשך לנתיב כאשר המשתמש מנהל.
 * @returns {void} ממשיך או מחזיר שגיאת 403.
 */
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'אין הרשאה לבצע פעולה זו' });
  }
  return next();
}

module.exports = { authenticateToken, requireAdmin };