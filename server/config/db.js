// 1. פתיחת הכספת של משתני הסביבה
require('dotenv').config();

// 2. ייבוא ספריית מונגוס
const mongoose = require('mongoose');

// 3. הגדרת פונקציית ההתחברות למסד הנתונים
const connectDB = async () => {
  const dbURI = process.env.MONGO_URI;

  try {
    await mongoose.connect(dbURI);
    console.log("Connected to MongoDB successfully! 🎉");
  } catch (error) {
    console.log("Error connecting to MongoDB: ", error.message);
    process.exit(1);
  }
};

// 4. ייצוא הפונקציה כדי ש-server.js יוכל להריץ אותה
module.exports = connectDB;