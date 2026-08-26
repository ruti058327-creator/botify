const express = require('express');
const path = require('path');
const app = express();
const authRoutes = require('./routes/authRoutes');

// פענוח בקשות JSON
app.use(express.json());

// הגשת הקבצים הסטטיים מתיקיית public (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// חיבור נתיבי האותנטיקציה
app.use('/api', authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});