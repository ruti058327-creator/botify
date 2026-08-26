const express = require('express');
const router = express.Router();
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
        // בדיקת התחברות מנהל
        if (username === 'admin' && password === 'admin123') {
            return res.json({ 
                success: true, 
                role: 'admin', 
                redirectUrl: '/admin.html' 
            });
        }

        // משתמש לא קיים במערכת
        return res.status(404).json({ 
            success: false, 
            message: 'קוד משתמש אינו נכון או אינו קיים במערכת', 
            redirectUrl: '/register.html' 
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: 'שגיאת שרת פנימית', error: error.message });
    }
});

module.exports = router;