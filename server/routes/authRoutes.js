const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact'); // ייבוא מודל ההודעות - חובה שיהיה כאן!
const bcrypt = require('bcrypt');
const User = require('../models/User');

// נתיב (Route) להרשמת משתמשים חדשים בשיטת POST
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password, role } = req.body;

    // בדיקה האם המשתמש או האימייל כבר קיימים
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      res.status(400);
      throw new Error('השם משתמש או האימייל כבר רשומים במערכת');
    }

    // הצפנת הסיסמה
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // יצירת משתמש חדש
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role: role || 'user'
    });

    await newUser.save();
    
    res.status(201).json({ message: 'ההרשמה בוצעה בהצלחה!' });
    
  } catch (err) {
    // העברת השגיאה למידלוור שגיאות המרכזי
    next(err);
  }
});

module.exports = router;

// נתיב התחברות - POST /api/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        if (username === 'NOAR' && password === '57863') {
            return res.json({ 
                success: true, 
                role: 'admin', 
                redirectUrl: 'admin.html' 
            });
        }

        return res.status(404).json({ 
            success: false, 
            message: 'קוד משתמש אינו נכון או אינו קיים במערכת', 
            redirectUrl: 'register.html' 
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: 'שגיאת שרת פנימית', error: error.message });
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

// קבלת כל ההודעות הנכנסות לפאנל הניהול - GET /api/messages
router.get('/messages', async (req, res) => {
    try {
        const messages = await Contact.find().sort({ createdAt: -1 });
        res.json({ success: true, messages });
    } catch (error) {
        res.status(500).json({ success: false, message: 'שגיאה בשליפת ההודעות', error: error.message });
    }
});

// שליחת הודעה חדשה מטופס צור קשר (לפי שם משתמש) - POST /api/contact
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

// --- נתיב חדש לשמירת התגובות של המנהלת ---
router.post('/reply', async (req, res) => {
    const { username, reply } = req.body;
    try {
        // שומרים את התגובה במסד הנתונים תחת שם המנהלת או כהודעה חדשה במערכת
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