// טוען את משתני הסביבה לפני ששאר הקובץ קורא אותם, למשל את פרטי שרת הדוא"ל.
import '../config/env.js';
// מייבא את מודול ההצפנה המובנה של Node.js; בהמשך נשתמש ביצירת קודים ובהשוואת סיסמאות.
import __cjsImport0 from 'node:crypto';
// מייבא את מודל המנהלים ממסד הנתונים, בנפרד ממודל המשתמשים הרגילים.
import Administrator from '../models/Administrator.js';
// מייבא את מודל המשתמשים, שמאפשר לחפש, ליצור ולעדכן משתמשים במסד הנתונים.
import User from '../models/User.js';
// מייבא את כלי יצירת אסימון ההתחברות (JWT) המשמש לזיהוי המשתמש לאחר התחברות.
import __cjsImport1 from '../utils/jwt.js';
// מייבא פונקציה שיוצרת שגיאת HTTP עם קוד סטטוס והודעה מתאימים.
import httpError from '../utils/httpError.js';
// מייבא פונקציה לשליחת הודעות דוא"ל, למשל עם קוד אימות חד-פעמי.
import { sendEmail } from '../utils/mailer.js';

// שולף ממודול ההצפנה יצירת מספר אקראי והשוואה בטוחה שאינה חושפת מידע דרך זמן הביצוע.
const { randomInt, timingSafeEqual } = __cjsImport0;
// שולף את הפונקציה שמייצרת אסימון התחברות מתוך מודול ה-JWT.
const { signAuthToken } = __cjsImport1;

// שומר בזיכרון קודי אימות של התחברות; מפתח הרשומה הוא כתובת הדוא"ל.
const loginOtpStore = new Map();
// שומר בזיכרון קודי אימות שנשלחו בתהליך ההרשמה.
const registrationOtpStore = new Map();
// שומר בזיכרון קודי איפוס סיסמה, מועדי תפוגה ומספר ניסיונות שגויים.
const passwordResetStore = new Map();

/**
 * מאתר משתמש לפי שם משתמש ללא תלות באותיות רישיות, תוך התייחסות בטוחה לתווים מיוחדים.
 * @param {string} username שם המשתמש לחיפוש.
 * @returns {Promise<import('mongoose').HydratedDocument<object>|null>} המשתמש שנמצא או {@code null}.
 */
// מקבל שם משתמש ומחזיר את המשתמש המתאים ממסד הנתונים, או null אם לא נמצא.
const findUserByUsername = (username) => {
  // מגן על תווים בעלי משמעות בביטוי רגולרי כדי שיחופשו כתווים רגילים בשם עצמו.
  const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // מחפש התאמה מלאה לשם המשתמש, ללא תלות באותיות גדולות או קטנות.
  return User.findOne({ username: new RegExp(`^${escapedUsername}$`, 'i') });
};

/**
 * מאתר משתמש לפי כתובת דוא״ל ללא תלות באותיות רישיות.
 * @param {string} email כתובת הדוא״ל לחיפוש.
 * @returns {Promise<import('mongoose').HydratedDocument<object>|null>} המשתמש שנמצא או {@code null}.
 */
// מקבל כתובת דוא"ל ומחזיר את המשתמש שלה, בלי להבחין בין אותיות גדולות לקטנות.
const findUserByEmail = (email) => {
  // בורח מתווים מיוחדים כדי שכתובת הדוא"ל תפורש כטקסט ולא כתבנית רגולרית.
  const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // מחפש התאמה מלאה לכתובת הדוא"ל, עם אפשרות להבדלים ברישיות.
  return User.findOne({ email: new RegExp(`^${escapedEmail}$`, 'i') });
};

/**
 * בודק שכתובת הדוא״ל ושם המשתמש זמינים ושולח קוד חד-פעמי להרשמה.
 * @param {import('express').Request} req בקשת ההרשמה.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} תשובת הצלחה או שגיאה.
 */
// מטפל בבקשה לשליחת קוד אימות לפני השלמת הרשמה.
async function sendRegistrationOtp(req, res) {
  // שולף מתוך גוף הבקשה את כתובת הדוא"ל ואת שם המשתמש שהלקוח שלח.
  const { email, username } = req.body;

  // בודק אם כבר קיים משתמש עם אותו דוא"ל או שם משתמש.
  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  // אם אחד מהם תפוס, מחזיר שגיאת התנגשות במקום לשלוח קוד הרשמה.
  if (existingUser) {
    throw httpError(409, 'שם המשתמש או כתובת האימייל כבר רשומים במערכת');
  }
  // בלי פרטי התחברות לשירות הדוא"ל אין אפשרות למסור את קוד האימות.
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw httpError(503, 'שירות שליחת קוד האימות אינו זמין כרגע');
  }

  // יוצר מספר אקראי בן שש ספרות וממיר אותו למחרוזת כדי להשוותו לקוד מהבקשה.
  const otpCode = randomInt(100000, 1000000).toString();
  // שומר את הקוד תחת כתובת הדוא"ל, עם תאריך תפוגה של חמש דקות מעכשיו.
  registrationOtpStore.set(email, { otpCode, expires: Date.now() + 5 * 60 * 1000 });
  // שולח למשתמש הודעה עם הקוד; תוכן ה-HTML הוא גוף ההודעה שמוצג בתיבת הדוא"ל.
  await sendEmail({
    // מגדיר לאיזו כתובת לשלוח את הודעת האימות.
    to: email,
    // מגדיר את שורת הנושא שתופיע בהודעה.
    subject: 'קוד אימות להרשמה - Botify',
    // בונה את גוף הודעת הדוא"ל ב-HTML, כולל שם המשתמש, הקוד ומשך תוקפו.
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;padding:25px;max-width:500px;margin:auto"><h2>ברוכים הבאים ל-Botify!</h2><p>שלום <strong>${username}</strong>, קוד האימות שלך הוא:</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px;text-align:center">${otpCode}</p><p>הקוד בתוקף ל-5 דקות בלבד.</p></div>`
  });
  // מחזיר ללקוח תשובת JSON שמציינת שהקוד נשלח בהצלחה.
  return res.json({ success: true, message: 'קוד האימות נשלח בהצלחה לתיבת המייל!' });
}

/**
 * מאמת קוד הרשמה ושומר את חשבון המשתמש החדש.
 * @param {import('express').Request} req בקשה עם פרטי המשתמש וקוד האימות.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} תשובת הצלחה או שגיאה.
 */
// מאמת את הקוד שנשלח בהרשמה, יוצר חשבון חדש ומסיר את הקוד מהזיכרון.
async function registerVerify(req, res) {
  // אוסף את פרטי המשתמש ואת הקוד שהלקוח הזין מתוך גוף הבקשה.
  const { fullName, idNumber, email, phone, businessName, username, password, otpCode } = req.body;
  // מחפש בזיכרון את קוד האימות ששויך לכתובת הדוא"ל הזו.
  const storedData = registrationOtpStore.get(email);

  // בודק אם לא נשמר קוד מתאים או אם חמש הדקות שלו כבר עברו.
  if (!storedData || Date.now() > storedData.expires) {
    // מוחק קוד שפג תוקפו כדי שלא יישאר בזיכרון ללא צורך.
    registrationOtpStore.delete(email);
    // עוצר את ההרשמה ומחזיר שגיאה שמבקשת לבקש קוד חדש.
    throw httpError(400, 'קוד האימות אינו תקף או שפג תוקפו. נא לבקש קוד חדש.');
  }
  // משווה את הקוד שהמשתמש הזין לקוד המקורי שנשמר עבורו.
  if (storedData.otpCode !== otpCode) {
    // אם הקוד שגוי, ההרשמה לא מתבצעת והלקוח מקבל הודעה מתאימה.
    throw httpError(400, 'קוד האימות שהזנת שגוי.');
  }

  // יוצר מסמך משתמש עם הנתונים שנמסרו ומגדיר את החשבון כמשתמש רגיל.
  const newUser = new User({ fullName, idNumber, email, phone, businessName, username, password, role: 'user' });
  // שומר את מסמך המשתמש החדש במסד הנתונים.
  await newUser.save();
  // מוחק את הקוד לאחר שימוש מוצלח כדי שלא יהיה ניתן להשתמש בו שוב.
  registrationOtpStore.delete(email);
  // מחזיר HTTP 201, המציין שהמשתמש נוצר בהצלחה.
  return res.status(201).json({ success: true, message: 'ההרשמה הושלמה בהצלחה!' });
}

/**
 * יוצר חשבון משתמש באמצעות הרשמה בסיסית ללא שלב אימות קוד.
 * @param {import('express').Request} req בקשה עם שם משתמש, דוא״ל וסיסמה.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} תשובת הצלחה או שגיאה.
 */
// מסלול הרשמה פשוט שיוצר משתמש ישירות בלי אימות קוד חד-פעמי.
async function register(req, res) {
  // קורא את שלושת פרטי ההרשמה הבסיסיים שנשלחו בבקשה.
  const { username, email, password } = req.body;

  // בודק אם כתובת הדוא"ל או שם המשתמש כבר משויכים לחשבון קיים.
  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  // אם נמצאה כפילות, מסיים את הבקשה עם HTTP 409.
  if (existingUser) throw httpError(409, 'שם המשתמש או האימייל כבר רשומים במערכת');
  // יוצר ושומר משתמש חדש, עם תפקיד רגיל, במסד הנתונים.
  await new User({ username, email, password, role: 'user' }).save();
  // מחזיר ללקוח HTTP 201 והודעה שההרשמה הושלמה.
  return res.status(201).json({ success: true, message: 'ההרשמה בוצעה בהצלחה!' });
}

/**
 * מבקש קוד איפוס סיסמה ושולח אותו לכתובת המשויכת לשם המשתמש.
 * @param {import('express').Request} req בקשה המכילה שם משתמש.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} תשובה אחידה למניעת חשיפת קיום חשבון.
 */
// מתחיל איפוס סיסמה: מחפש משתמש, יוצר קוד ושולח אותו, בלי לחשוף אם החשבון קיים.
async function requestPasswordReset(req, res) {
  // קורא את שם המשתמש שנמסר בבקשת איפוס הסיסמה.
  const { username } = req.body;
  // בודק מראש אם שירות הדוא"ל מוגדר, לפני ניסיון לשלוח הודעה.
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw httpError(503, 'שירות שליחת האימייל אינו זמין כרגע');
  }

  // מחפש משתמש לפי שם משתמש, בלי הבדל בין אותיות גדולות לקטנות.
  const user = await findUserByUsername(username);
  // מתחיל בערך ריק; אם משתמש יימצא, הערך ישמש למסירת כתובת מוסתרת חלקית.
  let maskedEmail = '';
  // ממשיך ביצירת הקוד ושליחתו רק כאשר נמצא חשבון מתאים.
  if (user) {
    // יוצר קוד אקראי בן שש ספרות עבור תהליך איפוס הסיסמה.
    const otpCode = randomInt(100000, 1000000).toString();
    // יוצר מפתח אחיד למפה על ידי המרת שם המשתמש לאותיות קטנות.
    const resetKey = user.username.toLowerCase();
    // מפריד את כתובת הדוא"ל לחלק שלפני @ ולחלק שאחריו.
    const [emailName, emailDomain] = user.email.split('@');
    // מסתיר את רוב שם תיבת הדוא"ל, ומשאיר שלוש אותיות אחרונות ואת הדומיין.
    maskedEmail = `${'*'.repeat(Math.max(1, emailName.length - 3))}${emailName.slice(-3)}@${emailDomain}`;
    // שומר את הקוד, תוקפו וחישוב ניסיונות שגויים תחת המפתח של המשתמש.
    passwordResetStore.set(resetKey, { otpCode, expires: Date.now() + 5 * 60 * 1000, attempts: 0 });
    // מנסה לשלוח את הקוד; במקרה של כשל מסירים את הקוד ושומרים על שגיאת השליחה.
    try {
      // מעביר לשירות הדוא"ל את הכתובת, הנושא ותוכן ההודעה.
      await sendEmail({
        // שולח את הקוד לכתובת האמיתית ששמורה בחשבון.
        to: user.email,
        // מגדיר נושא המבהיר שמדובר בקוד לאיפוס סיסמה.
        subject: 'קוד לאיפוס סיסמה - Botify',
        // גוף ההודעה מסביר את מטרת הקוד, תוקפו ומה לעשות אם לא התבקש איפוס.
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;padding:25px;max-width:500px;margin:auto"><h2>איפוס סיסמה ל-Botify</h2><p>קוד האימות שלך הוא:</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px;text-align:center">${otpCode}</p><p>הקוד בתוקף ל-5 דקות בלבד.</p><p>אם לא ביקשת לאפס את הסיסמה, אפשר להתעלם מהודעה זו.</p></div>`
      });
    } catch (error) {
      // מבטל את הקוד שנשמר, כי המשתמש לא קיבל אותו בדוא"ל.
      passwordResetStore.delete(resetKey);
      // מעביר את השגיאה למנגנון הטיפול המרכזי במקום להסתיר את כשל השליחה.
      throw error;
    }
  }
  // מחזיר תשובה גם אם המשתמש לא נמצא, כדי לא לאפשר לנחש אילו שמות משתמש רשומים.
  return res.json({
    // מציין שהתהליך התקבל; ההודעה משתנה רק כאשר יש כתובת מוסתרת להציג.
    success: true,
    // אם נמצא משתמש, מציג כתובת חלקית; אחרת נותן תשובה כללית וזהה מבחינת הצלחה.
    message: maskedEmail ? `קוד אימות נשלח לכתובת המייל ${maskedEmail}. הזינו את הקוד כדי ליצור סיסמה חדשה.` : 'אם שם המשתמש קיים, נשלח קוד אימות לכתובת המייל המשויכת לחשבון.',
    // מוסיף את הכתובת המוסתרת כשיש כזו; אחרת מחזיר undefined והשדה לא ייכלל ב-JSON.
    maskedEmail: maskedEmail || undefined
  });
}

/**
 * מאמת קוד איפוס ומחליף את סיסמת המשתמש.
 * @param {import('express').Request} req בקשה המכילה שם משתמש, קוד וסיסמה חדשה.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} תשובת הצלחה או שגיאה.
 */
// בודק קוד איפוס תקף, משנה את סיסמת המשתמש ומוחק את הקוד לאחר השימוש.
async function confirmPasswordReset(req, res) {
  // קורא את שם המשתמש מתוך גוף הבקשה.
  const { username } = req.body;
  // קורא בנפרד את קוד האימות ואת הסיסמה החדשה שנשלחו.
  const { otpCode, password } = req.body;

  // מפיק מפתח עקבי למפה גם אם שם המשתמש נשלח באותיות גדולות.
  const resetKey = username.toLowerCase();
  // מאתר את פרטי קוד האיפוס שנשמרו קודם עבור שם המשתמש הזה.
  const resetData = passwordResetStore.get(resetKey);
  // בודק אם אין קוד או אם הזמן שהוקצה לו הסתיים.
  if (!resetData || Date.now() > resetData.expires) {
    // מסיר קוד שאינו תקף כדי למנוע שימוש בו בהמשך.
    passwordResetStore.delete(resetKey);
    // מסיים את הבקשה עם הודעה שמבקשת להתחיל מחדש את תהליך האיפוס.
    throw httpError(400, 'קוד האיפוס אינו תקף או שפג תוקפו. בקשו קוד חדש.');
  }
  // בודק אם הקוד שהוזן אינו הקוד שנשמר עבור המשתמש.
  if (resetData.otpCode !== otpCode) {
    // מגדיל את מספר הניסיונות השגויים של קוד האיפוס הזה.
    resetData.attempts += 1;
    // לאחר חמישה ניסיונות שגויים מוחק את הקוד ומחייב בקשה של קוד חדש.
    if (resetData.attempts >= 5) passwordResetStore.delete(resetKey);
    // מחזיר שגיאה כדי שהלקוח ידע שהקוד לא אומת.
    throw httpError(400, 'קוד האיפוס שגוי או שפג תוקפו');
  }

  // מאתר שוב את המשתמש במסד הנתונים לפני שינוי הסיסמה.
  const user = await findUserByUsername(username);
  // אם המשתמש כבר לא קיים, הקוד נמחק ולא מבצעים שינוי.
  if (!user) {
    passwordResetStore.delete(resetKey);
    throw httpError(400, 'קוד האיפוס אינו תקף או שפג תוקפו');
  }
  // מעדכן את שדה הסיסמה; מנגנון המודל שומר את הערך המעודכן במסד הנתונים.
  user.password = password;
  // שומר במסד הנתונים את הסיסמה החדשה של המשתמש.
  await user.save();
  // מבטל את קוד האיפוס לאחר הצלחה כדי למנוע שימוש חוזר.
  passwordResetStore.delete(resetKey);
  // מדווח ללקוח שהסיסמה עודכנה בהצלחה.
  return res.json({ success: true, message: 'הסיסמה עודכנה בהצלחה' });
}

/**
 * מאמת פרטי התחברות ושולח קוד OTP למשתמשים הנדרשים לאימות דו-שלבי.
 * @param {import('express').Request} req בקשה המכילה שם משתמש וסיסמה.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} פרטי משתמש/דרישת OTP או תשובת שגיאה.
 */
// בודק התחברות; מנהלים נכנסים במסלול ייעודי, ומשתמשים רגילים נדרשים גם לקוד במייל.
async function login(req, res) {
  // שולף את שם המשתמש/דוא"ל ואת הסיסמה שהלקוח שלח.
  const { username, password } = req.body;

  // מנרמל את שם המשתמש של מנהל לאותיות גדולות לצורך עיבוד אחיד.
  const adminUsername = username.trim().toUpperCase();
  // מחפש מנהל במסד הנתונים; בשאילתה שם המשתמש נשמר באותיות קטנות.
  const administrator = await Administrator.findOne({ username: adminUsername.toLowerCase() });
  // אם נמצא מנהל, מבצעים את אימותו לפי הסיסמה המוגדרת בסביבת השרת.
  if (administrator) {
    // קורא את סיסמת המנהל הסודית ממשתני הסביבה של השרת.
    const configuredPassword = process.env.ADMIN_PASSWORD;
    // אם הסיסמה לא הוגדרה, אי אפשר לאמת מנהל ולכן מדווחים על תצורת שרת חסרה.
    if (!configuredPassword) {
      throw httpError(503, 'התחברות מנהלים לא הוגדרה בשרת');
    }

    // מסיר רווחים מתחילת/סוף הסיסמה שהוזנה וממיר אותה לבתים להשוואה.
    const providedPasswordBuffer = Buffer.from(password.trim());
    // ממיר גם את הסיסמה המוגדרת בשרת לבתים, כדי להשוות באותו פורמט.
    const configuredPasswordBuffer = Buffer.from(configuredPassword);
    // תחילה בודק שאורכי הערכים זהים; נדרש כדי שההשוואה הבטוחה לא תזרוק חריגה.
    if (
      // אם האורכים שונים, הסיסמאות בהכרח שונות.
      providedPasswordBuffer.length !== configuredPasswordBuffer.length
      // אם האורכים זהים, משווה את הבתים בלי תזמון שתלוי בתו הראשון השונה.
      || !timingSafeEqual(providedPasswordBuffer, configuredPasswordBuffer)
    ) {
      // פרטי מנהל שגויים מקבלים הודעת שגיאה כללית שאינה חושפת איזה שדה שגוי.
      throw httpError(400, 'שם משתמש או סיסמה שגויים');
    }

    // יוצר אובייקט פרטי מנהל שישמש בתשובת ההתחברות ובתוך אסימון ההזדהות.
    const adminUser = {
      // מזהה הרשומה במסד הנתונים; Mongoose משתמש ב-_id כמזהה המסמך.
      id: administrator._id,
      // מציג את שם המנהל באותיות גדולות בתשובת השרת.
      username: administrator.username.toUpperCase(),
      // מסמן את זהות המשתמש כבעלת הרשאת מנהל.
      role: 'admin'
    };
    // מחזיר התחברות מוצלחת של מנהל, אסימון ונתיב שאליו הממשק יעבור.
    return res.json({
      // מציין שהאימות הצליח.
      success: true,
      // מוסר ללקוח פרטי מנהל בסיסיים ללא סיסמה.
      user: adminUser,
      // יוצר אסימון JWT באמצעות פרטי המנהל כדי לאפשר בקשות מאומתות בהמשך.
      token: signAuthToken(adminUser),
      // מורה לממשק לפתוח את דף הניהול לאחר ההתחברות.
      redirectUrl: '/admin.html'
    });
  }

  // אם שם ההתחברות מכיל @, מתייחסים אליו כאל דוא"ל ומאחדים את האותיות הקטנות.
  const loginIdentifier = username.includes('@') ? username.toLowerCase() : username;
  // מחפש משתמש רגיל לפי שם משתמש או לפי כתובת דוא"ל.
  const user = await User.findOne({ $or: [{ username: loginIdentifier }, { email: loginIdentifier }] });
  // נכשל אם המשתמש לא נמצא או אם פונקציית המודל קבעה שהסיסמה אינה תואמת.
  if (!user || !(await User.comparePassword(password, user.password))) {
    // קובע הודעת שגיאה וקוד סטטוס לפי השאלה אם החשבון נמצא.
    throw httpError(
      // חשבון שלא נמצא מחזיר 404; סיסמה שגויה לחשבון קיים מחזירה 400.
      user ? 400 : 404,
      // משתמש קיים מקבל שגיאת פרטי התחברות, ואחרת הודעה על משתמש לא קיים.
      user ? 'שם משתמש או סיסמה שגויים' : 'שם משתמש או אימייל אינם קיימים במערכת',
      // רק כאשר החשבון לא נמצא מצרפים הוראה לממשק להעביר למסך ההרשמה.
      user ? {} : { redirectUrl: '/register.html' }
    );
  }
  // לפני שליחת קוד למשתמש רגיל, מוודאים ששירות הדוא"ל מוגדר בשרת.
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw httpError(503, 'שירות שליחת קוד האימות אינו זמין כרגע');
  }

  // יוצר קוד אימות חדש בן שש ספרות עבור שלב האימות הנוסף.
  const otpCode = randomInt(100000, 1000000).toString();
  // משתמש בכתובת דוא"ל באותיות קטנות כמפתח אחיד לרשומת הקוד.
  const otpKey = user.email.toLowerCase();
  // שומר את הקוד, זמן תפוגה של חמש דקות ומונה ניסיונות שגויים.
  loginOtpStore.set(otpKey, { otpCode, expires: Date.now() + 5 * 60 * 1000, attempts: 0 });

  // אם שליחת ההודעה נכשלת, מנקים את הקוד ומשאירים לשגיאה לעלות למטפל הכללי.
  try {
    // שולח את קוד האימות לכתובת הדוא"ל של המשתמש.
    await sendEmail({
      // כתובת היעד היא הכתובת ששמורה בחשבון שנמצא.
      to: user.email,
      // קובע נושא ברור להודעת האימות של ההתחברות.
      subject: 'קוד אימות התחברות - Botify',
      // גוף ההודעה הוא תבנית HTML מעוצבת הכוללת את שם המשתמש ואת קוד האימות.
      html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 500px; margin: auto; background-color: #ffffff;">
            <h2 style="color: #2563eb; text-align: center;">אימות התחברות ל-Botify</h2>
            <p style="color: #334155;">שלום <strong>${user.username}</strong>,</p>
            <p style="color: #334155;">קוד האימות שלך לכניסה למערכת הוא:</p>
            <div style="text-align: center; margin: 30px 0;"><span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; background: #eff6ff; color: #1d4ed8; padding: 12px 28px; border-radius: 8px; border: 2px dashed #3b82f6; display: inline-block;">${otpCode}</span></div>
            <p style="color: #dc2626; font-weight: bold; text-align: center;">הקוד בתוקף ל-5 דקות בלבד.</p>
          </div>
      `
    });
  } catch (error) {
    // מסיר את הקוד שנוצר, כי בלעדי קבלת הדוא"ל המשתמש לא יוכל לאמת אותו.
    loginOtpStore.delete(otpKey);
    // מעביר הלאה את השגיאה המקורית כדי שהשרת ידווח על כשל ולא יצליח לכאורה.
    throw error;
  }

  // מודיע ללקוח שהסיסמה אומתה וכעת נדרש קוד שנשלח בדוא"ל להשלמת ההתחברות.
  return res.json({
    // הבקשה הצליחה להגיע לשלב האימות הבא.
    success: true,
    // מסמן לצד הלקוח שעליו להציג שדה להזנת קוד חד-פעמי.
    requireOtp: true,
    // מוסר לממשק את הכתובת שאליה נשלח הקוד.
    email: user.email,
    // הודעה שתוצג למשתמש לאחר שליחת קוד האימות.
    message: 'קוד אימות נשלח לכתובת המייל המקושרת לחשבון'
  });
}

/**
 * מאמת קוד OTP להתחברות ומחזיר פרופיל משתמש ואסימון גישה.
 * @param {import('express').Request} req בקשה המכילה דוא״ל וקוד חד-פעמי.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} פרופיל המשתמש ואסימון או תשובת שגיאה.
 */
// מסיים את ההתחברות של משתמש רגיל לאחר שהזין את קוד האימות שנשלח למייל.
async function loginVerify(req, res) {
  // קורא את כתובת הדוא"ל ואת הקוד החד-פעמי שהמשתמש שלח.
  const { email, otpCode } = req.body;
  // מאתר בזיכרון את הקוד שנשמר עבור כתובת הדוא"ל הזו.
  const storedData = loginOtpStore.get(email);

  // בודק אם הקוד לא קיים או אם פג תוקפו לאחר חמש דקות.
  if (!storedData || Date.now() > storedData.expires) {
    // מוחק רשומה שאינה תקפה כדי שלא תישאר במפה.
    loginOtpStore.delete(email);
    // מחזיר שגיאה שמבקשת להתחבר מחדש ולבקש קוד חדש.
    throw httpError(400, 'קוד האימות אינו תקף או שפג תוקפו. נא להתחבר מחדש.');
  }

  // משווה את הקוד שהוזן לקוד השמור עבור ההתחברות הזו.
  if (storedData.otpCode !== otpCode) {
    // רושם ניסיון שגוי נוסף כדי להגביל ניחושים.
    storedData.attempts += 1;
    // לאחר חמישה ניסיונות שגויים הקוד מוסר, ועל המשתמש להתחיל מחדש.
    if (storedData.attempts >= 5) loginOtpStore.delete(email);
    // עוצר את האימות ומודיע שהקוד שגוי.
    throw httpError(400, 'קוד האימות שגוי');
  }

  // בודק במסד הנתונים שהמשתמש ששייך לכתובת עדיין קיים.
  const user = await findUserByEmail(email);
  // אם הרשומה אינה קיימת, מנקים את הקוד ומחזירים שגיאת משתמש לא נמצא.
  if (!user) {
    loginOtpStore.delete(email);
    throw httpError(404, 'המשתמש לא נמצא');
  }

  // הקוד אומת בהצלחה, ולכן מוחקים אותו כדי למנוע שימוש חוזר.
  loginOtpStore.delete(email);
  // בונה מידע בטוח להצגה בממשק, עם ערכי ברירת מחדל לשדות שאינם מוגדרים.
  const userProfile = {
    // מזהה המשתמש ממסד הנתונים.
    id: user._id,
    // מציג שם מלא, ואם הוא חסר משתמש בשם המשתמש כשם חלופי.
    fullName: user.fullName || user.username,
    // שם המשתמש בחשבון.
    username: user.username,
    // כתובת הדוא"ל המקושרת לחשבון.
    email: user.email,
    // מציג מספר טלפון, או הודעה ברורה אם לא הוזן.
    phone: user.phone || 'לא הוזן',
    // מציג תמונת פרופיל, או מחרוזת ריקה אם אין תמונה.
    profileImage: user.profileImage || '',
    // מציג שם עסק, או שם ברירת מחדל אם לא הוגדר.
    businessName: user.businessName || 'העסק שלי',
    // מציג תוכנית מנוי, או את התוכנית הבסיסית כברירת מחדל.
    plan: user.plan || 'בסיסי',
    // מוסר את תפקיד המשתמש, למשל user או admin.
    role: user.role,
    // מוסר את נתוני המנוי הקיימים או אובייקט ברירת מחדל למנוי ניסיון.
    subscription: user.subscription || {
      // שם תוכנית ברירת המחדל למשתמש ללא נתוני מנוי.
      planName: 'חבילת התנסות (Free Trial)',
      // מצב המנוי המוצג כברירת מחדל.
      status: 'פעיל',
      // מספר ההודעות המוצג בתוכנית ברירת המחדל.
      messagesLeft: '18 / 100',
      // משך הניסיון המוצג כברירת מחדל.
      expireDate: '14 ימי ניסיון'
    },
    // מוסר את רשימת הבוטים אם קיימת ואינה ריקה; אחרת מוסר מערך ריק.
    bots: user.bots && user.bots.length ? user.bots : []
  };

  // מחזיר תשובת התחברות מלאה: פרופיל, תפקיד, אסימון ונתיב מתאים.
  return res.json({
    // מציין שהאימות הדו-שלבי הסתיים בהצלחה.
    success: true,
    // מחזיר את תפקיד המשתמש כדי שהלקוח יוכל להתאים את הממשק להרשאות.
    role: user.role,
    // מחזיר את הפרופיל שנבנה לעיל.
    user: userProfile,
    // יוצר אסימון גישה שיאפשר לזהות את המשתמש בבקשות הבאות.
    token: signAuthToken(user),
    // מפנה מנהל למסך ניהול ומשתמש רגיל ללוח הבקרה.
    redirectUrl: user.role === 'admin' ? '/admin.html' : '/pages/dashboard.html'
  });
}

// מייצא את פונקציות הטיפול כדי שהנתב יוכל לחבר אותן לכתובות ה-API המתאימות.
export default { sendRegistrationOtp, registerVerify, register, requestPasswordReset, confirmPasswordReset, login, loginVerify };