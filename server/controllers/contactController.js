const Contact = require('../models/Contact');

/**
 * מחזיר למנהל את כל הודעות הפנייה, מהחדשה לישנה.
 * @param {import('express').Request} req בקשת API מאומתת.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} רשימת ההודעות או תשובת שגיאה.
 */
async function listAll(req, res) {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 });
    return res.json({ success: true, messages });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'שגיאה בשליפת ההודעות' });
  }
}

/**
 * מחזיר את הודעות הפנייה של המשתמש המחובר.
 * @param {import('express').Request} req בקשה עם המשתמש המחובר.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} הודעות המשתמש או תשובת שגיאה.
 */
async function listMine(req, res) {
  try {
    const messages = await Contact.find({ username: req.user.username }).sort({ createdAt: -1 });
    return res.json({ success: true, messages });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'שגיאה בשליפת הודעות הלקוח' });
  }
}

/**
 * שומר הודעת פנייה חדשה עבור המשתמש המחובר.
 * @param {import('express').Request} req בקשה עם תוכן ההודעה ומזהה השיחה האופציונלי.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} תשובת הצלחה או שגיאה.
 */
async function create(req, res) {
  const { message, chatId } = req.body;
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, message: 'יש להזין תוכן להודעה' });
  }
  try {
    const newMessage = new Contact({
      username: req.user.username,
      message: message.trim(),
      chatId: chatId || 'chat_old_history',
      isAdmin: false
    });
    await newMessage.save();
    return res.json({ success: true, message: 'ההודעה נשלחה בהצלחה' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'שגיאה בשליחת ההודעה' });
  }
}

/**
 * שומר תגובת מנהל כהודעה חדשה בשיחת הלקוח.
 * @param {import('express').Request} req בקשה עם שם משתמש, מזהה שיחה ותוכן תגובה.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} תשובת הצלחה או שגיאה.
 */
async function reply(req, res) {
  const { username, chatId, reply: replyText } = req.body;
  if (!username || typeof replyText !== 'string' || !replyText.trim()) {
    return res.status(400).json({ success: false, message: 'חסרים נתונים לשליחת התגובה' });
  }
  try {
    await new Contact({
      username,
      chatId: chatId || 'chat_old_history',
      message: replyText.trim(),
      isAdmin: true
    }).save();
    return res.json({ success: true, message: 'התגובה נשמרה בהצלחה כהודעה חדשה בשיחה' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'שגיאה בשמירת התגובה' });
  }
}

module.exports = { listAll, listMine, create, reply };