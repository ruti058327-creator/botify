import '../config/env.js';
import nodemailer from 'nodemailer';
import __cjsImport0 from 'node:crypto';
import User from '../models/User.js';
import __cjsImport1 from '../utils/jwt.js';
import httpError from '../utils/httpError.js';

const { randomInt } = __cjsImport0;
const { signAuthToken } = __cjsImport1;


const loginOtpStore = new Map();
const registrationOtpStore = new Map();
const passwordResetStore = new Map();
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * מאתר משתמש לפי שם משתמש ללא תלות באותיות רישיות, תוך התייחסות בטוחה לתווים מיוחדים.
 * @param {string} username שם המשתמש לחיפוש.
 * @returns {Promise<import('mongoose').HydratedDocument<object>|null>} המשתמש שנמצא או {@code null}.
 */
const findUserByUsername = (username) => {
  const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return User.findOne({ username: new RegExp(`^${escapedUsername}$`, 'i') });
};

/**
 * מאתר משתמש לפי כתובת דוא״ל ללא תלות באותיות רישיות.
 * @param {string} email כתובת הדוא״ל לחיפוש.
 * @returns {Promise<import('mongoose').HydratedDocument<object>|null>} המשתמש שנמצא או {@code null}.
 */
const findUserByEmail = (email) => {
  const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return User.findOne({ email: new RegExp(`^${escapedEmail}$`, 'i') });
};

/**
 * בודק שכתובת הדוא״ל ושם המשתמש זמינים ושולח קוד חד-פעמי להרשמה.
 * @param {import('express').Request} req בקשת ההרשמה.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} תשובת הצלחה או שגיאה.
 */
async function sendRegistrationOtp(req, res) {
  const { email, username } = req.body;

  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    throw httpError(409, 'שם המשתמש או כתובת האימייל כבר רשומים במערכת');
  }
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw httpError(503, 'שירות שליחת קוד האימות אינו זמין כרגע');
  }

  const otpCode = randomInt(100000, 1000000).toString();
  registrationOtpStore.set(email, { otpCode, expires: Date.now() + 5 * 60 * 1000 });
  await transporter.sendMail({
    from: `"Botify Security" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'קוד אימות להרשמה - Botify',
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;padding:25px;max-width:500px;margin:auto"><h2>ברוכים הבאים ל-Botify!</h2><p>שלום <strong>${username}</strong>, קוד האימות שלך הוא:</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px;text-align:center">${otpCode}</p><p>הקוד בתוקף ל-5 דקות בלבד.</p></div>`
  });
  return res.json({ success: true, message: 'קוד האימות נשלח בהצלחה לתיבת המייל!' });
}

/**
 * מאמת קוד הרשמה ושומר את חשבון המשתמש החדש.
 * @param {import('express').Request} req בקשה עם פרטי המשתמש וקוד האימות.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} תשובת הצלחה או שגיאה.
 */
async function registerVerify(req, res) {
  const { fullName, idNumber, email, phone, businessName, username, password, otpCode } = req.body;
  const storedData = registrationOtpStore.get(email);

  if (!storedData || Date.now() > storedData.expires) {
    registrationOtpStore.delete(email);
    throw httpError(400, 'קוד האימות אינו תקף או שפג תוקפו. נא לבקש קוד חדש.');
  }
  if (storedData.otpCode !== otpCode) {
    throw httpError(400, 'קוד האימות שהזנת שגוי.');
  }

  const newUser = new User({ fullName, idNumber, email, phone, businessName, username, password, role: 'user' });
  await newUser.save();
  registrationOtpStore.delete(email);
  return res.status(201).json({ success: true, message: 'ההרשמה הושלמה בהצלחה!' });
}

/**
 * יוצר חשבון משתמש באמצעות הרשמה בסיסית ללא שלב אימות קוד.
 * @param {import('express').Request} req בקשה עם שם משתמש, דוא״ל וסיסמה.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} תשובת הצלחה או שגיאה.
 */
async function register(req, res) {
  const { username, email, password } = req.body;

  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) throw httpError(409, 'שם המשתמש או האימייל כבר רשומים במערכת');
  await new User({ username, email, password, role: 'user' }).save();
  return res.status(201).json({ success: true, message: 'ההרשמה בוצעה בהצלחה!' });
}

/**
 * מבקש קוד איפוס סיסמה ושולח אותו לכתובת המשויכת לשם המשתמש.
 * @param {import('express').Request} req בקשה המכילה שם משתמש.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} תשובה אחידה למניעת חשיפת קיום חשבון.
 */
async function requestPasswordReset(req, res) {
  const { username } = req.body;
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw httpError(503, 'שירות שליחת האימייל אינו זמין כרגע');
  }

  const user = await findUserByUsername(username);
  let maskedEmail = '';
  if (user) {
    const otpCode = randomInt(100000, 1000000).toString();
    const resetKey = user.username.toLowerCase();
    const [emailName, emailDomain] = user.email.split('@');
    maskedEmail = `${'*'.repeat(Math.max(1, emailName.length - 3))}${emailName.slice(-3)}@${emailDomain}`;
    passwordResetStore.set(resetKey, { otpCode, expires: Date.now() + 5 * 60 * 1000, attempts: 0 });
    try {
      await transporter.sendMail({
        from: `"Botify Security" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: 'קוד לאיפוס סיסמה - Botify',
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;padding:25px;max-width:500px;margin:auto"><h2>איפוס סיסמה ל-Botify</h2><p>קוד האימות שלך הוא:</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px;text-align:center">${otpCode}</p><p>הקוד בתוקף ל-5 דקות בלבד.</p><p>אם לא ביקשת לאפס את הסיסמה, אפשר להתעלם מהודעה זו.</p></div>`
      });
    } catch (error) {
      passwordResetStore.delete(resetKey);
      throw error;
    }
  }
  return res.json({
    success: true,
    message: maskedEmail ? `קוד אימות נשלח לכתובת המייל ${maskedEmail}. הזינו את הקוד כדי ליצור סיסמה חדשה.` : 'אם שם המשתמש קיים, נשלח קוד אימות לכתובת המייל המשויכת לחשבון.',
    maskedEmail: maskedEmail || undefined
  });
}

/**
 * מאמת קוד איפוס ומחליף את סיסמת המשתמש.
 * @param {import('express').Request} req בקשה המכילה שם משתמש, קוד וסיסמה חדשה.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} תשובת הצלחה או שגיאה.
 */
async function confirmPasswordReset(req, res) {
  const { username } = req.body;
  const { otpCode, password } = req.body;

  const resetKey = username.toLowerCase();
  const resetData = passwordResetStore.get(resetKey);
  if (!resetData || Date.now() > resetData.expires) {
    passwordResetStore.delete(resetKey);
    throw httpError(400, 'קוד האיפוס אינו תקף או שפג תוקפו. בקשו קוד חדש.');
  }
  if (resetData.otpCode !== otpCode) {
    resetData.attempts += 1;
    if (resetData.attempts >= 5) passwordResetStore.delete(resetKey);
    throw httpError(400, 'קוד האיפוס שגוי או שפג תוקפו');
  }

  const user = await findUserByUsername(username);
  if (!user) {
    passwordResetStore.delete(resetKey);
    throw httpError(400, 'קוד האיפוס אינו תקף או שפג תוקפו');
  }
  user.password = password;
  await user.save();
  passwordResetStore.delete(resetKey);
  return res.json({ success: true, message: 'הסיסמה עודכנה בהצלחה' });
}

/**
 * מאמת פרטי התחברות ושולח קוד OTP למשתמשים הנדרשים לאימות דו-שלבי.
 * @param {import('express').Request} req בקשה המכילה שם משתמש וסיסמה.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} פרטי משתמש/דרישת OTP או תשובת שגיאה.
 */
async function login(req, res) {
  const { username, password } = req.body;

  const normalizedUsername = username.toUpperCase();
  const adminUsernames = ['NOA', 'RUTI', 'MIRYAM'];
  if (adminUsernames.includes(normalizedUsername) && password === '578621') {
    const user = {
      id: `admin:${normalizedUsername}`,
      username: normalizedUsername,
      fullName: `מנהלת מערכת - ${normalizedUsername}`,
      businessName: 'הנהלת Botify',
      role: 'admin'
    };
    return res.json({ success: true, role: 'admin', user, token: signAuthToken(user), redirectUrl: '/admin.html' });
  }

  const loginIdentifier = username.includes('@') ? username.toLowerCase() : username;
  const user = await User.findOne({ $or: [{ username: loginIdentifier }, { email: loginIdentifier }] });
  if (!user || !(await User.comparePassword(password, user.password))) {
    throw httpError(
      user ? 400 : 404,
      user ? 'שם משתמש או סיסמה שגויים' : 'שם משתמש או אימייל אינם קיימים במערכת',
      user ? {} : { redirectUrl: '/register.html' }
    );
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw httpError(503, 'שירות שליחת קוד האימות אינו זמין כרגע');
  }

  const otpCode = randomInt(100000, 1000000).toString();
  const otpKey = user.email.toLowerCase();
  loginOtpStore.set(otpKey, { otpCode, expires: Date.now() + 5 * 60 * 1000, attempts: 0 });

  try {
    await transporter.sendMail({
      from: `"Botify Security" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'קוד אימות התחברות - Botify',
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
    loginOtpStore.delete(otpKey);
    throw error;
  }

  return res.json({
    success: true,
    requireOtp: true,
    email: user.email,
    message: 'קוד אימות נשלח לכתובת המייל המקושרת לחשבון'
  });
}

/**
 * מאמת קוד OTP להתחברות ומחזיר פרופיל משתמש ואסימון גישה.
 * @param {import('express').Request} req בקשה המכילה דוא״ל וקוד חד-פעמי.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} פרופיל המשתמש ואסימון או תשובת שגיאה.
 */
async function loginVerify(req, res) {
  const { email, otpCode } = req.body;
  const storedData = loginOtpStore.get(email);

  if (!storedData || Date.now() > storedData.expires) {
    loginOtpStore.delete(email);
    throw httpError(400, 'קוד האימות אינו תקף או שפג תוקפו. נא להתחבר מחדש.');
  }

  if (storedData.otpCode !== otpCode) {
    storedData.attempts += 1;
    if (storedData.attempts >= 5) loginOtpStore.delete(email);
    throw httpError(400, 'קוד האימות שגוי');
  }

  const user = await findUserByEmail(email);
  if (!user) {
    loginOtpStore.delete(email);
    throw httpError(404, 'המשתמש לא נמצא');
  }

  loginOtpStore.delete(email);
  const userProfile = {
    id: user._id,
    fullName: user.fullName || user.username,
    username: user.username,
    email: user.email,
    phone: user.phone || 'לא הוזן',
    profileImage: user.profileImage || '',
    businessName: user.businessName || 'העסק שלי',
    plan: user.plan || 'בסיסי',
    role: user.role,
    subscription: user.subscription || {
      planName: 'חבילת התנסות (Free Trial)',
      status: 'פעיל',
      messagesLeft: '18 / 100',
      expireDate: '14 ימי ניסיון'
    },
    bots: user.bots && user.bots.length ? user.bots : []
  };

  return res.json({
    success: true,
    role: user.role,
    user: userProfile,
    token: signAuthToken(user),
    redirectUrl: user.role === 'admin' ? '/admin.html' : '/pages/dashboard.html'
  });
}

export default { sendRegistrationOtp, registerVerify, register, requestPasswordReset, confirmPasswordReset, login, loginVerify };