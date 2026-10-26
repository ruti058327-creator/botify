
/**
 * Validates one part of an incoming request and replaces it with Joi's normalized value.
 * @param {import('joi').Schema} schema Joi schema for the selected request property.
 * @param {'body'|'params'|'query'} [property='body'] Request property to validate.
 * @returns {import('express').RequestHandler} Express validation middleware.
 */
export default function validateRequest(schema, property = 'body') {
  // כל בקשה עוברת בדיקה לפני הנתיב, כדי שהבקר יקבל ערכים מנורמלים בלבד.
  return (req, res, next) => {
    // Joi בודק את החלק שנבחר בבקשה, ממיר טיפוסים ומסיר שדות שאינם בסכמה.
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      convert: true,
      stripUnknown: true
    });

    // אוסף את כל שגיאות הקלט ומעביר אותן לטיפול השגיאות המרכזי כקלט לא תקין.
    if (error) {
      error.statusCode = 400;
      error.publicMessage = error.details.map(detail => detail.message).join(', ');
      return next(error);
    }

    // ערכי query נשמרים בנכס ייעודי; body ו-params מוחלפים בערכים המנורמלים.
    if (property === 'query') req.validatedQuery = value;
    else req[property] = value;
    return next();
  };
}
