// Mongoose מגדיר את מבנה המסמך ואת החיבור בין המודל לאוסף במסד.
import mongoose from 'mongoose';


// סכמת מנהל שומרת שם משתמש מנורמל ומבטיחה שאין שני מנהלים בעלי אותו שם.
const administratorSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  }
}, { timestamps: true });

// יוצר מודל Mongoose המשמש לסנכרון ולבדיקת רשימת המנהלים.
export default mongoose.model('Administrator', administratorSchema);
