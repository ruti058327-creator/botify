const express = require('express');
const router = express.Router();
const Message = require('../models/Message');

// קבלת כל מזהי השיחות של משתמש מסוים (כדי להציג לו "המשך שיחה" או "שיחה חדשה")
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