require('dotenv').config();
const express = require('express');
const path = require('path');
const dns = require('dns');

// 1. הגדרת DNS מועדף למניעת שגיאות חיבור מול MongoDB Atlas
dns.setServers(['8.8.8.8', '8.8.4.4']);

// 2. חיבור למסד הנתונים
const connectDB = require('./config/db');
connectDB();

const app = express();

// 3. פענוח בקשות JSON והגשת קבצים סטטיים
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// 4. חיבור הנתיבים של המערכת
const authRoutes = require('./routes/authRoutes');
app.use('/api', authRoutes);

const paymentRoutes = require('./routes/paymentRoutes');
app.use('/api/payments', paymentRoutes);

// 5. שכבת הגנה עליונה לשגיאות בנתיבים (Global Error Handler)
app.use((err, req, res, next) => {
  console.error('🔥 Server Route Error:', err.message);
  res.status(500).json({
    success: false,
    message: 'אירעה שגיאה בשרת, אך השירות ממשיך לפעול כרגיל.'
  });
});

// 6. תפיסת שגיאות תהליך גלובליות (מונע מהשרת להיסגר)
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err.message);
});

// 7. הפעלת השרת
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});