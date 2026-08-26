const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Contact = require('../models/Contact'); // ייבוא מודל ההודעות

// נתיב (Route) להרשמת משתמשים חדשים בשיטת POST
<<<<<<< HEAD
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, role } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'האימייל כבר רשום במערכת' });
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
        res.status(201).json({ message: 'ההרשמה בוצעה בהצלחה!' });
        
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'שגיאה פנימית בשרת במהלך ההרשמה' });
    }
});

=======
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
<<<<<<< HEAD
=======

module.exports = router;
>>>>>>> 4c7322297a1ecf186da18fdf3bbd84ab2a90b328

>>>>>>> efc5cdf71ee483899b93a8f3fa62a61edf62f6ed
>>>>>>> f97a9fc2bd75c090d66b600a05a154ca5c56d458
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

        // בדיקה רגילה מול מסד הנתונים
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

router.get('/messages', async (req, res) => {
    try {
        const messages = await Contact.find().sort({ createdAt: -1 });
        res.json({ success: true, messages });
    } catch (error) {
        res.status(500).json({ success: false, message: 'שגיאה בשליפת ההודעות', error: error.message });
    }
});

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