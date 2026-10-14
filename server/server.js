const path = require('path');
// טעינת קובץ ה-.env מאותה תיקייה שבה נמצא קובץ השרת
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const mongoose = require('mongoose');

// 1. איפוס מדויק של מחרוזת החיבור; אין fallback אוטומטי ל-localhost
const dbURI = process.env.MONGO_URI;

if (!dbURI) {
  console.error('❌ MONGO_URI is missing. Create server/.env from server/.env.example and set your MongoDB connection string.');
  process.exit(1);
}

// 2. חיבור יחיד למסד הנתונים
/** 
 * מתחבר למסד הנתונים באמצעות כתובת החיבור המוגדרת בסביבה.
 * @returns {Promise<void>} מתעד הצלחה או כשל בחיבור ביומן השרת.
 */
const connectDB = async () => {
  try {
    await mongoose.connect(dbURI, {
      serverSelectionTimeoutMS: 15000,
      retryWrites: true
    });
    console.log('🍃 Connected to MongoDB successfully! 🎉');
  } catch (err) {
    console.error('🔥 Error connecting to MongoDB:', err.message);
    process.exit(1);
  }
};
connectDB();

const app = express();
const createRequestLogger = require('./middlewares/requestLogger');

// 3. מידלוורים וקבצים סטטיים
app.use(createRequestLogger('Botify'));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '../public/pages')));

// 4. ראוטים
const authRoutes = require('./routes/authRoutes');
app.use('/api', authRoutes);

// ---> הוספה חדשה עבור הבוטים <---
const botRoutes = require('./routes/botRoutes');
app.use('/api/bots', botRoutes);
const paymentRoutes = require('./routes/paymentRoutes');
app.use('/api/payments', paymentRoutes);

// ---> ראוטים עבור בוט המזכירה <---
const secretaryRoutes = require('./routes/secretaryRoutes');
app.use('/api/secretary', secretaryRoutes);

// 5. שכבת טיפול בשגיאות
/**
 * ממפה שגיאות middleware לתשובות HTTP אחידות.
 * @param {Error & {code?: string, statusCode?: number}} err השגיאה שהועברה בשרשרת.
 * @param {import('express').Request} req בקשת HTTP המקורית.
 * @param {import('express').Response} res תגובת HTTP.
 * @param {import('express').NextFunction} next פונקציית המשך middleware (אינה נדרשת בטיפול זה).
 * @returns {void} שולח תשובת JSON עם קוד ומסר מתאימים.
 */
app.use((err, req, res, next) => {
  console.error('🔥 Server Route Error:', err.message);
  const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : err.statusCode || 500;
  const message = err.code === 'LIMIT_FILE_SIZE'
    ? 'הקובץ גדול מדי (מקסימום 5MB)'
    : statusCode < 500
      ? err.message
      : 'שגיאה פנימית בשרת';
  res.status(statusCode).json({
    success: false, 
    message
  });
});

// 6. הפעלת השרת
const PORT = process.env.PORT || 3000;

/**
 * מדווחת ביומן לאחר ששרת HTTP התחיל להאזין.
 * @returns {void} כותבת את כתובת השרת ליומן.
 */
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});