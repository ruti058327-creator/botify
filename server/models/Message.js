import mongoose from 'mongoose';


const messageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  clientName: { type: String }, // שם הלקוח לצורך חיפוש קל למנהל
  chatId: { type: String },     // מזהה ייחודי לכל שיחה נפרדת
  sender: { type: String },
  text: { type: String },
}, { timestamps: true });

export default mongoose.model('Message', messageSchema);