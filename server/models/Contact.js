const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    username: { type: String, required: true },
    message: { type: String, required: true },
    reply: { type: String, default: '' }, 
    chatId: { type: String, default: 'chat_default' }, // <--- הוספת chatId כדי שהמידע יישמר
    isAdmin: { type: Boolean, default: false }, 
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Contact', contactSchema);