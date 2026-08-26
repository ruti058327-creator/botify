require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();

// פענוח בקשות JSON
app.use(express.json());

// הגשת הקבצים הסטטיים מתיקיית public (שנמצאת תיקייה אחת למעלה)
app.use(express.static(path.join(__dirname, '../public')));

// חיבור ראוטים מתוך תיקיית routes שנמצאת בתוך server
const authRoutes = require('./routes/authRoutes');
app.use('/api', authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});