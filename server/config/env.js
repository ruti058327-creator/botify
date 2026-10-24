import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';


// מחשב את מיקום התיקייה שבה נמצא קובץ התצורה, בלי להסתמך על תיקיית ההרצה.
const currentDirectory = dirname(fileURLToPath(import.meta.url));
// טוען את קובץ .env שבתיקיית server, יחסית לקובץ זה.
dotenv.config({ path: resolve(currentDirectory, '../.env') });
