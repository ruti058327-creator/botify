import './env.js';
import mongoose from 'mongoose';


/**
 * Connects to MongoDB using the server environment configuration.
 * @returns {Promise<void>} Resolves after the database connection succeeds.
 */
export default async function connectDB() {
  const dbURI = process.env.MONGO_URI;
  if (!dbURI) {
    throw new Error('MONGO_URI is missing. Create server/.env from server/.env.example and set your MongoDB connection string.');
  }

  await mongoose.connect(dbURI, {
    serverSelectionTimeoutMS: 15000,
    retryWrites: true
  });
  console.log('Connected to MongoDB successfully! 🎉');
}
