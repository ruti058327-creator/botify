// נתב זה מנהל קריאה וכתיבה של היסטוריית שיחות עם בוטים.
import express from 'express';
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import validateRequest from '../middlewares/validateRequest.js';
import { chatSchemas } from '../validation/schemas.js';


// יוצר נתב עצמאי; כל נתיב מאמת את הפרמטרים או גוף הבקשה שלו.
const router = express.Router();

// מציג רשימת שיחות לפי מזהה משתמש, כשהאגרגציה מחזירה את זמן ההודעה האחרונה.
router.get('/user-chats/:userId', validateRequest(chatSchemas.userId, 'params'), async (req, res) => {
  // ממיר את המזהה למבנה ObjectId הנדרש בשאילתת MongoDB.
  const chats = await Message.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(req.params.userId) } },
    { $group: { _id: '$chatId', lastMessage: { $last: '$createdAt' } } },
    { $sort: { lastMessage: -1 } }
  ]);
  // מחזיר את קבוצות השיחה בסדר מהפעילות ביותר.
  return res.json({ success: true, chats });
});

// מביא את הודעות השיחה בסדר כרונולוגי כדי לשחזר את רצף הדיאלוג.
router.get('/messages/:chatId', validateRequest(chatSchemas.chatId, 'params'), async (req, res) => {
  const messages = await Message.find({ chatId: req.params.chatId }).sort({ createdAt: 1 });
  return res.json({ success: true, messages });
});

// מאפשר חיפוש הודעות לפי שם לקוח, ללא תווים שמרחיבים את ביטוי החיפוש.
router.get('/admin/search', validateRequest(chatSchemas.adminSearch, 'query'), async (req, res) => {
  const { clientName } = req.validatedQuery;
  const query = clientName
    // בריחה של תווים מיוחדים הופכת את החיפוש לטקסט מילולי ולא לביטוי רגולרי חופשי.
    ? { clientName: { $regex: clientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
    : {};
  const messages = await Message.find(query).sort({ createdAt: -1 });
  return res.json({ success: true, messages });
});

// שומר הודעה חדשה לאחר שסכמת הקלט בדקה את המשתמש, השולח והתוכן.
router.post('/message', validateRequest(chatSchemas.createMessage), async (req, res) => {
  const message = await Message.create(req.body);
  return res.json({ success: true, message });
});

// מחזיר את הנתב כדי שאפליקציית השרת תוכל לרשום אותו.
export default router;
