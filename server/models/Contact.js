const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    username: { type: String, required: true },
    message: { type: String, required: true },
    // הוספנו את השדה הבא כדי שהמסד ישמור את תגובות המנהלת
    reply: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Contact', contactSchema);