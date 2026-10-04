const express = require('express');
const router = express.Router();
const Bot = require('../models/Bot');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { PLANS, getBotLimit } = require('../utils/plans');

/**
 * שומר תשלום, מפעיל את המסלול ומסיר בוטים עודפים לאחר אישור מפורש.
 * @param {import('express').Request} req בקשה מאומתת הכוללת מסלול ופרטי אמצעי תשלום.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<void>} שולח תוצאת הפעלה או תשובת שגיאה/אישור נדרש.
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { planId, cardholderName, cardLast4, confirmedBotCount = 0 } = req.body;
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

    const activePayment = await Payment.findOne({ userId: user._id, status: 'completed' })
      .sort({ createdAt: -1 })
      .select('planId');
    if (activePayment?.planId === planId) {
      return res.status(409).json({
        success: false,
        code: 'PLAN_ALREADY_ACTIVE',
        message: `החשבון שלך כבר נמצא במסלול ${planId}. לא נרשם תשלום נוסף.`
      });
    }

    const botIds = await Bot.find({ userId: user._id })
      .sort({ createdAt: 1, _id: 1 })
      .select('_id')
      .lean();
    const botLimit = getBotLimit(planId);
    const botsToDelete = botIds.slice(0, Math.max(0, botIds.length - botLimit));
    if (botsToDelete.length && confirmedBotCount !== botsToDelete.length) {
      return res.status(409).json({
        success: false,
        code: 'BOT_DELETION_CONFIRMATION_REQUIRED',
        botsToDelete: botsToDelete.length,
        targetBotLimit: botLimit,
        message: `המסלול כולל עד ${botLimit === Infinity ? 'ללא הגבלה' : botLimit} בוטים. כדי להשלים את המעבר יימחקו ${botsToDelete.length} הבוטים הוותיקים ביותר. יש לאשר כדי להמשיך.`
      });
    }

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
    if (botsToDelete.length) {
      await Bot.deleteMany({ _id: { $in: botsToDelete.map(bot => bot._id) }, userId: user._id });
    }

    return res.status(201).json({
      success: true,
      message: 'התשלום נשמר במסד הנתונים והמסלול הופעל.',
      plan: planId,
      removedBots: botsToDelete.length,
      paymentId: payment._id
    });
  } catch (error) {
    console.error('שגיאה בשמירת התשלום:', error.message);
    return res.status(500).json({ success: false, message: 'לא ניתן לשמור את התשלום כרגע' });
  }
});

module.exports = router;