
/**
 * Validates one part of an incoming request and replaces it with Joi's normalized value.
 * @param {import('joi').Schema} schema Joi schema for the selected request property.
 * @param {'body'|'params'|'query'} [property='body'] Request property to validate.
 * @returns {import('express').RequestHandler} Express validation middleware.
 */
export default function validateRequest(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      convert: true,
      stripUnknown: true
    });

    if (error) {
      error.statusCode = 400;
      error.publicMessage = error.details.map(detail => detail.message).join(', ');
      return next(error);
    }

    if (property === 'query') req.validatedQuery = value;
    else req[property] = value;
    return next();
  };
}
