
/**
 * יוצר middleware המתעד שיטה, נתיב, קוד סטטוס ומשך טיפול לכל בקשה.
 * @param {string} [label='HTTP'] תווית מקור היומן.
 * @returns {import('express').RequestHandler} middleware שמודד בקשה עד אירוע הסיום.
 */
export default function createRequestLogger(label = 'HTTP') {
  /**
   * מתעד את תחילת משך הבקשה וממשיך ל-middleware הבא.
   * @param {import('express').Request} req בקשת HTTP.
   * @param {import('express').Response} res תגובת HTTP.
   * @param {import('express').NextFunction} next פונקציית middleware הבאה.
   * @returns {void} מתקין מדידת זמן וממשיך בשרשרת.
   */
  return (req, res, next) => {
    // שומרים את זמן תחילת הטיפול כדי לחשב את משך הבקשה בסיום.
    const startedAt = Date.now();
    /**
     * רושמת את פרטי הבקשה לאחר שתגובתה הסתיימה.
     * @returns {void} כותבת את מדדי הבקשה ליומן.
     */
    res.on('finish', () => {
      // אירוע finish מתרחש לאחר שנשלחה התגובה, ולכן כולל את זמן עיבודה בפועל.
      console.log(`[${label}] ${req.method} ${req.path} ${res.statusCode} ${Date.now() - startedAt}ms`);
    });
    // מאפשר לשרשרת להמשיך מיד במקום לעכב את הבקשה לצורך רישום.
    next();
  };
};