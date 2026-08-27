require('dotenv').config();
const express = require('express');
const path = require('path');
const dns = require('dns');

// 1. הגדרת שרתי DNS למניעת בעיות חיבור מול MongoDB Atlas
dns.setServers(['8.8.8.8', '8.8.4.4']);

// 2. חיבור למסד הנתונים
const connectDB = require('./config/db');
connectDB();

const app = express();

// 3. הגשת קבצים סטטיים ופענוח JSON
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// 4. חיבור הראוטים
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
  console.log(`Server is running on http://localhost:${PORT}`);
});