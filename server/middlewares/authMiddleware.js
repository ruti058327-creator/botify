const { verifyAuthToken } = require('../utils/jwt');

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

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'אין הרשאה לבצע פעולה זו' });
  }
  return next();
}

module.exports = { authenticateToken, requireAdmin };