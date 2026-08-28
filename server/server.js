const path = require('path');
// טעינת קובץ .env מתיקיית השורש של הפרויקט (רמה אחת למעלה מ-server)
require('dotenv').config({ path: path.join(__dirname, '../.env') });

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

// 3. מידלוורים וקבצים סטטיים
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '../public/pages')));

// 4. ראוטים
const authRoutes = require('./routes/authRoutes');
app.use('/api', authRoutes);

// 5. שכבת טיפול בשגיאות
app.use((err, req, res, next) => {
  console.error('🔥 Server Route Error:', err.message);
  res.status(500).json({ 
    success: false, 
    message: 'שגיאה פנימית בשרת' 
  });
});

// 6. הפעלת השרת
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});