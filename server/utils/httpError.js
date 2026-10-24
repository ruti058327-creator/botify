
/**
 * Creates an error that the centralized Express error handler can serialize.
 * @param {number} statusCode HTTP status code.
 * @param {string} message User-facing error message.
 * @returns {Error & {statusCode: number, publicMessage: string}} HTTP error.
 */
export default function httpError(statusCode, message, responseData = {}) {
  // משתמשים באובייקט Error רגיל כדי להשתלב במנגנון catch של Express.
  const error = new Error(message);
  // שומרים קוד HTTP והודעה ציבורית שה-middleware המרכזי יודע להחזיר.
  error.statusCode = statusCode;
  error.publicMessage = message;
  // מאפשר לצרף קודי שגיאה או פרטים נוספים לגוף התגובה.
  error.responseData = responseData;
  return error;
}
