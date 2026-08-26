const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');

// יצירת רשומת תשלום חדשה ב-DB
router.post('/', async (req, res) => {
  try {
    const { fullName, email, planId, amount } = req.body;

    // ולידציה בסיסית
    if (!fullName || !email || !planId || !amount) {
      return res.status(400).json({ message: 'כל השדות הינם חובה' });
    }

    // שמירה ב-MongoDB
    const newPayment = new Payment({
      fullName,
      email,
      planId,
      amount
    });

    const savedPayment = await newPayment.save();

    res.status(201).json({
      success: true,
      message: 'התשלום נרשם בהצלחה ב-MongoDB',
      data: savedPayment
    });
  } catch (error) {
    console.error('שגיאה בשמירת התשלום:', error.message);
    res.status(500).json({ message: 'שגיאת שרת בשמירת נתוני התשלום' });
  }
});

module.exports = router;