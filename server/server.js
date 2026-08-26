require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./config/db');

// ייבוא הנתיבים
const authRoutes = require('./routes/authRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

// הפעלת החיבור ל-MongoDB
connectDB();

// פענוח בקשות JSON והגשת קבצים סטטיים
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// חיבור הראוטים לשרת
app.use('/api', authRoutes);
app.use('/api/payments', paymentRoutes);

// הפעלת השרת (תמיד בסוף הקובץ)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});