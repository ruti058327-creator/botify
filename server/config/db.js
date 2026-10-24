// מבטיח שמשתני הסביבה נטענים גם כאשר הקובץ מיובא באופן עצמאי.
import './env.js';
import mongoose from 'mongoose';


/**
 * Connects to MongoDB using the server environment configuration.
 * @returns {Promise<void>} Resolves after the database connection succeeds.
 */
export default async function connectDB() {
  // כתובת החיבור אינה מוטמעת בקוד ונקראת מהתצורה הסודית של הסביבה.
  const dbURI = process.env.MONGO_URI;
  if (!dbURI) {
    // עצירה מפורשת מונעת מהשרת לפעול במצב חלקי ללא מסד נתונים.
    throw new Error('MONGO_URI is missing. Create server/.env from server/.env.example and set your MongoDB connection string.');
  }

  // מתחבר למסד ומגדיר זמן המתנה מוגבל לאיתור שרת MongoDB זמין.
  await mongoose.connect(dbURI, {
    serverSelectionTimeoutMS: 15000,
    retryWrites: true
  });
  // ההודעה נכתבת רק לאחר שהחיבור הושלם בהצלחה.
  console.log('Connected to MongoDB successfully! 🎉');
}
