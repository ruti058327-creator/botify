const express = require('express');
const router = express.Router();

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