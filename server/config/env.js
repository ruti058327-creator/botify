import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import environmentSchema from '../validation/environmentSchema.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
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
