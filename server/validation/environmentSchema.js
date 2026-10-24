import Joi from 'joi';

const environmentSchema = Joi.object({
  MONGO_URI: Joi.string().trim().min(1).required(),
  JWT_SECRET: Joi.string().trim().min(32).required(),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  APP_URL: Joi.string().uri({ scheme: ['http', 'https'] }).allow('').default('http://localhost:3000'),
  EMAIL_USER: Joi.string().email().allow(''),
  EMAIL_PASS: Joi.string().allow(''),
  GEMINI_API_KEY: Joi.string().allow('')
}).custom((value, helpers) => {
  if (Boolean(value.EMAIL_USER) !== Boolean(value.EMAIL_PASS)) {
    return helpers.error('environment.emailCredentials');
  }
  return value;
}).messages({
  'environment.emailCredentials': 'EMAIL_USER and EMAIL_PASS must either both be set or both be empty'
}).unknown(true);

export default environmentSchema;
