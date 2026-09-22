const mongoose = require('mongoose');

const botSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    websiteUrl: { type: String, required: true },
    scrapedContent: { type: String, required: true }, // הטקסט שחולץ מהאתר
    instructions: { type: String }, // הנחיות אישיות מהמשתמש
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Bot', botSchema);