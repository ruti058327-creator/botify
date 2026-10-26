// Express מספק נתב נפרד לנקודות הקצה של בוט המזכירה.
import express from 'express';
// הבקר מממש פעולות של הגדרות עסק, תורים, חופשות ולוח שנה.
import secretaryController from '../controllers/secretaryController.js';
// מסלולי ניהול מוגנים בזיהוי משתמש מתוך אסימון ההתחברות.
import { authenticateToken } from '../middlewares/authMiddleware.js';
// middleware זה מאמת ומנרמל נתונים לפני שהבקר משתמש בהם.
import validateRequest from '../middlewares/validateRequest.js';
// הסכמות מתארות את המבנה התקין לכל סוג נתיב של המזכירה.
import { secretarySchemas } from '../validation/schemas.js';

// יוצרים אוסף נתיבים שניתן לחבר לאפליקציה תחת תחילית API.
const router = express.Router();

// הגדרה או עדכון ראשוני דורשים משתמש מחובר ונתוני הגדרה תקינים.
router.post('/setup', authenticateToken, validateRequest(secretarySchemas.setup), secretaryController.setupSecretary);

// רשימת הבוטים מוצגת רק למשתמש המזוהה שבבעלותו הם רשומים.
router.get('/mine', authenticateToken, secretaryController.getOwnedSecretaryBots);

// אימות הבעלות נעשה בבקר לאחר אימות המבנה של המזהה שבנתיב.
router.delete(
  '/:botUrlKey',
  authenticateToken,
  validateRequest(secretarySchemas.botParams, 'params'),
  secretaryController.deleteSecretaryBot
);

// לוח השנה ציבורי, אך גם מפתח הבוט וגם השנה והחודש נבדקים לפני החיפוש.
router.get(
  '/:botUrlKey/calendar-month',
  validateRequest(secretarySchemas.botParams, 'params'),
  validateRequest(secretarySchemas.calendarQuery, 'query'),
  secretaryController.getMonthCalendar
);

// בדיקת תאריך ציבורית מקבלת מפתח בוט ותאריך בתבנית תקינה.
router.get(
  '/:botUrlKey/is-holiday-or-shabbat',
  validateRequest(secretarySchemas.botParams, 'params'),
  validateRequest(secretarySchemas.dateQuery, 'query'),
  secretaryController.isHolidayOrShabbat
);

// ממיר זמן שסופק בשאילתה לדקות; הסכמה מוודאת תבנית HH:MM.
router.get(
  '/:botUrlKey/time-to-minutes',
  validateRequest(secretarySchemas.botParams, 'params'),
  validateRequest(secretarySchemas.timeQuery, 'query'),
  secretaryController.timeToMinutes
);

// ממיר דקות לתצוגת שעה, לאחר בדיקת הערך המספרי.
router.get(
  '/:botUrlKey/minutes-to-time',
  validateRequest(secretarySchemas.botParams, 'params'),
  validateRequest(secretarySchemas.minutesQuery, 'query'),
  secretaryController.minutesToTime
);

// לקוח יכול לקבוע תור ציבורי; פרטי הלקוח, התאריך והשעה נבדקים מראש.
router.post(
  '/:botUrlKey/book',
  validateRequest(secretarySchemas.botParams, 'params'),
  validateRequest(secretarySchemas.booking),
  secretaryController.bookAppointment
);

// השעות הפנויות מוחזרות עבור תאריך תקין ומפתח של בוט קיים.
router.get(
  '/:botUrlKey/slots',
  validateRequest(secretarySchemas.botParams, 'params'),
  validateRequest(secretarySchemas.dateQuery, 'query'),
  secretaryController.getAvailableSlots
);

// צפייה בתורים דורשת התחברות, מזהה בוט ופרמטרים תקינים לסינון.
router.get(
  '/:botUrlKey/appointments',
  authenticateToken,
  validateRequest(secretarySchemas.botParams, 'params'),
  validateRequest(secretarySchemas.appointmentQuery, 'query'),
  secretaryController.getBusinessAppointments
);

// שינוי הגדרות נעשה רק לאחר אימות משתמש ונתוני ההגדרה החדשים.
router.patch(
  '/:botUrlKey/settings',
  authenticateToken,
  validateRequest(secretarySchemas.botParams, 'params'),
  validateRequest(secretarySchemas.settings),
  secretaryController.updateBotSettings
);

// קישור האישור נגיש לנמען ללא התחברות, אך אסימון הנתיב נבדק תחילה.
router.get(
  '/confirm-read/:token',
  validateRequest(secretarySchemas.tokenParams, 'params'),
  secretaryController.confirmReadMessage
);

// בקשת חופשה דורשת בעלים מחובר ותאריך והודעה שעומדים בכללי הסכמה.
router.post(
  '/:botUrlKey/emergency-vacation',
  authenticateToken,
  validateRequest(secretarySchemas.botParams, 'params'),
  validateRequest(secretarySchemas.emergencyVacation),
  secretaryController.requestEmergencyVacation
);

// מייצא את הנתב כדי שהאפליקציה תוכל לרשום את כל נקודות הקצה יחד.
export default router;
