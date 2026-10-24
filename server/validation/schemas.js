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
    subject: Joi.string().valid(
      'תמיכה טכנית',
      'שאלות בנושא תשלום ומנויים',
      'בקשה להתאמה אישית',
      'הצעת ייעול ומשוב',
      'אחר'
    ).default('אחר').messages({
      'any.only': 'יש לבחור נושא פנייה תקין'
    }),
    message: Joi.string().trim().min(1).max(5000).custom((value, helpers) => {
      if (value.split(/\s+/).length > 200) return helpers.error('string.maxWords');
      return value;
    }).required().messages({
      'string.empty': 'יש להזין תוכן להודעה',
      'any.required': 'יש להזין תוכן להודעה',
      'string.maxWords': 'ההודעה יכולה להכיל עד 200 מילים'
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

const botUrlKey = Joi.string().trim().pattern(/^[a-zA-Z0-9-]+$/).min(1).max(100);
const dateString = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((value, helpers) => {
  const [year, month, day] = value.split('-').map(Number);
  if (year < 100) return helpers.error('date.invalid');
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.toISOString().slice(0, 10) !== value) return helpers.error('date.invalid');
  return value;
}).messages({
  'string.pattern.base': 'יש להזין תאריך בפורמט YYYY-MM-DD',
  'date.invalid': 'יש להזין תאריך לועזי תקין'
});
const timeString = Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/);
const secretarySettings = {
  dayOff: Joi.string().valid('ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי').messages({
    'any.only': 'יש לבחור יום חופש תקין'
  }),
  openTime: timeString.messages({ 'string.pattern.base': 'יש להזין שעת פתיחה תקינה' }),
  closeTime: timeString.messages({ 'string.pattern.base': 'יש להזין שעת סגירה תקינה' }),
  defaultPrice: Joi.number().min(0).messages({ 'number.min': 'המחיר חייב להיות אפס או יותר' }),
  appointmentDurationMinutes: Joi.number().integer().min(5).messages({
    'number.base': 'משך התור חייב להיות מספר שלם',
    'number.min': 'משך התור חייב להיות לפחות 5 דקות'
  }),
  breakDurationMinutes: Joi.number().integer().min(0).messages({
    'number.base': 'משך ההפסקה חייב להיות מספר שלם',
    'number.min': 'משך ההפסקה אינו יכול להיות שלילי'
  })
};
const withValidSecretaryHours = schema => schema.custom((value, helpers) => {
  if (value.openTime && value.closeTime && value.openTime >= value.closeTime) {
    return helpers.error('settings.timeRange');
  }
  return value;
}).messages({
  'settings.timeRange': 'שעת הסגירה חייבת להיות מאוחרת משעת הפתיחה'
});

export const secretarySchemas = {
  botParams: Joi.object({ botUrlKey: botUrlKey.required() }).unknown(true),
  tokenParams: Joi.object({
    token: Joi.string().hex().length(40).required()
  }).unknown(true),
  setup: withValidSecretaryHours(Joi.object({
    botUrlKey: botUrlKey.required(),
    ...secretarySettings,
    dayOff: secretarySettings.dayOff.required(),
    openTime: secretarySettings.openTime.required(),
    closeTime: secretarySettings.closeTime.required(),
    defaultPrice: secretarySettings.defaultPrice.default(150),
    appointmentDurationMinutes: secretarySettings.appointmentDurationMinutes.default(30),
    breakDurationMinutes: secretarySettings.breakDurationMinutes.default(10)
  }).unknown(true)),
  settings: withValidSecretaryHours(Joi.object({
    botUrlKey: botUrlKey.optional(),
    ...secretarySettings
  }).min(1).or(
    'botUrlKey',
    'dayOff',
    'openTime',
    'closeTime',
    'defaultPrice',
    'appointmentDurationMinutes',
    'breakDurationMinutes'
  ).unknown(true)),
  booking: Joi.object({
    clientName: Joi.string().trim().min(1).max(150).required(),
    phone: Joi.string().trim().min(1).max(30).required(),
    email: Joi.string().trim().email().max(254).lowercase().required(),
    date: dateString.required(),
    time: timeString.required(),
    idNumber: Joi.string().pattern(/^\d{9}$/).allow('').optional().messages({
      'string.pattern.base': 'מספר תעודת הזהות חייב להכיל 9 ספרות'
    })
  }).unknown(true),
  dateQuery: Joi.object({ date: dateString.required() }).unknown(true),
  calendarQuery: Joi.object({
    year: Joi.number().integer().min(100).max(9999).required(),
    month: Joi.number().integer().min(1).max(12).required()
  }).unknown(true),
  appointmentQuery: Joi.object({
    year: Joi.number().integer().min(100).max(9999),
    month: Joi.number().integer().min(1).max(12)
  }).with('year', 'month').with('month', 'year').unknown(true),
  emergencyVacation: Joi.object({
    vacationDate: dateString.required(),
    customMessage: Joi.string().trim().min(1).max(1000).required().messages({
      'string.empty': 'יש להזין הודעה',
      'string.max': 'ההודעה יכולה להכיל עד 1000 תווים'
    })
  }).unknown(true),
  timeQuery: Joi.object({ time: timeString.required() }).unknown(true),
  minutesQuery: Joi.object({
    minutes: Joi.number().integer().min(0).max(1439).required()
  }).unknown(true)
};
