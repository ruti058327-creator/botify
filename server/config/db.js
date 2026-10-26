// מבטיח שמשתני הסביבה נטענים גם כאשר הקובץ מיובא באופן עצמאי.
import './env.js';
// Mongoose הוא שכבת הגישה למסד הנתונים MongoDB.
import mongoose from 'mongoose';


/**
 * Connects to MongoDB using the server environment configuration.
 * @returns {Promise<void>} Resolves after the database connection succeeds.
 */
export default async function connectDB() {
  // כתובת החיבור אינה מוטמעת בקוד ונקראת מהתצורה הסודית של הסביבה.
  const dbURI = process.env.MONGO_URI;
  // ממתינים לבחירת שרת MongoDB ולחיבור מוצלח, עם זמן קצוב לניסיון.
  await mongoose.connect(dbURI, {
    serverSelectionTimeoutMS: 15000,
    retryWrites: true
  });
  // ההודעה נכתבת רק לאחר שהחיבור הושלם בהצלחה.
  console.log('Connected to MongoDB successfully! 🎉');
}
