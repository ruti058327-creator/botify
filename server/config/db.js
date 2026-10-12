const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/**
 * מתחבר למסד Botify באמצעות MONGO_URI המוגדר בסביבת השרת.
 * @returns {Promise<void>} מתעד הצלחה או מסיים את השרת בשגיאה.
 */
const connectDB = async () => {
  const dbURI = process.env.MONGO_URI;

  if (!dbURI) {
    console.error('❌ MONGO_URI is missing. Create server/.env from server/.env.example and set your MongoDB connection string.');
    process.exit(1);
  }

  try {
    await mongoose.connect(dbURI, {
      serverSelectionTimeoutMS: 15000,
      retryWrites: true
    });
    console.log('Connected to MongoDB successfully! 🎉');
  } catch (error) {
    console.error('Error connecting to MongoDB: ', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;