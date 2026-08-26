require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./config/db');

const app = express();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
// 1. חיבור למסד הנתונים
connectDB();

// 2. פיענוח בקשות JSON והגשת קבצים סטטיים
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// 3. חיבור הנתיבים (פעם אחת בלבד)
const authRoutes = require('./routes/authRoutes');
app.use('/api', authRoutes);

const paymentRoutes = require('./routes/paymentRoutes');
app.use('/api/payments', paymentRoutes);

// 4. הפעלת השרת
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});