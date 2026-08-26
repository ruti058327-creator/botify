require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./config/db'); // 1. ייבוא החיבור למסד הנתונים
const errorHandler = require('./middlewares/errorHandler'); // ייבוא מידלוור שגיאות
const dns = require('dns');

// 1. הגדרת שרתי DNS למניעת בעיות חיבור מול MongoDB Atlas
dns.setServers(['8.8.8.8', '8.8.4.4']);

// 2. חיבור למסד הנתונים
connectDB();

const app = express();

// 3. פענוח בקשות JSON והגשת קבצים סטטיים
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// 4. ייבוא וחיבור הראוטים
const authRoutes = require('./routes/authRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

app.use('/api', authRoutes);
app.use('/api/payments', paymentRoutes);

// הוספת מידלוור שגיאות
app.use(errorHandler);

// 4. הפעלת השרת
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
