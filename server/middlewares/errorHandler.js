

/**
 * Maps request and application errors to a consistent JSON response.
 * @param {Error & {statusCode?: number, code?: string, publicMessage?: string, responseData?: object, name?: string}} error Error forwarded by Express.
 * @param {import('express').Request} req Original request.
 * @param {import('express').Response} res HTTP response.
 * @param {import('express').NextFunction} next Next Express middleware.
 * @returns {void} Sends an error response or delegates after headers are sent.
 */
export default function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const statusCode = error.code === 'LIMIT_FILE_SIZE'
    ? 413
    : error.code === 11000
      ? 409
      : error.statusCode
        || (['CastError', 'ValidationError', 'SyntaxError'].includes(error.name) ? 400 : 500);
  const message = error.code === 'LIMIT_FILE_SIZE'
    ? 'הקובץ גדול מדי (מקסימום 5MB)'
    : error.code === 11000
      ? 'שם המשתמש או כתובת האימייל כבר רשומים במערכת'
      : error.type === 'entity.parse.failed'
        ? 'גוף הבקשה אינו JSON תקין'
        : error.publicMessage
          || (statusCode >= 500 ? 'שגיאה פנימית בשרת' : error.message);

  if (statusCode >= 500) console.error('Server error:', error);
  else if (statusCode === 409) console.warn('Request conflict:', error.message);

  return res.status(statusCode).json({
    success: false,
    ...error.responseData,
    message
  });
}