require('dotenv').config();
const express = require('express');
const path = require('path');
const dns = require('dns');

// הגדרת DNS למניעת בעיות חיבור מול MongoDB Atlas
dns.setServers(['8.8.8.8', '8.8.4.4']);

// חיבור למסד הנתונים
const connectDB = require('./config/db');
connectDB();

const app = express();

// הגשת קבצים ופענוח JSON
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// חיבור הראוטים הקיימים
const authRoutes = require('./routes/authRoutes');
app.use('/api', authRoutes);

// טיפול בשגיאות
app.use((err, req, res, next) => {
  console.error('🔥 Server Route Error:', err.message);
  res.status(500).json({ success: false, message: 'שגיאה פנימית בשרת' });
});

// הפעלת השרת
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});