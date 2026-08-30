const mongoose = require('mongoose');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
  // מחרוזת החיבור מוגדרת פה ישירות - ללא תלות ב-process.env
  const dbURI = 'mongodb://localhost:27017/botify';

  try {
    await mongoose.connect(dbURI);
    console.log("Connected to MongoDB successfully! 🎉");
  } catch (error) {
    console.log("Error connecting to MongoDB: ", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;