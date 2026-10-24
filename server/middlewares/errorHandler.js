

/**
 * Maps request and application errors to a consistent JSON response.
 * @param {Error & {statusCode?: number, code?: string, publicMessage?: string, responseData?: object, name?: string}} error Error forwarded by Express.
 * @param {import('express').Request} req Original request.
 * @param {import('express').Response} res HTTP response.
 * @param {import('express').NextFunction} next Next Express middleware.
 * @returns {void} Sends an error response or delegates after headers are sent.
 */
export default function errorHandler(error, req, res, next) {
  // אם התגובה כבר החלה להישלח, Express צריך לקבל את השגיאה כדי למנוע כתיבה כפולה.
  if (res.headersSent) return next(error);

  // מתרגם שגיאות מוכרות לקודי HTTP מדויקים, ואת היתר לקוד שהוגדר או לשגיאת שרת.
  const statusCode = error.code === 'LIMIT_FILE_SIZE'
    ? 413
    : error.code === 11000
      ? 409
      : error.statusCode
        || (['CastError', 'ValidationError', 'SyntaxError'].includes(error.name) ? 400 : 500);
  // בוחר הודעה בטוחה ומובנת לפי סוג השגיאה, עם קדימות לשגיאות העלאה/קלט מוכרות.
  const message = error.code === 'LIMIT_FILE_SIZE'
    ? 'הקובץ גדול מדי (מקסימום 5MB)'
    : error.code === 11000
      ? 'שם המשתמש או כתובת האימייל כבר רשומים במערכת'
      : error.type === 'entity.parse.failed'
        ? 'גוף הבקשה אינו JSON תקין'
        : error.publicMessage
          || (statusCode >= 500 ? 'שגיאה פנימית בשרת' : error.message);

  // שגיאות שרת נשמרות בפרטי הלוג; התנגשויות מתועדות כאזהרה.
  if (statusCode >= 500) console.error('Server error:', error);
  else if (statusCode === 409) console.warn('Request conflict:', error.message);

  // שומר על מבנה תשובה אחיד ומוסיף נתונים ספציפיים אם צורפו לשגיאה.
  return res.status(statusCode).json({
    success: false,
    ...error.responseData,
    message
  });
}