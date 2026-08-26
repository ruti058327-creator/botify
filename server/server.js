// 1. פתיחת הכספת של משתני הסביבה
require('dotenv').config();

// 2. ייבוא ספריית מונגוס
const mongoose = require('mongoose');

// 3. שליפת הקישור מתוך קובץ ה-.env
const dbURI = process.env.MONGO_URI;

// 4. ניסיון התחברות למסד הנתונים
mongoose.connect(dbURI)
  .then(() => {
    // אם ההתחברות הצליחה, נדפיס הודעת הצלחה
    console.log("Connected to MongoDB successfully! 🎉");
  })
  .catch((error) => {
    // אם קרתה שגיאה, נדפיס אותה כדי שנוכל לדבג
    console.log("Error connecting to MongoDB: ", error.message);
  });