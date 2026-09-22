const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    username: { type: String, required: true },
    message: { type: String, required: true },
    reply: { type: String, default: '' }, // השארנו כדי לא למחוק את ההיסטוריה הישנה שלך שכבר נשמרה
    // הדגל החדש: מסמן אם ההודעה נשלחה על ידי ההנהלה
    isAdmin: { type: Boolean, default: false }, 
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Contact', contactSchema);