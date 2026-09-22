const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clientName: { type: String, required: true }, // שם הלקוח לצורך חיפוש קל למנהל
  chatId: { type: String, required: true },     // מזהה ייחודי לכל שיחה נפרדת
  sender: { type: String, enum: ['user', 'bot'], required: true },
  text: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);