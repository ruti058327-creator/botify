import express from 'express';
import secretaryController from '../controllers/secretaryController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import validateRequest from '../middlewares/validateRequest.js';
import { secretarySchemas } from '../validation/schemas.js';

const router = express.Router();

// הגדרה או עדכון ראשוני של בוט המזכירה (דורש אימות של בעל העסק)
router.post('/setup', authenticateToken, validateRequest(secretarySchemas.setup), secretaryController.setupSecretary);

// בוטי המזכירה השייכים לבעל העסק
router.get('/mine', authenticateToken, secretaryController.getOwnedSecretaryBots);

// מחיקת בוט מזכירה על ידי בעל העסק
router.delete(
  '/:botUrlKey',
  authenticateToken,
  validateRequest(secretarySchemas.botParams, 'params'),
  secretaryController.deleteSecretaryBot
);

// נתיב לשליפת לוח שנה חודשי של הבוט (פתוח לציבור דרך הקישור הייחודי של הבוט)
router.get(
  '/:botUrlKey/calendar-month',
  validateRequest(secretarySchemas.botParams, 'params'),
  validateRequest(secretarySchemas.calendarQuery, 'query'),
  secretaryController.getMonthCalendar
);

// נתיב לבדיקה אם תאריך מסוים הוא חופשה או שבת (פתוח לציבור דרך הקישור הייחודי של הבוט)
router.get(
  '/:botUrlKey/is-holiday-or-shabbat',
  validateRequest(secretarySchemas.botParams, 'params'),
  validateRequest(secretarySchemas.dateQuery, 'query'),
  secretaryController.isHolidayOrShabbat
);

// נתיב להמרת זמן למספר דקות (פתוח לציבור דרך הקישור הייחודי של הבוט)
router.get(
  '/:botUrlKey/time-to-minutes',
  validateRequest(secretarySchemas.botParams, 'params'),
  validateRequest(secretarySchemas.timeQuery, 'query'),
  secretaryController.timeToMinutes
);

// נתיב להמרת מספר דקות לזמן (פתוח לציבור דרך הקישור הייחודי של הבוט)
router.get(
  '/:botUrlKey/minutes-to-time',
  validateRequest(secretarySchemas.botParams, 'params'),
  validateRequest(secretarySchemas.minutesQuery, 'query'),
  secretaryController.minutesToTime
);

// קביעת תור חדש על ידי לקוח (פתוח לציבור דרך הקישור הייחודי של הבוט)
router.post(
  '/:botUrlKey/book',
  validateRequest(secretarySchemas.botParams, 'params'),
  validateRequest(secretarySchemas.booking),
  secretaryController.bookAppointment
);

// נתיב לשליפת שעות פנויות ללקוח לפי תאריך
router.get(
  '/:botUrlKey/slots',
  validateRequest(secretarySchemas.botParams, 'params'),
  validateRequest(secretarySchemas.dateQuery, 'query'),
  secretaryController.getAvailableSlots
);

// צפייה בתורים המאושרים של העסק (דורש אימות של בעל העסק)
router.get(
  '/:botUrlKey/appointments',
  authenticateToken,
  validateRequest(secretarySchemas.botParams, 'params'),
  validateRequest(secretarySchemas.appointmentQuery, 'query'),
  secretaryController.getBusinessAppointments
);

// עדכון הגדרות הבוט על ידי בעל העסק (דורש אימות)
router.patch(
  '/:botUrlKey/settings',
  authenticateToken,
  validateRequest(secretarySchemas.botParams, 'params'),
  validateRequest(secretarySchemas.settings),
  secretaryController.updateBotSettings
);

// נתיב לאישור קריאה של הלקוח על ידי לחיצה על הקישור במייל (פתוח לציבור)
router.get(
  '/confirm-read/:token',
  validateRequest(secretarySchemas.tokenParams, 'params'),
  secretaryController.confirmReadMessage
);

// בקשת חופשה פתאומית ושליחת הודעה ללקוחות של הבוט
router.post(
  '/:botUrlKey/emergency-vacation',
  authenticateToken,
  validateRequest(secretarySchemas.botParams, 'params'),
  validateRequest(secretarySchemas.emergencyVacation),
  secretaryController.requestEmergencyVacation
);

export default router;
