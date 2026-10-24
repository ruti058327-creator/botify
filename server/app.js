// טוען תחילה את משתני הסביבה, כדי שכל מודול שייבא אותם בהמשך יקבל את הערכים.
import './config/env.js';
// Express מספק את מנגנון הנתיבים והטיפול בבקשות HTTP.
import express from 'express';
// ממיר כתובות קבצים של מודולי ES לנתיבים המתאימים למערכת ההפעלה.
import { fileURLToPath } from 'node:url';
// יומן הבקשות מוצב בתחילת השרשרת כדי למדוד גם את שלבי הטיפול הבאים.
import createRequestLogger from './middlewares/requestLogger.js';
// מרכז את הטיפול בשגיאות שהועברו אליו מנתיבים ו-middleware.
import errorHandler from './middlewares/errorHandler.js';
// כל קובץ נתיבים מרכז נקודת כניסה אחת או יותר בתחום אחר של המערכת.
import authRoutes from './routes/authRoutes.js';
import botRoutes from './routes/botRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
// יוצר שגיאת HTTP אחידה עבור בקשות לכתובות שאינן קיימות.
import httpError from './utils/httpError.js';

// יוצר יישום Express שעליו נרכיב middleware ונתיבים.
const app = express();

// מתעד כל בקשה לפני שפענוח הגוף והנתיבים מתחילים לעבד אותה.
app.use(createRequestLogger('Botify'));
// מאפשר לנתיבים לקרוא גוף בקשה שמגיע בפורמט JSON.
app.use(express.json());
// מגיש את קובצי הממשק הציבוריים מתוך תיקיית public של הפרויקט.
app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));
// מגיש גם את העמודים הסטטיים הנמצאים בתת-התיקייה pages.
app.use(express.static(fileURLToPath(new URL('../public/pages', import.meta.url))));
// מחבר את נקודות הקצה של חשבונות, בוטים ותשלומים תחת תחילית API.
app.use('/api', authRoutes);
app.use('/api/bots', botRoutes);
app.use('/api/payments', paymentRoutes);

// אם אף נתיב לא התאים, מעבירים שגיאת 404 לטיפול המרכזי.
app.use((req, res, next) => next(httpError(404, 'הנתיב המבוקש לא נמצא')));
// חייב להירשם אחרי הנתיבים כדי לקבל שגיאות שנוצרו בשלבי הטיפול הקודמים.
app.use(errorHandler);

// מאפשר לקובץ ההפעלה ולבדיקות לייבא את האפליקציה בלי לפתוח שרת כאן.
export default app;
