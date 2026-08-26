const express = require('express');
const router = express.Router();
const User = require('../models/User');

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

module.exports = router;