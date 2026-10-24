import './env.js';
import mongoose from 'mongoose';


/**
 * Connects to MongoDB using the server environment configuration.
 * @returns {Promise<void>} Resolves after the database connection succeeds.
 */
export default async function connectDB() {
  const dbURI = process.env.MONGO_URI;
  await mongoose.connect(dbURI, {
    serverSelectionTimeoutMS: 15000,
    retryWrites: true
  });
  console.log('Connected to MongoDB successfully! 🎉');
}
