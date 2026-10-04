const express = require('express');
const router = express.Router();
const Message = require('../models/Message');

// קבלת כל מזהי השיחות של משתמש מסוים (כדי להציג לו "המשך שיחה" או "שיחה חדשה")
/**
 * מחזיר את מזהי השיחות הייחודיים של משתמש לפי זמן ההודעה האחרונה.
 * @param {import('express').Request} req בקשה עם מזהה משתמש בפרמטר הנתיב.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<void>} שולח את השיחות או תשובת שגיאה.
 */
router.get('/user-chats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    // מוצאים את כל ה-chatId הייחודיים של המשתמש
    const chats = await Message.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$chatId', lastMessage: { $last: '$createdAt' } } },
      { $sort: { lastMessage: -1 } }
    ]);
    res.json({ success: true, chats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// טעינת הודעות של שיחה ספציפית לפי chatId
/**
 * טוען הודעות של שיחה מסוימת בסדר כרונולוגי.
 * @param {import('express').Request} req בקשה עם מזהה שיחה בפרמטר הנתיב.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<void>} שולח את הודעות השיחה או תשובת שגיאה.
 */
router.get('/messages/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const messages = await Message.find({ chatId }).sort({ createdAt: 1 });
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// חיפוש שיחות למנהל לפי שם לקוח (או הצגת השיחה העדכנית ביותר כברירת מחדל)
/**
 * מחפש הודעות לפי שם לקוח או מחזיר את כלל השיחות לממשק הניהול.
 * @param {import('express').Request} req בקשה עם שם לקוח אופציונלי בשאילתה.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<void>} שולח את ההודעות התואמות או תשובת שגיאה.
 */
router.get('/admin/search', async (req, res) => {
  try {
    const { clientName } = req.query;
    let query = {};
    if (clientName) {
      // חיפוש חלקי או מלא לפי שם הלקוח
      query.clientName = { $regex: clientName, $options: 'i' };
    }
    
    // שליפת כל ההודעות התואמות, מסודרות מהחדש ישן
    const messages = await Message.find(query).sort({ createdAt: -1 });
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// שמירת הודעה חדשה בשיחה
/**
 * יוצר ושומר הודעה חדשה בשיחה.
 * @param {import('express').Request} req בקשה עם פרטי ההודעה.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<void>} שולח את ההודעה שנשמרה או תשובת שגיאה.
 */
router.post('/message', async (req, res) => {
  try {
    const { userId, clientName, chatId, sender, text } = req.body;
    const newMessage = new Message({ userId, clientName, chatId, sender, text });
    await newMessage.save();
    res.json({ success: true, message: newMessage });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;