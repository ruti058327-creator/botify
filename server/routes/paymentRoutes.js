const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const User = require('../models/User');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { PLANS } = require('../utils/plans');

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { planId, cardholderName, cardLast4 } = req.body;
    const selectedPlan = PLANS[planId];
    if (!selectedPlan) {
      return res.status(400).json({ success: false, message: 'המסלול שנבחר אינו תקין' });
    }
    if (typeof cardholderName !== 'string' || !cardholderName.trim() || cardholderName.length > 100) {
      return res.status(400).json({ success: false, message: 'יש להזין את שם בעל הכרטיס' });
    }
    if (typeof cardLast4 !== 'string' || !/^\d{4}$/.test(cardLast4)) {
      return res.status(400).json({ success: false, message: 'יש להזין את ארבע הספרות האחרונות בכרטיס' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ success: false, message: 'יש להתחבר מחדש כדי להמשיך' });

    const payment = await Payment.create({
      userId: user._id,
      fullName: user.fullName || user.username,
      email: user.email,
      cardholderName: cardholderName.trim(),
      cardLast4,
      planId,
      amount: Math.round(selectedPlan.price * 1.18),
      mode: 'recorded',
      status: 'completed'
    });
    user.plan = planId;
    await user.save();

    return res.status(201).json({
      success: true,
      message: 'התשלום נשמר במסד הנתונים והמסלול הופעל.',
      plan: planId,
      paymentId: payment._id
    });
  } catch (error) {
    console.error('שגיאה בשמירת התשלום:', error.message);
    return res.status(500).json({ success: false, message: 'לא ניתן לשמור את התשלום כרגע' });
  }
});

module.exports = router;