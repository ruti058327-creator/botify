import mongoose from 'mongoose';
import bcrypt from 'bcrypt';


const userSchema = new mongoose.Schema({
  fullName: {
    type: String
  },
  idNumber: {
    type: String
  },
  email: {
    type: String,
    unique: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String
  },
  businessName: {
    type: String
  },
  username: {
    type: String,
    unique: true
  },
  password: {
    type: String
  },
  profileImage: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    default: 'user'
  },
  plan: {
    type: String,
    default: 'בסיסי'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

/**
 * מצפין סיסמה ששונתה לפני שמירת מסמך המשתמש.
 * @this {import('mongoose').HydratedDocument<object>} מסמך המשתמש הנשמר.
 * @returns {Promise<void>} משלים את ההצפנה לפני המשך השמירה.
 */
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

/**
 * משווה סיסמה גלויה לגיבוב bcrypt השמור.
 * @param {string} candidatePassword הסיסמה שסיפק המשתמש.
 * @param {string} passwordHash גיבוב הסיסמה השמור.
 * @returns {Promise<boolean>} האם הסיסמה תואמת לגיבוב.
 */
userSchema.statics.comparePassword = function (candidatePassword, passwordHash) {
  return bcrypt.compare(candidatePassword, passwordHash);
};

userSchema.set('toJSON', {
  /**
   * מסיר שדות פנימיים ורגישים מייצוג JSON של המשתמש.
   * @param {import('mongoose').Document} document מסמך המשתמש המקורי.
   * @param {Record<string, *>} returnedObject אובייקט JSON שהוכן להחזרה.
   * @returns {Record<string, *>} האובייקט לאחר הסרת סיסמה וגרסת מסמך.
   */
  transform(document, returnedObject) {
    delete returnedObject.password;
    delete returnedObject.__v;
    return returnedObject;
  }
});

export default mongoose.model('User', userSchema);