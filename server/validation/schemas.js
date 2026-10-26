// Joi בונה את כללי האימות והנרמול של גוף, פרמטרים ושאילתות בבקשות.
import Joi from 'joi';


// כל שדות המשתמש עוברים ניקוי רווחים, הגבלת אורך והודעות שגיאה בעברית.
const username = Joi.string().trim().min(1).max(100).required().messages({
  'string.empty': 'יש להזין שם משתמש',
  'any.required': 'יש להזין שם משתמש'
});
// כתובת דוא"ל מנורמלת לאותיות קטנות ונדרשת להיות תקינה ומוגבלת באורכה.
const email = Joi.string().trim().email().max(254).lowercase().required().messages({
  'string.email': 'יש להזין כתובת אימייל תקינה',
  'any.required': 'יש להזין כתובת אימייל תקינה'
});
// הסיסמה אינה נחתכת, אך נדרשים לפחות שמונה תווים ומוגבל אורך הקלט.
const password = Joi.string().min(8).max(128).required().messages({
  'string.min': 'הסיסמה חייבת להכיל לפחות 8 תווים',
  'any.required': 'יש להזין סיסמה'
});
// קוד חד-פעמי חייב להכיל בדיוק שש ספרות.
const otpCode = Joi.string().trim().pattern(/^\d{6}$/).required().messages({
  'string.pattern.base': 'יש להזין קוד אימות בן 6 ספרות',
  'any.required': 'יש להזין קוד אימות בן 6 ספרות'
});
// מזהה שיחה אינו חובה, אך אם נשלח הוא מנוקה ומוגבל לאורך סביר.
const chatId = Joi.string().trim().max(100).allow('');
// פרטי הרשמה שאינם הכרחיים מוגדרים כאן כדי לשתף כללים בין תהליכי הרשמה.
const optionalSignupFields = {
  fullName: Joi.string().trim().max(150).allow(''),
  idNumber: Joi.string().pattern(/^\d{9}$/).allow('').messages({
    'string.pattern.base': 'מספר תעודת הזהות חייב להכיל 9 ספרות'
  }),
  phone: Joi.string().trim().max(30).allow(''),
  businessName: Joi.string().trim().max(150).allow('')
};
// בודק כתובת אתר גם אם נכתבה ללא פרוטוקול, בלי לשנות את הערך שנשמר בבקשה.
const websiteUrl = Joi.string().trim().max(2048).required().custom((value, helpers) => {
  try {
    // מוסיף HTTPS רק לצורך בדיקת הכתובת, ואז מוודא שהפרוטוקול והמארח תקינים.
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return helpers.error('string.uri');
    return value;
  } catch {
    // כתובת שלא ניתן לפרש מוחזרת כקלט URI לא תקין.
    return helpers.error('string.uri');
  }
}).messages({
  'string.uri': 'כתובת האתר חייבת להיות כתובת HTTP או HTTPS תקינה',
  'any.required': 'נא להזין כתובת אתר'
});

// סכמות לכל שלבי ההרשמה, ההתחברות והחלפת הסיסמה.
export const authSchemas = {
  // שליחת קוד הרשמה דורשת פרטי זיהוי בסיסיים.
  sendOtp: Joi.object({
    email,
    username
  }).unknown(true),
  // אימות ההרשמה משלב את קוד האימות, פרטי המשתמש והשדות הנוספים.
  registerVerify: Joi.object({
    ...optionalSignupFields,
    email,
    username,
    password,
    otpCode
  }).unknown(true),
  // טופס ההרשמה הרגיל כולל שם, כתובת דוא"ל וסיסמה.
  register: Joi.object({
    username,
    email,
    password
  }).unknown(true),
  // התחברות דורשת שם משתמש וסיסמה שאינה ריקה.
  login: Joi.object({
    username,
    password: Joi.string().min(1).max(128).required().messages({
      'any.required': 'יש להזין סיסמה',
      'string.empty': 'יש להזין סיסמה'
    })
  }).unknown(true),
  // שלב אימות נוסף בהתחברות משתמש בקוד שנשלח לדוא"ל.
  loginVerify: Joi.object({
    email,
    otpCode
  }).unknown(true),
  // בקשת איפוס מזהה את החשבון באמצעות שם המשתמש.
  passwordResetRequest: Joi.object({ username }).unknown(true),
  // אישור האיפוס דורש קוד תקף וסיסמה חדשה העומדת בכללי האורך.
  passwordResetConfirm: Joi.object({
    username,
    otpCode,
    password
  }).unknown(true)
};

// סכמות הודעות התמיכה קובעות נושאים, אורכים ומספר מילים סביר.
export const contactSchemas = {
  // הודעת פנייה מוגבלת לנושא מוכר ולתוכן באורך שאינו עולה על המגבלות.
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
      // מגבלת מילים נוספת נותנת הודעת שגיאה ידידותית מעבר למגבלת התווים.
      if (value.split(/\s+/).length > 200) return helpers.error('string.maxWords');
      return value;
    }).required().messages({
      'string.empty': 'יש להזין תוכן להודעה',
      'any.required': 'יש להזין תוכן להודעה',
      'string.maxWords': 'ההודעה יכולה להכיל עד 200 מילים'
    }),
    chatId: chatId.optional()
  }).unknown(true),
  // תגובת מנהל משויכת לשם משתמש, עם מזהה שיחה אופציונלי.
  reply: Joi.object({
    username,
    reply: Joi.string().trim().min(1).max(5000).required().messages({
      'string.empty': 'יש להזין תוכן לתגובה',
      'any.required': 'יש להזין תוכן לתגובה'
    }),
    chatId: chatId.optional()
  }).unknown(true)
};

// כללי קלט ליצירה, עריכה, צ'אט וזיהוי בוט.
export const botSchemas = {
  // יצירה דורשת אתר תקין ומקבלת הנחיות אופציונליות.
  create: Joi.object({
    websiteUrl,
    instructions: Joi.string().max(5000).allow('').optional()
  }).unknown(true),
  // בעדכון חייבות להישלח הנחיות, גם אם הן מחרוזת ריקה תקפה.
  update: Joi.object({
    instructions: Joi.string().max(5000).required().messages({
      'any.required': 'יש להזין הנחיות לבוט'
    })
  }).unknown(true),
  // הודעת צ'אט חייבת לכלול תוכן לא ריק באורך מוגבל.
  chat: Joi.object({
    message: Joi.string().trim().min(1).max(5000).required().messages({
      'string.empty': 'יש להזין הודעה',
      'any.required': 'יש להזין הודעה'
    })
  }).unknown(true),
  // מזהה מסד נתונים של בוט חייב להיות ObjectId הקסדצימלי בן 24 תווים.
  id: Joi.object({
    botId: Joi.string().hex().length(24).required()
  }).unknown(true),
  // ניתן לבקש מכסה של אחד מהמסלולים המוכרים בלבד.
  quota: Joi.object({
    planId: Joi.string().valid('starter', 'pro', 'business', 'enterprise').optional()
  }).unknown(true)
};

// בדיקת תשלום מגבילה מסלול, פרטי כרטיס חלקיים ואישור למחיקת בוטים.
export const paymentSchema = Joi.object({
  planId: Joi.string().valid('starter', 'pro', 'business', 'enterprise').required(),
  cardholderName: Joi.string().trim().min(1).max(100).required(),
  cardLast4: Joi.string().pattern(/^\d{4}$/).required(),
  confirmedBotCount: Joi.number().integer().min(0).default(0)
}).unknown(true).messages({
  'any.only': 'המסלול שנבחר אינו תקין',
  'string.pattern.base': 'יש להזין את ארבע הספרות האחרונות בכרטיס'
});

// סכמות לצפייה בהיסטוריית שיחות, חיפוש לקוחות ושמירת הודעה.
export const chatSchemas = {
  // מזהה משתמש נבדק לפני ביצוע אגרגציה לפי חשבון.
  userId: Joi.object({ userId: Joi.string().hex().length(24).required() }).unknown(true),
  // מזהה השיחה נדרש כדי להביא את הודעותיה.
  chatId: Joi.object({ chatId: Joi.string().trim().min(1).max(100).required() }).unknown(true),
  // שם לקוח הוא מסנן אופציונלי עבור חיפוש מנהלי.
  adminSearch: Joi.object({ clientName: Joi.string().trim().max(150).allow('').optional() }).unknown(true),
  // כל השדות הדרושים להצגת הודעה חדשה נבדקים לפני שמירה.
  createMessage: Joi.object({
    userId: Joi.string().hex().length(24).required(),
    clientName: Joi.string().trim().min(1).max(150).required(),
    chatId: Joi.string().trim().min(1).max(100).required(),
    sender: Joi.string().valid('user', 'bot').required(),
    text: Joi.string().trim().min(1).max(5000).required()
  }).unknown(true)
};

// מזהה בוט המזכירה מכיל רק אותיות לטיניות, ספרות ומקפים ונשמר ללא רווחים.
const botUrlKey = Joi.string().trim().pattern(/^[a-zA-Z0-9-]+$/).min(1).max(100);
// תאריך נדרש בפורמט ISO; הבדיקה הנוספת שוללת תאריכים לא קיימים כמו 31 בפברואר.
const dateString = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((value, helpers) => {
  // מפרקים את השנה, החודש והיום כדי לבנות תאריך להשוואה.
  const [year, month, day] = value.split('-').map(Number);
  // שנים קצרות נדחות כדי למנוע פרשנות לא צפויה של Date.
  if (year < 100) return helpers.error('date.invalid');
  // UTC מונע מהבדיקה להיות תלויה באזור הזמן המקומי של השרת.
  const date = new Date(Date.UTC(year, month - 1, day));
  // אם המרה חזרה שונה מהמקור, התאריך אינו תקין בלוח השנה.
  if (date.toISOString().slice(0, 10) !== value) return helpers.error('date.invalid');
  // משאירים את המחרוזת המקורית לאחר שעברה את בדיקות התאריך.
  return value;
}).messages({
  'string.pattern.base': 'יש להזין תאריך בפורמט YYYY-MM-DD',
  'date.invalid': 'יש להזין תאריך לועזי תקין'
});
// זמן חייב להיות בפורמט 24 שעות HH:MM, עם שעה ודקה בתוך הטווח האפשרי.
const timeString = Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/);
// כללים משותפים לשדות הגדרות המזכירה כדי לשמור התנהגות אחידה ביצירה ובעדכון.
const secretarySettings = {
  // יום החופש הוא אחד מימי השבוע; שבת מנוהלת בנפרד כחג.
  dayOff: Joi.string().valid('ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי').messages({
    'any.only': 'יש לבחור יום חופש תקין'
  }),
  // שעות פתיחה וסגירה חייבות לעמוד בתבנית השעה שנקבעה.
  openTime: timeString.messages({ 'string.pattern.base': 'יש להזין שעת פתיחה תקינה' }),
  closeTime: timeString.messages({ 'string.pattern.base': 'יש להזין שעת סגירה תקינה' }),
  // מחיר יכול להיות אפס או מספר חיובי.
  defaultPrice: Joi.number().min(0).messages({ 'number.min': 'המחיר חייב להיות אפס או יותר' }),
  // משך פגישה נמדד בדקות ונדרש להיות מספר שלם שאינו קצר מחמש דקות.
  appointmentDurationMinutes: Joi.number().integer().min(5).messages({
    'number.base': 'משך התור חייב להיות מספר שלם',
    'number.min': 'משך התור חייב להיות לפחות 5 דקות'
  }),
  // גם ההפסקה בין תורים היא מספר שלם של דקות, ומותר לה להיות אפס.
  breakDurationMinutes: Joi.number().integer().min(0).messages({
    'number.base': 'משך ההפסקה חייב להיות מספר שלם',
    'number.min': 'משך ההפסקה אינו יכול להיות שלילי'
  })
};
// מוסיף לכל סכמת שעות בדיקה ששעת הסגירה מאוחרת משעת הפתיחה.
const withValidSecretaryHours = schema => schema.custom((value, helpers) => {
  // מבצעים את בדיקת הסדר רק כאשר שתי השעות נמסרו ונבדקו.
  if (value.openTime && value.closeTime && value.openTime >= value.closeTime) {
    return helpers.error('settings.timeRange');
  }
  // מחזירים את הערכים המקוריים כדי להמשיך ולבצע את שאר בדיקות Joi.
  return value;
}).messages({
  'settings.timeRange': 'שעת הסגירה חייבת להיות מאוחרת משעת הפתיחה'
});

// סכמות הנתיבים של המזכירה כוללות קלט ציבורי, קביעת תור וניהול העסק.
export const secretarySchemas = {
  // בדיקת מזהה בוט בנתיב לפני גישה למסמך לפי מפתח זה.
  botParams: Joi.object({ botUrlKey: botUrlKey.required() }).unknown(true),
  // אסימון אישור הוא מחרוזת הקסדצימלית באורך קבוע שנוצרה בשרת.
  tokenParams: Joi.object({
    token: Joi.string().hex().length(40).required()
  }).unknown(true),
  // בהקמה נדרשים יום ושעות, בעוד מחיר ומשך מקבלים ערכי ברירת מחדל.
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
  // בעדכון ניתן לשלוח כל תת-קבוצה לא ריקה של הגדרות.
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
  // הזמנת תור דורשת פרטי קשר ותאריך/שעה תקינים; מספר הזהות אופציונלי.
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
  // בדיקת יום בודד מקבלת תאריך מחייב בפורמט ISO תקין.
  dateQuery: Joi.object({ date: dateString.required() }).unknown(true),
  // לוח חודשי דורש שנה וחודש בתחומים המספריים האפשריים.
  calendarQuery: Joi.object({
    year: Joi.number().integer().min(100).max(9999).required(),
    month: Joi.number().integer().min(1).max(12).required()
  }).unknown(true),
  // סינון לפי שנה וחודש אפשרי רק כאשר שני הערכים נשלחים יחד.
  appointmentQuery: Joi.object({
    year: Joi.number().integer().min(100).max(9999),
    month: Joi.number().integer().min(1).max(12)
  }).with('year', 'month').with('month', 'year').unknown(true),
  // בקשת חופשה דורשת תאריך והודעה קצרה מספיק לשליחה ללקוחות.
  emergencyVacation: Joi.object({
    vacationDate: dateString.required(),
    customMessage: Joi.string().trim().min(1).max(1000).required().messages({
      'string.empty': 'יש להזין הודעה',
      'string.max': 'ההודעה יכולה להכיל עד 1000 תווים'
    })
  }).unknown(true),
  // פרמטר הזמן משמש להמרה לדקות.
  timeQuery: Joi.object({ time: timeString.required() }).unknown(true),
  // מספר הדקות חייב להיות בטווח של יום אחד, מאפס ועד 23:59.
  minutesQuery: Joi.object({
    minutes: Joi.number().integer().min(0).max(1439).required()
  }).unknown(true)
};
