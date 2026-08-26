const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');

// נתיב (Route) להרשמת משתמשים חדשים בשיטת POST
router.post('/register', async (req, res) => {
  try {
    // 1. שליפת הנתונים שנשלחו מגוף הבקשה (Request Body)
    const { username, email, password, role } = req.body;

    // 2. בדיקה האם האימייל כבר קיים במסד הנתונים
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'האימייל כבר רשום במערכת' });
    }

    // 3. הצפנת הסיסמה (Hashing) אבטחתית בעזרת ספריית bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 4. יצירת אובייקט משתמש חדש עם הנתונים המוצפנים
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role: role || 'user' // ברירת מחדל לתפקיד היא 'user' אם לא צוין אחרת
    });

    // 5. שמירת המשתמש החדש במסד הנתונים
    await newUser.save();
    
    // 6. החזרת תשובת הצלחה ללקוח
    res.status(201).json({ message: 'ההרשמה בוצעה בהצלחה!' });
    
  } catch (err) {
    // טיפול בשגיאות לא צפויות בשרת
    console.error(err);
    res.status(500).json({ error: 'שגיאה פנימית בשרת במהלך ההרשמה' });
  }
});

module.exports = router;

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