import '../config/env.js';
import jwt from 'jsonwebtoken';


const jwtSecret = process.env.JWT_SECRET;

/**
 * חותם אסימון JWT למשתמש עם מזהה, שם, תפקיד ותוקף של שעתיים.
 * @param {{_id?: unknown, id?: string, username: string, role: string}} user פרטי המשתמש שיוטמעו באסימון.
 * @returns {string} אסימון JWT חתום.
 */
function signAuthToken(user) {
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
  verifyAuthToken: (token) => jwt.verify(token, jwtSecret)
};