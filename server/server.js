require('dotenv').config();
const express = require('express');
const path = require('path');
<<<<<<< HEAD
const connectDB = require('./config/db'); // 1. ייבוא החיבור למסד הנתונים
const errorHandler = require('./middlewares/errorHandler'); // ייבוא מידלוור שגיאות
=======
const connectDB = require('./config/db');
const dns = require('dns');

// הגדרת שרתי DNS למניעת בעיות חיבור
dns.setServers(['8.8.8.8', '8.8.4.4']);
>>>>>>> efc5cdf71ee483899b93a8f3fa62a61edf62f6ed

const app = express();

// 1. הפעלת החיבור ל-MongoDB
connectDB();

// 2. פענוח בקשות JSON והגשת קבצים סטטיים
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// 3. ייבוא וחיבור הנתיבים (Routes)
const authRoutes = require('./routes/authRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

<<<<<<< HEAD
// הוספת מידלוור שגיאות
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// הוספת הנתיב לתשלומים
const paymentRoutes = require('./routes/paymentRoutes');
app.use('/api/payments', paymentRoutes);
=======
app.use('/api', authRoutes);
app.use('/api/payments', paymentRoutes);

// 4. הפעלת השרת
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
>>>>>>> efc5cdf71ee483899b93a8f3fa62a61edf62f6ed
