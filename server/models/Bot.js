import mongoose from 'mongoose';


const botSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    websiteUrl: {
        type: String,
        trim: true
    },
    scrapedContent: { type: String },
    instructions: { type: String },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Bot', botSchema);