import mongoose from 'mongoose';


const contactSchema = new mongoose.Schema({
    username: { type: String },
    message: { type: String },
    reply: { type: String, default: '' }, 
    chatId: { type: String, default: 'chat_default' }, // <--- הוספת chatId כדי שהמידע יישמר
    isAdmin: { type: Boolean, default: false }, 
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Contact', contactSchema);