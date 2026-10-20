import Joi from 'joi';


const username = Joi.string().trim().min(1).max(100).required().messages({
  'string.empty': 'יש להזין שם משתמש',
  'any.required': 'יש להזין שם משתמש'
});
const email = Joi.string().trim().email().max(254).lowercase().required().messages({
  'string.email': 'יש להזין כתובת אימייל תקינה',
  'any.required': 'יש להזין כתובת אימייל תקינה'
});
const password = Joi.string().min(8).max(128).required().messages({
  'string.min': 'הסיסמה חייבת להכיל לפחות 8 תווים',
  'any.required': 'יש להזין סיסמה'
});
const otpCode = Joi.string().trim().pattern(/^\d{6}$/).required().messages({
  'string.pattern.base': 'יש להזין קוד אימות בן 6 ספרות',
  'any.required': 'יש להזין קוד אימות בן 6 ספרות'
});
const chatId = Joi.string().trim().max(100).allow('');
const optionalSignupFields = {
  fullName: Joi.string().trim().max(150).allow(''),
  idNumber: Joi.string().pattern(/^\d{9}$/).allow('').messages({
    'string.pattern.base': 'מספר תעודת הזהות חייב להכיל 9 ספרות'
  }),
  phone: Joi.string().trim().max(30).allow(''),
  businessName: Joi.string().trim().max(150).allow('')
};
const websiteUrl = Joi.string().trim().max(2048).required().custom((value, helpers) => {
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return helpers.error('string.uri');
    return value;
  } catch {
    return helpers.error('string.uri');
  }
}).messages({
  'string.uri': 'כתובת האתר חייבת להיות כתובת HTTP או HTTPS תקינה',
  'any.required': 'נא להזין כתובת אתר'
});

export const authSchemas = {
  sendOtp: Joi.object({
    email,
    username
  }).unknown(true),
  registerVerify: Joi.object({
    ...optionalSignupFields,
    email,
    username,
    password,
    otpCode
  }).unknown(true),
  register: Joi.object({
    username,
    email,
    password
  }).unknown(true),
  login: Joi.object({
    username,
    password: Joi.string().min(1).max(128).required().messages({
      'any.required': 'יש להזין סיסמה',
      'string.empty': 'יש להזין סיסמה'
    })
  }).unknown(true),
  loginVerify: Joi.object({
    email,
    otpCode
  }).unknown(true),
  passwordResetRequest: Joi.object({ username }).unknown(true),
  passwordResetConfirm: Joi.object({
    username,
    otpCode,
    password
  }).unknown(true)
};

export const contactSchemas = {
  create: Joi.object({
    message: Joi.string().trim().min(1).max(5000).required().messages({
      'string.empty': 'יש להזין תוכן להודעה',
      'any.required': 'יש להזין תוכן להודעה'
    }),
    chatId: chatId.optional()
  }).unknown(true),
  reply: Joi.object({
    username,
    reply: Joi.string().trim().min(1).max(5000).required().messages({
      'string.empty': 'יש להזין תוכן לתגובה',
      'any.required': 'יש להזין תוכן לתגובה'
    }),
    chatId: chatId.optional()
  }).unknown(true)
};

export const botSchemas = {
  create: Joi.object({
    websiteUrl,
    instructions: Joi.string().max(5000).allow('').optional()
  }).unknown(true),
  update: Joi.object({
    instructions: Joi.string().max(5000).required().messages({
      'any.required': 'יש להזין הנחיות לבוט'
    })
  }).unknown(true),
  chat: Joi.object({
    message: Joi.string().trim().min(1).max(5000).required().messages({
      'string.empty': 'יש להזין הודעה',
      'any.required': 'יש להזין הודעה'
    })
  }).unknown(true),
  id: Joi.object({
    botId: Joi.string().hex().length(24).required()
  }).unknown(true),
  quota: Joi.object({
    planId: Joi.string().valid('starter', 'pro', 'business', 'enterprise').optional()
  }).unknown(true)
};

export const paymentSchema = Joi.object({
  planId: Joi.string().valid('starter', 'pro', 'business', 'enterprise').required(),
  cardholderName: Joi.string().trim().min(1).max(100).required(),
  cardLast4: Joi.string().pattern(/^\d{4}$/).required(),
  confirmedBotCount: Joi.number().integer().min(0).default(0)
}).unknown(true).messages({
  'any.only': 'המסלול שנבחר אינו תקין',
  'string.pattern.base': 'יש להזין את ארבע הספרות האחרונות בכרטיס'
});

export const chatSchemas = {
  userId: Joi.object({ userId: Joi.string().hex().length(24).required() }).unknown(true),
  chatId: Joi.object({ chatId: Joi.string().trim().min(1).max(100).required() }).unknown(true),
  adminSearch: Joi.object({ clientName: Joi.string().trim().max(150).allow('').optional() }).unknown(true),
  createMessage: Joi.object({
    userId: Joi.string().hex().length(24).required(),
    clientName: Joi.string().trim().min(1).max(150).required(),
    chatId: Joi.string().trim().min(1).max(100).required(),
    sender: Joi.string().valid('user', 'bot').required(),
    text: Joi.string().trim().min(1).max(5000).required()
  }).unknown(true)
};
