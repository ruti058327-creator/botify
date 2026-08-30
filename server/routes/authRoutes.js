const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

// ייבוא המודלים
const User = require('../models/User');
const Contact = require('../models/Contact');

// מבנה זיכרון זמני לשמירת קודי אימות
const otpStore = new Map();

// הגדרת שירות שליחת המיילים (Nodemailer)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ==========================================
// 1. נתיבי הרשמה ואימות
// ==========================================

// שלב א': שליחת קוד אימות למייל (תוקף ל-5 דקות) - POST /api/send-otp
router.post('/send-otp', async (req, res) => {
  const { email, username } = req.body;

  try {
    if (!email || !username) {
      return res.status(400).json({ 
        success: false, 
        message: 'נא להזין אימייל ושם משתמש תקינים' 
      });
    }

    // בדיקה האם שם המשתמש או האימייל כבר קיימים במערכת
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'שם המשתמש או כתובת האימייל כבר רשומים במערכת' 
      });
    }

    // יצירת קוד רנדומלי בן 6 ספרות
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // תוקף קשיח ל-5 דקות בדיוק (5 * 60 * 1000ms)
    const expires = Date.now() + 5 * 60 * 1000;
    otpStore.set(email, { otpCode, expires });

    // תבנית הודעת המייל המעוצבת
    const mailOptions = {
      from: `"Botify Security" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'קוד אימות להרשמה - Botify',
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 500px; margin: auto; background-color: #ffffff;">
          <h2 style="color: #2563eb; text-align: center; margin-bottom: 20px;">ברוכים הבאים ל-Botify!</h2>
          <p style="font-size: 15px; color: #334155;">שלום <strong>${username}</strong>,</p>
          <p style="font-size: 15px; color: #334155;">קוד האימות שלך להשלמת ההרשמה הוא:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; background: #eff6ff; color: #1d4ed8; padding: 12px 28px; border-radius: 8px; border: 2px dashed #3b82f6; display: inline-block;">
              ${otpCode}
            </span>
          </div>
          <p style="color: #dc2626; font-weight: bold; text-align: center; font-size: 14px;">
            ⚠️ הקוד בתוקף ל-5 דקות בלבד!
          </p>
          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 25px 0;">
          <p style="font-size: 12px; color: #64748b; text-align: center;">אם לא ביצעת בקשת הרשמה זו, ניתן להתעלם ממייל זה בבטחה.</p>
        </div>
      `
    };

    console.log(`\n🔑 [Botify OTP] קוד האימות שנוצר עבור ${email}: ${otpCode}`);

    // שליחת המייל דרך Gmail
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        await transporter.sendMail(mailOptions);
        console.log(`✉️ [Botify] המייל נשלח בהצלחה לתיבת הדואר של: ${email}\n`);
      } catch (mailErr) {
        console.error('🔥 [Nodemailer Error] שגיאה בשליחת המייל דרך גוגל:', mailErr.message);
      }
    } else {
      console.warn('⚠️ שים לב: EMAIL_USER או EMAIL_PASS אינם מוגדרים בקובץ .env');
    }

    res.json({ success: true, message: 'קוד האימות נשלח בהצלחה לתיבת המייל!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'שגיאה בשליחת קוד האימות' });
  }
});

// שלב ב': אימות קוד ויצירת משתמש סופי ב-DB - POST /api/register-verify
router.post('/register-verify', async (req, res, next) => {
  try {
    const { 
      fullName, 
      idNumber, 
      email, 
      phone, 
      businessName, 
      username, 
      password, 
      otpCode 
    } = req.body;

    const storedData = otpStore.get(email);

    // 1. בדיקה האם הקוד קיים
    if (!storedData) {
      return res.status(400).json({ 
        success: false, 
        message: 'לא נמצא קוד אימות בתוקף עבור אימייל זה. נא לבקש קוד מחדש.' 
      });
    }

    // 2. בדיקת תוקף 5 דקות
    if (Date.now() > storedData.expires) {
      otpStore.delete(email);
      return res.status(400).json({ 
        success: false, 
        message: 'פג תוקף קוד האימות (עברו מעל 5 דקות). נא לבקש קוד חדש.' 
      });
    }

    // 3. בדיקת תאימות הקוד
    if (storedData.otpCode !== otpCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'קוד האימות שהזנת שגוי.' 
      });
    }

    // מחיקת הקוד מהזיכרון לאחר אימות תקין
    otpStore.delete(email);

    // הצפנת הסיסמה
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // שמירת המשתמש החדש עם כל השדות
    const newUser = new User({
      fullName,
      idNumber,
      email,
      phone,
      businessName,
      username,
      password: hashedPassword,
      role: 'user'
    });

    const savedUser = await newUser.save();
    console.log(`\n💾 [MongoDB] משתמש חדש נשמר בהצלחה: ${savedUser.username} (${savedUser.email})`);

    res.status(201).json({ success: true, message: 'ההרשמה הושלמה בהצלחה!' });
  } catch (err) {
    next(err);
  }
});

// נתיב הרשמה ישיר (לתאימות לאחור) - POST /api/register
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password, role } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      res.status(400);
      throw new Error('שם המשתמש או האימייל כבר רשומים במערכת');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role: role || 'user'
    });

    await newUser.save();
    res.status(201).json({ success: true, message: 'ההרשמה בוצעה בהצלחה!' });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2. נתיבי התחברות ואימות התחברות (Login & OTP Verification)
// ==========================================

// שלב א' התחברות: בדיקת סיסמה ושליחת קוד אימות למייל של המשתמש - POST /api/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const cleanUsername = username ? username.trim().toUpperCase() : '';
    const adminUsernames = ['NOA', 'RUTI', 'MIRYAM'];
    const adminPassword = '578621';

    // בדיקת מנהלת מול השמות המוגדרים והקוד 578621
    if (adminUsernames.includes(cleanUsername) && password === adminPassword) {
      return res.json({ 
        success: true, 
        role: 'admin',
        user: { 
          fullName: `מנהלת מערכת - ${cleanUsername}`, 
          username: cleanUsername, 
          businessName: 'הנהלת Botify',
          role: 'admin' 
        },
        redirectUrl: '/admin.html' 
      });
    }

    // חיפוש המשתמש במסד הנתונים לפי שם משתמש או אימייל
    const user = await User.findOne({ 
      $or: [{ username: username ? username.trim() : '' }, { email: username ? username.trim() : '' }] 
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'שם משתמש או אימייל אינם קיימים במערכת', 
        redirectUrl: '/register.html' 
      });
    }

    // אימות סיסמה מוצפנת
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false, 
        message: 'שם משתמש או סיסמה שגויים' 
      });
    }

    // יצירת קוד אימות חדש ושמירתו לפי המייל של המשתמש
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 5 * 60 * 1000;
    otpStore.set(user.email, { otpCode, expires });

    const mailOptions = {
      from: `"Botify Security" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'קוד אימות התחברות - Botify',
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 500px; margin: auto; background-color: #ffffff;">
          <h2 style="color: #2563eb; text-align: center;">אימות התחברות ל-Botify</h2>
          <p style="color: #334155;">שלום <strong>${user.username}</strong>,</p>
          <p style="color: #334155;">קוד האימות שלך לכניסה למערכת הוא:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; background: #eff6ff; color: #1d4ed8; padding: 12px 28px; border-radius: 8px; border: 2px dashed #3b82f6; display: inline-block;">
              ${otpCode}
            </span>
          </div>
          <p style="color: #dc2626; font-weight: bold; text-align: center; font-size: 14px;">⚠️ הקוד בתוקף ל-5 דקות בלבד!</p>
        </div>
      `
    };

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      await transporter.sendMail(mailOptions);
    }

    res.json({ 
      success: true, 
      requireOtp: true, 
      email: user.email,
      message: 'קוד אימות נשלח לכתובת המייל המקושרת לחשבון' 
    });

  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'שגיאת שרת פנימית', 
      error: error.message 
    });
  }
});

// שלב ב' התחברות: אימות סופי של קוד ה-OTP והחזרת פרופיל המשתמש - POST /api/login-verify
router.post('/login-verify', async (req, res) => {
  try {
    const { email, otpCode } = req.body;
    const storedData = otpStore.get(email);

    if (!storedData) {
      return res.status(400).json({ 
        success: false, 
        message: 'לא נמצא קוד אימות בתוקף. נא להתחבר מחדש.' 
      });
    }

    if (Date.now() > storedData.expires) {
      otpStore.delete(email);
      return res.status(400).json({ 
        success: false, 
        message: 'פג תוקף קוד האימות. נא להתחבר מחדש.' 
      });
    }

    if (storedData.otpCode !== otpCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'קוד האימות שגוי.' 
      });
    }

    otpStore.delete(email);

    // שליפת המשתמש המלא מהמסד
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'המשתמש לא נמצא' });
    }

    // בניית אובייקט הנתונים שמוחזר ללקוח עבור האזור האישי
    const userProfile = {
      id: user._id,
      fullName: user.fullName || user.username,
      username: user.username,
      email: user.email,
      phone: user.phone || 'לא הוזן',
      businessName: user.businessName || 'העסק שלי',
      role: user.role,
      subscription: user.subscription || {
        planName: 'חבילת התנסות (Free Trial)',
        status: 'פעיל',
        messagesLeft: '18 / 100',
        expireDate: '14 ימי ניסיון'
      },
      bots: user.bots && user.bots.length > 0 ? user.bots : [
        {
          id: 'bot_default_1',
          name: 'בוט שירות לקוחות ראשי',
          type: 'WhatsApp & Web AI',
          status: 'פעיל',
          conversationsToday: 0,
          lastActive: 'פעיל כעת'
        }
      ]
    };

    res.json({
      success: true,
      role: user.role,
      user: userProfile,
      redirectUrl: user.role === 'admin' ? '/admin.html' : '/pages/dashboard.html'
    });

  } catch (err) {
    res.status(500).json({ success: false, message: 'שגיאה באימות קוד ההתחברות', error: err.message });
  }
});

// ==========================================
// 3. נתיבי ניהול משתמשים
// ==========================================

// ספירת משתמשים - GET /api/users/count
router.get('/users/count', async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: 'שגיאה בספירת המשתמשים', error: error.message });
  }
});

// רשימת כל המשתמשים - GET /api/users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'שגיאה בשליפת המשתמשים', error: error.message });
  }
});

// ==========================================
// 4. נתיבי צור קשר והודעות
// ==========================================

// שליפת כל ההודעות - GET /api/messages
router.get('/messages', async (req, res) => {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 });
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: 'שגיאה בשליפת ההודעות', error: error.message });
  }
});

// שליחת הודעה חדשה - POST /api/contact
router.post('/contact', async (req, res) => {
  const { username, message } = req.body;
  try {
    const newMessage = new Contact({ username, message });
    await newMessage.save();
    res.json({ success: true, message: 'ההודעה נשלחה בהצלחה' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'שגיאה בשליחת ההודעה', error: error.message });
  }
});

// שמירת תגובת מנהל - POST /api/reply
router.post('/reply', async (req, res) => {
  const { username, reply } = req.body;
  try {
    const newReply = new Contact({
      username: `מנהלת (אל: ${username})`,
      message: reply
    });
    await newReply.save();
    res.json({ success: true, message: 'התגובה נשמרה בהצלחה' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'שגיאה בשמירת התגובה', error: error.message });
  }
});

module.exports = router;