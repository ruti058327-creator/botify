const mongoose = require('mongoose');

const botSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    websiteUrl: {
        type: String,
        required: true,
        trim: true,
        validate: {
            /**
             * מאמת שכתובת הבוט היא כתובת HTTP או HTTPS עם שם מארח.
             * @param {string} value כתובת האתר לבדיקה.
             * @returns {boolean} האם הכתובת תקינה ובפרוטוקול נתמך.
             */
            validator(value) {
                try {
                    const url = new URL(value);
                    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname);
                } catch {
                    return false;
                }
            },
            message: 'כתובת האתר חייבת להיות כתובת HTTP או HTTPS תקינה'
        }
    },
    scrapedContent: { type: String, required: true, minlength: 20, maxlength: 15000 },
    instructions: { type: String, maxlength: 5000 },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Bot', botSchema);