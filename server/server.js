require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./config/db');
const dns = require('dns');
const errorHandler = require('./middlewares/errorHandler');

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

// 5. מידלוור טיפול בשגיאות (חייב להיות אחרי ה־Routes)
app.use(errorHandler);

// 6. הפעלת השרת
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});