
/**
 * Creates an error that the centralized Express error handler can serialize.
 * @param {number} statusCode HTTP status code.
 * @param {string} message User-facing error message.
 * @returns {Error & {statusCode: number, publicMessage: string}} HTTP error.
 */
export default function httpError(statusCode, message, responseData = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.publicMessage = message;
  error.responseData = responseData;
  return error;
}
