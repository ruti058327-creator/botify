import express from 'express';
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import validateRequest from '../middlewares/validateRequest.js';
import { chatSchemas } from '../validation/schemas.js';


const router = express.Router();

router.get('/user-chats/:userId', validateRequest(chatSchemas.userId, 'params'), async (req, res) => {
  const chats = await Message.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(req.params.userId) } },
    { $group: { _id: '$chatId', lastMessage: { $last: '$createdAt' } } },
    { $sort: { lastMessage: -1 } }
  ]);
  return res.json({ success: true, chats });
});

router.get('/messages/:chatId', validateRequest(chatSchemas.chatId, 'params'), async (req, res) => {
  const messages = await Message.find({ chatId: req.params.chatId }).sort({ createdAt: 1 });
  return res.json({ success: true, messages });
});

router.get('/admin/search', validateRequest(chatSchemas.adminSearch, 'query'), async (req, res) => {
  const { clientName } = req.validatedQuery;
  const query = clientName
    ? { clientName: { $regex: clientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
    : {};
  const messages = await Message.find(query).sort({ createdAt: -1 });
  return res.json({ success: true, messages });
});

router.post('/message', validateRequest(chatSchemas.createMessage), async (req, res) => {
  const message = await Message.create(req.body);
  return res.json({ success: true, message });
});

export default router;
