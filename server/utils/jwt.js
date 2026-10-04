const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET is not configured; login tokens will be invalidated when the server restarts.');
}

function signAuthToken(user) {
  return jwt.sign(
    { username: user.username, role: user.role },
    jwtSecret,
    { subject: String(user._id || user.id), expiresIn: '2h' }
  );
}

module.exports = { signAuthToken, verifyAuthToken: (token) => jwt.verify(token, jwtSecret) };