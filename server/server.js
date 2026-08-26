require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./config/db'); // 1. ייבוא החיבור למסד הנתונים

const app = express();

// 2. הפעלת החיבור ל-MongoDB
connectDB();

// פענוח בקשות JSON
app.use(express.json());

// הגשת הקבצים הסטטיים מתיקיית public
app.use(express.static(path.join(__dirname, '../public')));

// חיבור ראוטים מתוך תיקיית routes
const authRoutes = require('./routes/authRoutes');
app.use('/api', authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
// חיבור ראוטים
const authRoutes = require('./routes/authRoutes');
app.use('/api', authRoutes);

// הוספת הנתיב לתשלומים
const paymentRoutes = require('./routes/paymentRoutes');
app.use('/api/payments', paymentRoutes);