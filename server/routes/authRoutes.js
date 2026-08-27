const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

// ייבוא המודלים
const User = require('../models/User');
const Contact = require('../models/Contact');

// נתיב להרשמת משתמשים חדשים - POST /api/register
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password, role } = req.body;

    // בדיקה האם המשתמש או האימייל כבר קיימים במסד הנתונים
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      res.status(400);
      throw new Error('שם המשתמש או האימייל כבר רשומים במערכת');
    }

    // הצפנת הסיסמה
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // יצירת משתמש חדש ושמירתו ב-DB
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role: role || 'user'
    });

    await newUser.save();
    res.status(201).json({ message: 'ההרשמה בוצעה בהצלחה!' });
  } catch (err) {
    next(err);
  }
});

// נתיב התחברות - POST /api/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // בדיקת מנהל קשיחה
    if (username && username.trim().toUpperCase() === 'NOAR' && password === '57863') {
      return res.json({ 
        success: true, 
        role: 'admin', 
        redirectUrl: 'admin.html' 
      });
    }

    // בדיקת משתמש מול מסד הנתונים
    const user = await User.findOne({ 
      $or: [{ username: username }, { email: username }] 
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'שם משתמש או סיסמה שגויים', 
        redirectUrl: 'register.html' 
      });
    }

    // אימות הסיסמה המוצפנת מול ה-DB
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false, 
        message: 'שם משתמש או סיסמה שגויים' 
      });
    }

    res.json({
      success: true,
      role: user.role,
      redirectUrl: user.role === 'admin' ? 'admin.html' : 'index.html'
    });

  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'שגיאת שרת פנימית', 
      error: error.message 
    });
  }
});

// נתיב לקבלת כמות המשתמשים - GET /api/users/count
router.get('/users/count', async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: 'שגיאה בספירת המשתמשים', error: error.message });
  }
});

// נתיב לקבלת כל המשתמשים - GET /api/users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'שגיאה בשליפת המשתמשים', error: error.message });
  }
});

// --- נתיבים עבור תיבת ההודעות (צור קשר) ---

// קבלת כל ההודעות - GET /api/messages
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