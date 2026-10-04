
/**
 * מחזיר תגובת JSON עבור שגיאות Express שלא טופלו קודם.
 * @param {Error} err השגיאה שהועברה בשרשרת.
 * @param {import('express').Request} req בקשת HTTP המקורית.
 * @param {import('express').Response} res תגובת HTTP.
 * @param {import('express').NextFunction} next פונקציית middleware להמשך שרשרת העיבוד.
 * @returns {void} שולח את פרטי השגיאה בתגובה.
 */
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    error: err.message || 'שגיאה פנימית בשרת'
  });
};

module.exports = errorHandler;