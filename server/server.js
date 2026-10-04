const path = require('path');
// טעינת קובץ ה-.env מאותה תיקייה שבה נמצא קובץ השרת
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const mongoose = require('mongoose');

// 1. הגדרת מחרוזת חיבור עם גיבוי קשיח
const dbURI = process.env.MONGO_URI || 'mongodb://localhost:27017/botify';

// 2. חיבור יחיד למסד הנתונים
const connectDB = async () => {
  try {
    await mongoose.connect(dbURI);
    console.log('🍃 Connected to MongoDB successfully! 🎉');
  } catch (err) {
    console.error('🔥 Error connecting to MongoDB:', err.message);
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

// 5. שכבת טיפול בשגיאות
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

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});