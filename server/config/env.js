import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import environmentSchema from '../validation/environmentSchema.js';

// מחשב את מיקום התיקייה שבה נמצא קובץ התצורה, בלי להסתמך על תיקיית ההרצה.
const currentDirectory = dirname(fileURLToPath(import.meta.url));
// טוען את קובץ .env שבתיקיית server, יחסית לקובץ זה.
dotenv.config({ path: resolve(currentDirectory, '../.env') });

const { error, value } = environmentSchema.validate(process.env, {
  abortEarly: false,
  convert: true
});

if (error) {
  const details = error.details.map(detail => detail.message).join('; ');
  throw new Error(`Invalid environment configuration: ${details}`);
}

process.env.PORT = String(value.PORT);
process.env.APP_URL = value.APP_URL || 'http://localhost:3000';
