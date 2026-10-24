// טוען את הסביבה לפני קריאת המפתח המשמש לחתימת אסימוני התחברות.
import '../config/env.js';
import jwt from 'jsonwebtoken';


const jwtSecret = process.env.JWT_SECRET;
// אין להפעיל את מנגנון האימות עם מפתח חסר, כי אז חתימות אינן בטוחות.
if (!jwtSecret) throw new Error('JWT_SECRET is missing. Set it in server/.env using server/.env.example.');

/**
 * חותם אסימון JWT למשתמש עם מזהה, שם, תפקיד ותוקף של שעתיים.
 * @param {{_id?: unknown, id?: string, username: string, role: string}} user פרטי המשתמש שיוטמעו באסימון.
 * @returns {string} אסימון JWT חתום.
 */
function signAuthToken(user) {
  // מצרפים לאסימון פרטים הדרושים לזיהוי, ומגדירים מזהה משתמש ותוקף של שעתיים.
  return jwt.sign(
    { username: user.username, role: user.role },
    jwtSecret,
    { subject: String(user._id || user.id), expiresIn: '2h' }
  );
}

export default {
  signAuthToken,
  /**
   * מאמת אסימון JWT ומפענח את המטען החתום.
   * @param {string} token אסימון JWT לבדיקה.
   * @returns {import('jsonwebtoken').JwtPayload|string} המטען המאומת.
   * @throws {import('jsonwebtoken').JsonWebTokenError} כאשר האסימון אינו תקין.
   * @throws {import('jsonwebtoken').TokenExpiredError} כאשר האסימון פג תוקף.
   */
  // מאמת את חתימת האסימון ואת תוקפו לפני החזרת המטען למנגנון ההרשאות.
  verifyAuthToken: (token) => jwt.verify(token, jwtSecret)
};